import { useApp } from '../context/AppContext'
import { callWorker, callWorkerText } from '../lib/api'
import { buildPass1Prompt } from '../prompts/pass1'
import { buildPass2Prompt } from '../prompts/pass2'
import { buildFlashcardPrompt } from '../prompts/flashcards'
import { useSession } from './useSession'
import { useStudentContext } from './useStudentContext'
import { useRag } from './useRag'

function validateLessonData(data) {
  const errors = []
  if (!data.lesson) errors.push('lesson block missing')
  if (!data.lesson?.title) errors.push('lesson.title missing')
  if (!data.lesson?.overview) errors.push('lesson.overview missing')
  if (!Array.isArray(data.quiz) || data.quiz.length < 3)
    errors.push(`quiz has ${data.quiz?.length || 0} questions (need at least 3)`)
  if (!Array.isArray(data.lesson?.key_terms) || data.lesson.key_terms.length < 1)
    errors.push('key_terms missing or empty')
  return errors
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export function useAnalysis() {
  const { saveLesson } = useSession()
  const { fetchContext } = useStudentContext()
  const { fetchCurriculumChunk } = useRag()

  const {
    studentName, selectedSubject,
    currentImageBase64, currentImageType,
    setPendingCheck, setConfirmedContentType,
    setConfirmedSubject, setConfirmedGrade,
    confirmedSubject, confirmedContentType, confirmedGrade,
    pendingCheck, setLessonDataAndReset, setFlashcards,
    setFlashcardsLoading, earnTala,
    setAppScreen, setProcessingStep, setProcessingLabel,
    setImageQualityNote
  } = useApp()

  async function runPass1() {
    setAppScreen('processing')
    setProcessingStep(1)
    setProcessingLabel('Checking image quality…')

    // Fetch student context for Pass 1 prompt
    const studentContext = await fetchContext()
    const prompt = buildPass1Prompt(studentName, selectedSubject, studentContext)

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

  async function runPass1Text(topic) {
    const studentContext = await fetchContext()

    const check = {
      topic,
      subject_detected:      selectedSubject,
      content_type:          'text_input',
      grade_level_estimate:  studentContext?.gradeLevel || 'Grade 4',
      language_detected:     'Filipino',
      key_vocabulary:        [],
      competency_clues:      [],
      content_density:       'moderate',
      focus_area:            topic,
      unclear_parts:         '',
      can_read:              true,
      image_quality:         'good'
    }

    setPendingCheck(check)
    setConfirmedContentType('text_input')
    setConfirmedSubject(selectedSubject)
    setConfirmedGrade(studentContext?.gradeLevel || 'Grade 4')
    setAppScreen('confirming')
  }

  async function runPass2() {
    // Merge confirmed user values onto the check object
    const check = {
      ...pendingCheck,
      content_type: confirmedContentType,
      subject_detected: confirmedSubject,
      grade_level_estimate: confirmedGrade
    }

    const isTextMode = check.content_type === 'text_input'

    setAppScreen('processing')
    setProcessingStep(3)
    setProcessingLabel('Reading the content carefully…')

    try {
      await sleep(400)
      setProcessingStep(4)
      setProcessingLabel('Writing your lesson summary…')

      // Fetch context fresh -- ref pattern was unreliable across re-renders
      const studentContext = await fetchContext()

      // Fetch curriculum chunk from RAG -- non-blocking, returns null if no match
      // Use confirmedGrade (user-verified on confirmation card) for accurate retrieval
      const confirmedGradeNum = parseInt((confirmedGrade || '').replace('Grade ', '')) || null
      const profileGradeNum   = parseInt((studentContext?.gradeLevel || '').replace('Grade ', '')) || 4
      const gradeNum = confirmedGradeNum || profileGradeNum
      const curriculumChunk = await fetchCurriculumChunk(
        check.topic,
        check.subject_detected || confirmedSubject,
        gradeNum,
        isTextMode
      )

      const prompt = buildPass2Prompt(check, studentName, confirmedSubject, studentContext, curriculumChunk, isTextMode)
      const r2 = isTextMode
        ? await callWorkerText(prompt, 2500)
        : await callWorker(prompt, 2500, currentImageBase64, currentImageType)
      const raw = r2.replace(/```json|```/g, '').trim()
      const lesson = JSON.parse(raw)
      lesson._check = check

      const errors = validateLessonData(lesson)
      if (errors.length > 0) {
        throw new Error(`Alon's response was incomplete (${errors.join(', ')}). Please try again.`)
      }

      setProcessingStep(5)
      setProcessingLabel('Building quiz…')
      await sleep(500)

      // Show results immediately — flashcards will load async
      setLessonDataAndReset(lesson)
      earnTala(20)
      await saveLesson(lesson, check)
      setAppScreen('results')

      // Generate flashcards as a separate focused call
      // This gives Kimi full attention for word selection and definitions
      generateFlashcards(check, confirmedSubject, studentContext, lesson)

    } catch (err) {
      setProcessingLabel(`Error: ${err.message}`)
      setAppScreen('error')
      setTimeout(() => setAppScreen('upload'), 3000)
    }
  }

  async function generateFlashcards(check, subject, studentContext, lesson) {
    setFlashcardsLoading(true)
    try {
      // Build a concise lesson summary for flashcard context
      const lessonSummary = [
        lesson.lesson?.title || '',
        lesson.lesson?.overview || '',
        lesson.lesson?.key_points?.join(' ') || ''
      ].filter(Boolean).join(' ').slice(0, 500)

      const prompt = buildFlashcardPrompt(check, subject, studentContext, lessonSummary)
      const raw = await callWorkerText(prompt, 600)
      const cards = JSON.parse(raw.replace(/```json|```/g, '').trim())

      if (Array.isArray(cards) && cards.length >= 4) {
        setFlashcards(cards)
        console.log(`[AralMate] Flashcards: generated ${cards.length} cards`)
      } else {
        console.warn('[AralMate] Flashcards: invalid response, keeping empty')
      }
    } catch (err) {
      console.error('[AralMate] Flashcards: generation failed:', err.message)
    } finally {
      setFlashcardsLoading(false)
    }
  }

  return { runPass1, runPass1Text, runPass2 }
}
