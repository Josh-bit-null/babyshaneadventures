/** 
 * Local PDF text extraction. Nothing is uploaded until the extracted text is 
 * posted to our own server for Gemini question generation. 
 */
export async function extractPdfText(file, onProgress = () => {}) {
  if (!file) throw new Error('Choose a PDF first.')
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
    throw new Error('That is not a PDF. Drop a syllabus or slide deck.')
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('That PDF is over 20 MB. Try exporting a smaller version.')
  }

  onProgress({ stage: 'loading', progress: 0.04, label: 'Loading the PDF reader…' })
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const buffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: buffer })
  const document = await loadingTask.promise

  try {
    const totalPages = document.numPages
    if (totalPages > 30) {
      throw new Error(`That PDF has ${totalPages} pages. The maximum is 30 pages.`)
    }

    const chunks = []
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      onProgress({
        stage: 'extracting',
        progress: 0.08 + (pageNumber / totalPages) * 0.86,
        label: `Reading page ${pageNumber} of ${totalPages}…`,
      })
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (pageText) chunks.push(pageText)
      page.cleanup()
    }

    const text = chunks.join('\n\n').trim()
    if (text.replace(/\s/g, '').length < 200) {
      throw new Error('That PDF has almost no selectable text. Scanned slides need OCR before they can become a quiz.')
    }
    onProgress({ stage: 'done', progress: 1, label: 'Text extracted' })
    return { text, pageCount: totalPages, readPages: totalPages }
  } finally {
    await document.destroy()
  }
}
