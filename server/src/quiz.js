import crypto from 'node:crypto'
import { askGeminiForQuiz } from './gemini.js'
import { addCoins, findUserById } from './repo.js'

const STOPWORDS = new Set(
  `about above after again against all also although always among another any anyone
  anything around because been before being below between both cannot could course does
  doing down during each either else every from further have having here herself himself
  into itself just lecture like make many more most much must need only other otherwise
  our ourselves over same should since some such than that their theirs them themselves
  then there these they thing this those through under until upon very were what when
  where which while will with within without would your yours syllabus students student
  week weeks module modules assessment assessments learning outcomes outcome topic topics`
    .split(/\s+/)
    .filter(Boolean),
)

const clean = (text) =>
  String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const sentencesFrom = (text) =>
  clean(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.replace(/\s+/g, ' ').trim())
    .filter((sentence) => sentence.length >= 55 && sentence.length <= 320)

function shuffle(items) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function keyTerms(text) {
  const words = clean(text).match(/\b[A-Za-z][A-Za-z''-]{4,20}\b/g) ?? []
  const seen = new Map()
  for (const word of words) {
    const lower = word.toLowerCase()
    if (STOPWORDS.has(lower)) continue
    if (!seen.has(lower)) seen.set(lower, word)
  }
  return [...seen.values()]
}

/**
 * Offline fallback: cloze questions built from the extracted text. It is used
 * when GEMINI_API_KEY is missing or Gemini is unreachable, so the study loop
 * still works (clearly labelled in the UI).
 */
export function generateLocalQuiz(text) {
  const source = clean(text)
  if (source.length < 400) {
    const error = new Error(
      'Not enough readable text in that file. Try a text-based PDF rather than a scan.',
    )
    error.code = 'TOO_SHORT'
    error.status = 422
    throw error
  }

  const terms = keyTerms(source)
  if (terms.length < 8) {
    const error = new Error('Could not find enough distinct terms to build questions.')
    error.code = 'TOO_THIN'
    error.status = 422
    throw error
  }

  const sentences = shuffle(sentencesFrom(source))
  const questions = []
  const usedTerms = new Set()

  for (const sentence of sentences) {
    if (questions.length >= 10) break
    const candidates = (sentence.match(/\b[A-Za-z][A-Za-z''-]{4,20}\b/g) ?? [])
      .filter((word) => !STOPWORDS.has(word.toLowerCase()))
      .filter((word) => !usedTerms.has(word.toLowerCase()))
      .sort((a, b) => b.length - a.length)
    const answer = candidates[0]
    if (!answer) continue
    const lower = answer.toLowerCase()
    usedTerms.add(lower)

    const distractorPool = shuffle(terms.filter((term) => term.toLowerCase() !== lower)).slice(0, 3)
    if (distractorPool.length < 3) continue

    const options = shuffle([answer, ...distractorPool])
    const blanked = sentence.replace(new RegExp(`\\b${escapeRegex(answer)}\\b`, 'gi'), '________')
    if (!blanked.includes('________')) continue

    questions.push({
      question: `Complete this line from the study material: “${blanked}”`,
      options,
      answerIndex: options.findIndex((option) => option === answer),
      explanation: `The source text names “${answer}” in this context.`,
    })
  }

  if (questions.length < 10) {
    const error = new Error(
      'This document has too little unique content for ten questions. Try a longer PDF.',
    )
    error.code = 'TOO_THIN'
    error.status = 422
    throw error
  }

  return questions.slice(0, 10)
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const quizzes = new Map()
const QUIZ_TTL = 60 * 60_000
const PERFECT_REWARD = 300

function cleanup() {
  const cutoff = Date.now() - QUIZ_TTL
  for (const [id, quiz] of quizzes) {
    if (quiz.createdAt < cutoff) quizzes.delete(id)
  }
}

export function getQuiz(id) {
  cleanup()
  return quizzes.get(id) ?? null
}

export async function createQuiz({ userId, text, title, config }) {
  let questions
  let provider = 'gemini'
  let notice = null

  if (!config.geminiKey) {
    questions = generateLocalQuiz(text)
    provider = 'local'
    notice = 'GEMINI_API_KEY is not set — questions came from the offline study engine.'
  } else {
    try {
      questions = await askGeminiForQuiz({
        text,
        apiKey: config.geminiKey,
        model: config.geminiModel,
      })
    } catch (error) {
      questions = generateLocalQuiz(text)
      provider = 'local'
      notice = `Gemini was unavailable (${error.code || 'error'}) — used the offline study engine.`
    }
  }

  const id = crypto.randomUUID()
  const quiz = {
    id,
    userId,
    title: String(title || 'Untitled study material').slice(0, 120),
    questions,
    createdAt: Date.now(),
  }
  quizzes.set(id, quiz)

  return {
    quizId: id,
    title: quiz.title,
    provider,
    notice,
    questions: questions.map(({ question, options }) => ({ question, options })),
  }
}

export async function submitQuiz({ quizId, userId, answers }) {
  cleanup()
  const quiz = quizzes.get(quizId)
  if (!quiz || quiz.userId !== userId || quiz.submitting) {
    const error = new Error('This quiz has expired. Drop the PDF again to regenerate it.')
    error.status = 404
    error.code = 'QUIZ_EXPIRED'
    throw error
  }
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
    const error = new Error('Answer all ten questions before submitting.')
    error.status = 400
    throw error
  }

  const review = quiz.questions.map((question, index) => {
    const chosen = Number(answers[index])
    return {
      chosen: Number.isInteger(chosen) ? chosen : -1,
      correctIndex: question.answerIndex,
      isCorrect: chosen === question.answerIndex,
      explanation: question.explanation,
    }
  })
  const score = review.filter((entry) => entry.isCorrect).length
  const perfect = score === quiz.questions.length

  quiz.submitting = true
  let coins = null
  try {
    if (perfect) {
      const user = await addCoins(userId, PERFECT_REWARD)
      coins = Number(user.coins)
    } else {
      const user = await findUserById(userId)
      coins = Number(user?.coins ?? 0)
    }
  } catch (error) {
    quiz.submitting = false
    throw error
  }

  // Invalidate after submission so a refresh cannot replay the same quiz.
  quizzes.delete(quizId)

  return {
    score,
    total: quiz.questions.length,
    perfect,
    reward: perfect ? PERFECT_REWARD : 0,
    coins,
    review,
  }
}

export const __test = { generateLocalQuiz, PERFECT_REWARD, QUIZ_TTL }
