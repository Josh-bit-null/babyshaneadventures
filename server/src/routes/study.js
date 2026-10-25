import express from 'express'
import { requireAuth } from '../auth.js'
import { getConfig } from '../config.js'
import { createQuiz, submitQuiz } from '../quiz.js'
import { roomEvents } from '../events.js'
import { sanitizeText } from '../utils.js'

export const studyRouter = express.Router()

const buckets = new Map()
const HOUR = 60 * 60_000

function allowGeneration(userId, max = 10) {
  const now = Date.now()
  const current = (buckets.get(userId) ?? []).filter((at) => now - at < HOUR)
  if (current.length >= max) return false
  current.push(now)
  buckets.set(userId, current)
  return true
}

studyRouter.post('/study/quiz', requireAuth, async (req, res) => {
  const text = String(req.body?.text ?? '')
  const title = sanitizeText(req.body?.title, 120) || 'Dropped PDF'
  if (text.length < 200) {
    res.status(422).json({
      error: 'That PDF had almost no selectable text. Scanned slides need OCR first.',
    })
    return
  }
  if (text.length > 120_000) {
    res.status(413).json({ error: 'That document is too large. Send at most 30 pages.' })
    return
  }
  if (!allowGeneration(req.user.id)) {
    res.status(429).json({ error: 'Ten quiz generations per hour. Take a breath, scholar.' })
    return
  }

  try {
    const config = getConfig()
    const quiz = await createQuiz({ userId: req.user.id, text, title, config })
    res.json(quiz)
  } catch (error) {
    res.status(error.status || 422).json({ error: error.message })
  }
})

studyRouter.post('/study/quiz/:quizId/submit', requireAuth, async (req, res) => {
  try {
    const result = await submitQuiz({
      quizId: String(req.params.quizId),
      userId: req.user.id,
      answers: req.body?.answers,
    })
    if (result.perfect) {
      roomEvents.emit('coins:changed', { userId: req.user.id, coins: result.coins })
    }
    res.json(result)
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message })
  }
})
