import { useApp } from '../context/AppContext'
import { callWorker, callWorkerText } from '../lib/api'
import { buildPass1aPrompt, buildPass1bPrompt } from '../prompts/pass1'
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
    setProcessingLabel('Reading the page…')

    // DEBUG — checkpoint 1
    console.log('[AralMate DEBUG] runPass1 started')
    console.log('[AralMate DEBUG] image state — base64 length:', currentImageBase64?.length ?? 'NULL', '| type:', currentImageType ?? 'NULL')
    console.log('[AralMate DEBUG] selected subject:', selectedSubject)

    // DEBUG — checkpoint 2
    console.log('[AralMate DEBUG] calling fetchContext…')
    const studentContext = await fetchContext()
    console.log('[AralMate DEBUG] fetchContext returned:', studentContext ? 'ok' : 'null')

    try {
      // DEBUG — checkpoint 3
      console.log('[AralMate DEBUG] building Pass 1A prompt…')
      // ── Step 1A: Extract text from image ──────────────────────────
      const extractionPrompt = buildPass1aPrompt()

      // DEBUG — checkpoint 4
      console.log('[AralMate DEBUG] calling callWorker for Pass 1A…')
      const r1a = await callWorker(
        extractionPrompt,
        2000,
        currentImageBase64,
        currentImageType
      )
      // DEBUG — checkpoint 5
      console.log('[AralMate DEBUG] callWorker Pass 1A raw response length:', r1a?.length ?? 'NULL')
      console.log('[AralMate DEBUG] callWorker Pass 1A raw (first 300 chars):', r1a?.slice(0, 300))

      // Strip markdown fences then attempt parse.
      // If the response was truncated mid-JSON, attempt a best-effort repair
      // by closing any open string and the JSON object before parsing.
      let cleaned = r1a.replace(/```json|```/g, '').trim()
      let extraction
      try {
        extraction = JSON.parse(cleaned)
      } catch {
        // Best-effort repair: close open string + close object
        console.warn('[AralMate DEBUG] JSON parse failed on raw response, attempting repair…')
        let repaired = cleaned
        // If there's an odd number of unescaped quotes, close the string
        const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length
        if (quoteCount % 2 !== 0) repaired += '"'
        // Close the object if not already closed
        if (!repaired.trimEnd().endsWith('}')) repaired += '}'
        try {
          extraction = JSON.parse(repaired)
          console.warn('[AralMate DEBUG] JSON repair succeeded')
          // Mark as poor quality since we had a truncated response
          extraction.image_quality = extraction.image_quality || 'poor'
          extraction.quality_note = 'Response was truncated — extracted text may be incomplete.'
        } catch (repairErr) {
          console.error('[AralMate DEBUG] JSON repair also failed:', repairErr.message)
          throw new Error('Kimi returned an incomplete response. Please try again.')
        }
      }
      console.log('[AralMate] Step 1A extraction:', JSON.stringify(extraction, null, 2))

      // Unreadable image — go back to upload
      if (!extraction.can_read || extraction.image_quality === 'unreadable') {
        setImageQualityNote({
          type: 'error',
          message: `😕 Alon can't read this image clearly. ${extraction.quality_note} Please try taking a clearer photo with better lighting.`
        })
        setAppScreen('upload')
        return
      }

      // Poor but readable — show warning, continue
      if (extraction.image_quality === 'poor') {
        setImageQualityNote({
          type: 'warn',
          message: `⚠️ ${extraction.quality_note} Alon will do his best, but a clearer photo would help!`
        })
      }

      setProcessingStep(2)
      setProcessingLabel('Understanding the content…')
      console.log('[AralMate] Step 1B input text:', extraction.extracted_text)

      // ── Step 1B: Analyze extracted text ───────────────────────────
      const analysisPrompt = buildPass1bPrompt(
        extraction.extracted_text,
        selectedSubject,
        studentName,
        studentContext
      )
      const r1b = await callWorkerText(analysisPrompt, 800)
      const check = JSON.parse(r1b.replace(/```json|```/g, '').trim())
      console.log('[AralMate] Step 1B analysis:', JSON.stringify(check, null, 2))

      // Merge extraction fields into check
      check.extracted_text = extraction.extracted_text
      check.image_quality  = extraction.image_quality
      check.quality_note   = extraction.quality_note
      check.can_read       = extraction.can_read

      setProcessingLabel(`Topic found: ${check.topic}`)
      await sleep(600)

      // Initialise confirmed values from analysis
      setPendingCheck(check)
      setConfirmedContentType(check.content_type || 'unknown')
      setConfirmedSubject(check.subject_detected || selectedSubject)
      setConfirmedGrade(check.grade_level_estimate || 'Grade 4')

      setAppScreen('confirming')

    } catch (err) {
      // DEBUG — catch block
      console.error('[AralMate DEBUG] runPass1 CATCH:', err.message)
      console.error('[AralMate DEBUG] runPass1 CATCH full error:', err)
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

      // Pass 2 token budget: 4000 tokens.
      // The full lesson JSON schema is large — overview (6-8 sentences), worked example,
      // 4 key points, key terms, 5 quiz questions with options and explanations.
      // 2500 was too tight for dense pages and caused silent truncation + parse failure.
      const r2 = isTextMode
        ? await callWorkerText(prompt, 4000)
        : await callWorker(prompt, 4000, currentImageBase64, currentImageType)
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
      await saveLesson(lesson, check, confirmedGrade)
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

      const prompt = buildFlashcardPrompt(check, subject, studentContext, lessonSummary, check.extracted_text || '')
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
