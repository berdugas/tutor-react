import { useApp } from '../context/AppContext'
import { callWorker } from '../lib/api'
import { buildPass1Prompt } from '../prompts/pass1'
import { buildPass2Prompt } from '../prompts/pass2'

function validateLessonData(data) {
  const errors = []
  if (!data.lesson) errors.push('lesson block missing')
  if (!data.lesson?.title) errors.push('lesson.title missing')
  if (!data.lesson?.overview) errors.push('lesson.overview missing')
  if (!Array.isArray(data.quiz) || data.quiz.length < 3)
    errors.push(`quiz has ${data.quiz?.length || 0} questions (need at least 3)`)
  if (!Array.isArray(data.flashcards) || data.flashcards.length < 4)
    errors.push(`flashcards has ${data.flashcards?.length || 0} cards (need at least 4)`)
  if (!Array.isArray(data.lesson?.key_terms) || data.lesson.key_terms.length < 1)
    errors.push('key_terms missing or empty')
  return errors
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export function useAnalysis() {
  const {
    studentName, selectedSubject,
    currentImageBase64, currentImageType,
    setPendingCheck, setConfirmedContentType,
    setConfirmedSubject, setConfirmedGrade,
    confirmedSubject, confirmedContentType, confirmedGrade,
    pendingCheck, setLessonData, earnTala,
    setAppScreen, setProcessingStep, setProcessingLabel,
    setImageQualityNote
  } = useApp()

  async function runPass1() {
    setAppScreen('processing')
    setProcessingStep(1)
    setProcessingLabel('Checking image quality…')

    const prompt = buildPass1Prompt(studentName, selectedSubject)

    try {
      const r1 = await callWorker(prompt, 800, currentImageBase64, currentImageType)
      const check = JSON.parse(r1.replace(/```json|```/g, '').trim())

      setProcessingStep(2)

      // Unreadable image — go back to upload
      if (!check.can_read || check.image_quality === 'unreadable') {
        setImageQualityNote({
          type: 'error',
          message: `😕 Alon can't read this image clearly. ${check.quality_note} Please try taking a clearer photo with better lighting.`
        })
        setAppScreen('upload')
        return
      }

      // Poor but readable — show warning, continue
      if (check.image_quality === 'poor') {
        setImageQualityNote({
          type: 'warn',
          message: `⚠️ ${check.quality_note} Alon will do his best, but a clearer photo would help!`
        })
      }

      setProcessingLabel(`Topic found: ${check.topic}`)
      await sleep(600)

      // Initialise confirmed values from Pass 1 detection
      setPendingCheck(check)
      setConfirmedContentType(check.content_type || 'unknown')
      setConfirmedSubject(check.subject_detected || selectedSubject)
      setConfirmedGrade(check.grade_level_estimate || 'Grade 4')

      setAppScreen('confirming')

    } catch (err) {
      setProcessingLabel(`Error: ${err.message}`)
      setAppScreen('error')
      setTimeout(() => setAppScreen('upload'), 3000)
    }
  }

  async function runPass2() {
    // Merge confirmed user values onto the check object
    const check = {
      ...pendingCheck,
      content_type: confirmedContentType,
      subject_detected: confirmedSubject,
      grade_level_estimate: confirmedGrade
    }

    setAppScreen('processing')
    setProcessingStep(3)
    setProcessingLabel('Reading the content carefully…')

    try {
      await sleep(400)
      setProcessingStep(4)
      setProcessingLabel('Writing your lesson summary…')

      const prompt = buildPass2Prompt(check, studentName, confirmedSubject)
      const r2 = await callWorker(prompt, 2500, currentImageBase64, currentImageType)
      const raw = r2.replace(/```json|```/g, '').trim()
      const lesson = JSON.parse(raw)
      lesson._check = check

      const errors = validateLessonData(lesson)
      if (errors.length > 0) {
        throw new Error(`Alon's response was incomplete (${errors.join(', ')}). Please try again.`)
      }

      setProcessingStep(5)
      setProcessingLabel('Building quiz & flashcards…')
      await sleep(500)

      setLessonData(lesson)
      earnTala(20)
      setAppScreen('results')

    } catch (err) {
      setProcessingLabel(`Error: ${err.message}`)
      setAppScreen('error')
      setTimeout(() => setAppScreen('upload'), 3000)
    }
  }

  return { runPass1, runPass2 }
}
