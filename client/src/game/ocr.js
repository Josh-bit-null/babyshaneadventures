/**
 * OCR runs entirely in the browser: the screenshot never leaves the device.
 * Tesseract's worker, WASM core and eng traineddata are served from this app
 * (public/tessdata + bundled assets), so scanning also works on the PWA cache.
 */

let localTesseract = null

async function loadTesseract() {
  if (localTesseract) return localTesseract
  const [tesseract, workerModule, coreModule] = await Promise.all([
    import('tesseract.js'),
    import('tesseract.js/dist/worker.min.js?url'),
    import('tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url'),
  ])
  localTesseract = {
    createWorker: tesseract.createWorker,
    workerPath: workerModule.default,
    corePath: coreModule.default,
  }
  return localTesseract
}

const normalise = (text) =>
  String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[|]/g, 'I')
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Parse total screen time from OCR output. Returns integer minutes.
 * Supports "4h 12m", "4 hr 12 min", "4:12", "1 d 2 h", "Screen time 3 hours".
 */
export function parseScreenTime(rawText) {
  const text = normalise(rawText)
  if (!text) return { minutes: null, confidence: 0, candidates: [], text }

  const candidates = []
  const add = (minutes, confidence, matched) => {
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 100_000) return
    candidates.push({ minutes: Math.round(minutes), confidence, matched })
  }

  // "1 d 2 h 30 m" / "4h 12m" / "4 hr 12 min"
  const dayHourMinute =
    /(\d{1,2})\s*(?:d|day|days)\s*(?:(\d{1,2})\s*(?:h|hr|hrs|hour|hours))?\s*(?:(\d{1,2})\s*(?:m|min|mins|minute|minutes))?/gi
  let match
  while ((match = dayHourMinute.exec(text))) {
    const days = Number(match[1])
    const hours = Number(match[2] || 0)
    const minutes = Number(match[3] || 0)
    add(days * 1440 + hours * 60 + minutes, 0.95, match[0])
  }

  const hourMinute =
    /(\d{1,3})\s*(?:h|hr|hrs|hour|hours)(?:\s*[:.]?\s*(\d{1,2}))?\s*(?:m|min|mins|minute|minutes)?/gi
  while ((match = hourMinute.exec(text))) {
    const hours = Number(match[1])
    const minutes = Number(match[2] || 0)
    if (hours > 200 || minutes > 59) continue
    add(hours * 60 + minutes, 0.9, match[0])
  }

  // Clock style (only when it is clearly a total/screen-time line).
  const clock = /(?:screen\s*time|total|wellbeing|average)[^\d]{0,24}(\d{1,2}):(\d{2})/gi
  while ((match = clock.exec(text))) {
    const hours = Number(match[1])
    const minutes = Number(match[2])
    if (minutes > 59) continue
    add(hours * 60 + minutes, 0.92, match[0])
  }

  // "Screen time ... 4" (whole hours only) fallback.
  if (candidates.length === 0) {
    const bare = /(?:screen\s*time|total)[^\d]{0,30}(\d{1,3})\s*(?:h|hours)?/i.exec(text)
    if (bare) add(Number(bare[1]) * 60, 0.55, bare[0])
  }

  if (candidates.length === 0) {
    return { minutes: null, confidence: 0, candidates: [], text }
  }

  // The total is normally the largest duration on a Screen Time summary, since
  // the screen also lists per-app durations. Merge duplicate readings.
  const best = candidates
    .slice()
    .sort((a, b) => b.minutes - a.minutes || b.confidence - a.confidence)[0]

  return {
    minutes: best.minutes,
    confidence: best.confidence,
    candidates,
    text,
    matched: best.matched,
  }
}

export function formatMinutes(minutes) {
  const value = Math.max(0, Math.round(Number(minutes) || 0))
  const hours = Math.floor(value / 60)
  const rest = value % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

export function formatHours(minutes) {
  return (Math.max(0, Number(minutes) || 0) / 60).toFixed(1)
}

/**
 * Run OCR. Progress callback receives {status, progress, label}.
 */
export async function readScreenTimeFromImage(file, onProgress = () => {}) {
  const { createWorker, workerPath, corePath } = await loadTesseract()

  onProgress({ status: 'loading', progress: 0.02, label: 'Loading the reader…' })
  const worker = await createWorker('eng', 1, {
    workerPath,
    corePath,
    langPath: '/tessdata',
    gzip: true,
    logger: (message) => {
      const value =
        typeof message.progress === 'number' ? Math.min(1, Math.max(0, message.progress)) : 0
      onProgress({
        status: message.status || 'working',
        progress: 0.05 + value * 0.8,
        label:
          message.status === 'recognizing text'
            ? 'Reading the numbers…'
            : 'Waking up the reader…',
      })
    },
  })

  try {
    const { data } = await worker.recognize(file)
    onProgress({ status: 'parsing', progress: 0.92, label: 'Comparing the numbers…' })
    const parsed = parseScreenTime(data?.text ?? '')
    return { ...parsed, rawText: data?.text ?? '' }
  } finally {
    await worker.terminate().catch(() => {})
    onProgress({ status: 'done', progress: 1, label: 'Done' })
  }
}

export const __test = { normalise }
