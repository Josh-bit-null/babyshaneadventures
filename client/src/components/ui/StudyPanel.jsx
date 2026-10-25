import { useEffect, useRef, useState } from 'react'
import {
  BrainCircuit,
  CheckCircle2,
  FileText,
  Loader2,
  RotateCcw,
  Sparkles,
  Trophy,
  UploadCloud,
  XCircle,
} from 'lucide-react'
import Panel from './Panel.jsx'
import { api } from '../../lib/api.js'
import { extractPdfText } from '../../game/pdf.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'

const EMPTY_ANSWERS = () => Array.from({ length: 10 }, () => null)

export default function StudyPanel({ onClose, incomingFile, onConsumed }) {
  const { setCoins } = useAuth()
  const { push } = useToast()
  const inputRef = useRef(null)
  const processedRef = useRef(null)
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [label, setLabel] = useState('')
  const [fileInfo, setFileInfo] = useState(null)
  const [text, setText] = useState('')
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState(EMPTY_ANSWERS)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showText, setShowText] = useState(false)

  const answered = answers.filter((answer) => answer != null).length

  const runFile = async (file) => {
    if (!file) return
    processedRef.current = `${file.name}:${file.size}:${file.lastModified}`
    setError('')
    setResult(null)
    setQuiz(null)
    setAnswers(EMPTY_ANSWERS())
    setFileInfo({ name: file.name, size: file.size })
    setPhase('extracting')
    setProgress(0.02)
    setLabel('Opening the PDF locally…')
    try {
      const extracted = await extractPdfText(file, ({ progress: value, label: next }) => {
        setProgress(value)
        setLabel(next)
      })
      setText(extracted.text)
      setFileInfo((current) => ({ ...current, pages: extracted.pageCount }))
      setPhase('generating')
      setProgress(0.95)
      setLabel('Asking Gemini for ten questions…')
      const generated = await api.post(
        '/api/study/quiz',
        { text: extracted.text, title: file.name.replace(/\.pdf$/i, '') },
        { timeout: 95_000 },
      )
      setQuiz(generated)
      setPhase('quiz')
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
  }

  useEffect(() => {
    if (!incomingFile) return
    if (processedRef.current === `${incomingFile.name}:${incomingFile.size}:${incomingFile.lastModified}`) return
    runFile(incomingFile)
    onConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingFile])

  const onDrop = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setDragging(false)
    const file = [...(event.dataTransfer?.files ?? [])].find(
      (entry) => entry.type === 'application/pdf' || /\.pdf$/i.test(entry.name),
    )
    if (file) runFile(file)
    else setError('Drop a PDF file — a syllabus, slide deck or presentation export.')
  }

  const submit = async () => {
    if (!quiz || answered < 10) return
    setSubmitting(true)
    setError('')
    try {
      const response = await api.post(`/api/study/quiz/${quiz.quizId}/submit`, { answers })
      setResult(response)
      setCoins(response.coins)
      setPhase('results')
      if (response.perfect) {
        push({
          type: 'reward',
          title: 'Perfect score!',
          message: `+${response.reward} coins landed in your pocket.`,
          icon: '🏆',
        })
      } else {
        push({
          type: 'info',
          title: `${response.score}/10`,
          message: 'No coin reward this time — perfect scores only.',
          icon: '📚',
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    processedRef.current = null
    setPhase('idle')
    setQuiz(null)
    setResult(null)
    setAnswers(EMPTY_ANSWERS())
    setText('')
    setFileInfo(null)
    setError('')
    setProgress(0)
  }

  return (
    <Panel
      title="Study nook"
      subtitle="PDFs are read in your browser. Only the extracted text goes to Gemini."
      icon="📖"
      onClose={onClose}
      size="lg"
      className="study-panel"
      footer={
        phase === 'quiz' ? (
          <div className="panel-foot-row">
            <span className="quiz-progress">{answered}/10 answered</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={submit}
              disabled={answered < 10 || submitting}
            >
              {submitting ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
              Grade my quiz
            </button>
          </div>
        ) : null
      }
    >
      {phase === 'idle' || phase === 'error' ? (
        <>
          <div
            className={`dropzone${dragging ? ' is-dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
            }}
          >
            <span className="dropzone-icon"><UploadCloud size={28} /></span>
            <strong>Drop a PDF syllabus or slide deck</strong>
            <p>or tap to choose a file · max 30 pages · processed locally</p>
            <span className="btn btn-secondary btn-sm">
              <FileText size={15} /> Choose PDF
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) runFile(file)
                event.target.value = ''
              }}
            />
          </div>

          {error ? <div className="form-error">{error}</div> : null}

          <div className="study-steps">
            <div><span>1</span><strong>Local text extraction</strong><small>pdf.js runs on your device</small></div>
            <div><span>2</span><strong>Gemini question writer</strong><small>exactly ten MCQs, JSON-only</small></div>
            <div><span>3</span><strong>Perfect score</strong><small>+300 coins, saved to MariaDB</small></div>
          </div>

          <div className="inline-note">
            <Sparkles size={15} />
            Without a Gemini key the server falls back to a local cloze-question engine so the study loop still works.
          </div>
        </>
      ) : null}

      {phase === 'extracting' || phase === 'generating' ? (
        <div className="processing-card">
          <div className="processing-orb"><Loader2 className="spin" size={28} /></div>
          <strong>{phase === 'extracting' ? 'Reading locally' : 'Writing your quiz'}</strong>
          <p>{label}</p>
          <div className="progress-track"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          <small>
            {fileInfo?.name} {fileInfo?.pages ? `· ${fileInfo.pages} pages` : ''}
          </small>
          {phase === 'generating' ? (
            <span className="provider-pill"><BrainCircuit size={13} /> Gemini · strict JSON schema</span>
          ) : null}
        </div>
      ) : null}

      {phase === 'quiz' && quiz ? (
        <div className="quiz-wrap">
          <div className="quiz-head">
            <div>
              <p className="eyebrow"><FileText size={13} /> {fileInfo?.name}</p>
              <h3>{quiz.title}</h3>
            </div>
            <span className={`provider-pill${quiz.provider === 'local' ? ' is-local' : ''}`}>
              <BrainCircuit size={13} />
              {quiz.provider === 'gemini' ? 'Gemini' : 'Offline engine'}
            </span>
          </div>
          {quiz.notice ? <div className="inline-note is-warn">{quiz.notice}</div> : null}

          <div className="quiz-list">
            {quiz.questions.map((question, questionIndex) => (
              <fieldset key={questionIndex} className="quiz-question">
                <legend>
                  <span className="quiz-number">{String(questionIndex + 1).padStart(2, '0')}</span>
                  {question.question}
                </legend>
                <div className="quiz-options">
                  {question.options.map((option, optionIndex) => (
                    <label
                      key={optionIndex}
                      className={`quiz-option${answers[questionIndex] === optionIndex ? ' is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`q-${questionIndex}`}
                        checked={answers[questionIndex] === optionIndex}
                        onChange={() =>
                          setAnswers((current) => {
                            const next = [...current]
                            next[questionIndex] = optionIndex
                            return next
                          })
                        }
                      />
                      <span className="quiz-letter">{String.fromCharCode(65 + optionIndex)}</span>
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          {error ? <div className="form-error">{error}</div> : null}
          <button type="button" className="btn btn-ghost btn-sm quiz-restart" onClick={reset}>
            <RotateCcw size={14} /> Start over
          </button>
          {text ? (
            <details className="raw-text" open={showText} onToggle={(event) => setShowText(event.currentTarget.open)}>
              <summary>Extracted text ({text.length.toLocaleString()} characters)</summary>
              <pre>{text.slice(0, 5000)}</pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {phase === 'results' && result && quiz ? (
        <div className="quiz-results">
          <div className={`result-hero${result.perfect ? ' is-perfect' : ''}`}>
            <span className="result-emoji">{result.perfect ? '🏆' : result.score >= 7 ? '🌟' : '📚'}</span>
            <h3>{result.perfect ? 'Perfect score!' : `${result.score} out of 10`}</h3>
            <p>
              {result.perfect
                ? `+${result.reward} coins are already in your MariaDB balance.`
                : 'Coins are only awarded for a perfect run — review and try another PDF.'}
            </p>
            <span className="result-coins">🪙 {result.coins.toLocaleString()}</span>
          </div>

          <div className="review-list">
            {result.review.map((entry, index) => (
              <div key={index} className={`review-row${entry.isCorrect ? ' is-correct' : ' is-wrong'}`}>
                <span className="review-icon">
                  {entry.isCorrect ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                </span>
                <div>
                  <strong>Q{index + 1}</strong>
                  <p>
                    Correct answer: <b>{quiz.questions[index].options[entry.correctIndex]}</b>
                  </p>
                  {entry.explanation ? <small>{entry.explanation}</small> : null}
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="btn btn-primary" onClick={reset}>
            <UploadCloud size={16} /> Drop another PDF
          </button>
          <div className="inline-note">
            <Trophy size={15} /> Every perfect quiz is worth 300 coins, once per generated quiz.
          </div>
        </div>
      ) : null}
    </Panel>
  )
}
