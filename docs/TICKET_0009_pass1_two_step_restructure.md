# TICKET_0009 — Pass 1 Two-Step Restructure: Extract Then Analyze

**Created by:** Product Lead
**Date:** 2026-04-14
**Priority:** High
**Depends on:** TICKET_0007 complete (flashcard separate service)
**Supersedes:** TICKET_0008 (calamanCy microservice — paused, not needed for MVP)

## Background

The vocabulary extraction problem in Pass 1 was misdiagnosed. The issue is not
that Kimi doesn't understand Filipino — it does. When asked directly to extract
text from the same blurry worksheet image, Kimi produced a perfect, fully
structured transcription including the exact title "Pag-iiba sa Pangungusap at
Parirala", both table columns, all 5 questions, and the grammatical analysis.

The problem is that the current Pass 1 asks Kimi to do too many things
simultaneously from a blurry image:
1. Read the image (OCR-like vision)
2. Assess quality
3. Identify topic, subject, grade
4. Extract vocabulary
5. Assess content density
6. Return structured JSON

When overloaded, Kimi rushes vocabulary extraction and picks words from the
nearest example sentences (alkansiya, Zarah, pera) instead of the conceptual
terms (pangungusap, parirala, diwa).

The fix is to split Pass 1 into two focused Kimi calls:

Step 1A — Kimi reads the image and returns ONLY the extracted text.
           One job. Full attention. Perfect transcription.

Step 1B — Kimi analyzes the clean extracted text (not the image) and returns
           the structured JSON. Working from clean text instead of a blurry
           image, Kimi makes accurate topic and vocabulary decisions.

This approach:
- Requires no new services or dependencies
- Uses the same Kimi model already in production
- Fixes vocabulary quality at the source
- Improves topic extraction accuracy
- Adds ~2-3 seconds to scan time (acceptable)

---

## What Changes

### Files to modify:
- `src/prompts/pass1.js` — split into two prompt builders
- `src/hooks/useAnalysis.js` — runPass1() becomes two sequential calls
- `src/prompts/flashcards.js` — use extracted_text for word pool (minor update)

### Files to NOT modify:
- `src/prompts/pass2.js`
- `src/prompts/flashcards.js` (except minor update noted below)
- `src/context/AppContext.jsx`
- `src/hooks/useSession.js`
- `src/hooks/useRag.js`
- `src/lib/api.js`
- `worker/index.js`

---

## Part 1 — New prompt builders in `src/prompts/pass1.js`

Replace the single `buildPass1Prompt` function with two functions:
`buildPass1aPrompt` and `buildPass1bPrompt`.

### `buildPass1aPrompt` — Text extraction only

```js
export function buildPass1aPrompt() {
  return `You are an expert at reading Philippine elementary school textbook pages.

Your ONLY job is to transcribe all readable text from this image.

READING RULES:
- Read ONLY dark, clearly printed text that reads left to right
- IGNORE all faint, reversed, or mirrored text (bleed-through from reverse side)
- Preserve the structure: titles, table columns, numbered lists, questions
- Include ALL text you can read — headers, labels, table content, questions
- Do NOT analyze, summarize, or interpret — just transcribe

Respond ONLY with a JSON object:
{
  "can_read": true | false,
  "image_quality": "good" | "poor" | "unreadable",
  "quality_note": "One sentence if poor or unreadable. Empty string if good.",
  "extracted_text": "All readable text from the image, preserving structure. Empty string if unreadable."
}`
}
```

### `buildPass1bPrompt` — Analysis from extracted text

```js
export function buildPass1bPrompt(extractedText, selectedSubject, studentName, studentContext) {
  const grade = studentContext?.gradeLevel || 'Grade 4'

  const profileNote = studentContext
    ? `Student grade: ${studentContext.gradeLevel} | Quarter: ${studentContext.schoolQuarter} | School: ${studentContext.schoolType}`
    : 'Student grade: Grade 4 | Quarter: 1 | School: private'

  const historyNote = (studentContext && studentContext.recentTopics.length > 0)
    ? `Student's recent lesson history (last ${studentContext.recentTopics.length} scans):
${studentContext.recentTopics.map((t, i) => `  - ${studentContext.recentSubjects[i]}: ${t}`).join('\n')}
Use this to understand what the student has been studying.`
    : ''

  return `You are an expert in the Philippine DepEd K-12 curriculum, analyzing
extracted text from a school material page for ${studentName}, a ${grade} student.

The student selected subject: ${selectedSubject}
${profileNote}
${historyNote}

Here is the COMPLETE TEXT extracted from the page:
---
${extractedText}
---

Analyze this text carefully and fill the fields below.

TOPIC EXTRACTION RULES:
- The topic is the CONCEPT being taught, not the section header or category label
- Section headers like KASANAYANG PANGWIKA, PAGBASA, GRAMATIKA are category
  labels — NEVER use these as the topic
- For exercise pages: the topic is what the exercise TEACHES. If students compare
  phrases vs sentences, the topic is "Pagkakaiba ng Pangungusap at Parirala"
- For two-column exercises (Pangkat A / Pangkat B): extract the CONCEPT being
  compared across both columns, not just one column's content
- The specific exercise title (bold line below the section header) is usually
  the best source for the topic
- Grade level: assess from CONCEPT difficulty, not example sentence vocabulary

VOCABULARY EXTRACTION RULES:
- Extract words that are CENTRAL to what this lesson teaches
- Prioritize grammar terms, subject-specific terms, and key concept words
- Do NOT include proper nouns (names of people: Zarah, Juan, Maria, etc.)
- Do NOT include common particles and articles (ang, ng, mga, si, sina, ay, at)
- Do NOT include words that only appear as example sentence subjects/objects
  unless they are the concept being taught
- The vocabulary list should help a ${grade} student understand this topic

Respond ONLY with a valid JSON object. No markdown, no extra text:

{
  "content_type": "narrative_story" | "worksheet" | "vocabulary_list" | "textbook_page" | "notes" | "poem" | "dialogue" | "unknown",
  "subject_detected": "Filipino" | "Araling Panlipunan" | "Mathematics" | "Science" | "Mother Tongue" | "unclear",
  "subject_confidence": "high" | "medium" | "low",
  "grade_level_estimate": "Grade 1-2" | "Grade 3" | "Grade 4" | "Grade 5-6" | "unclear",
  "grade_level_signals": "1-2 clues from the concept difficulty, not example vocabulary. Max 20 words.",
  "title_detected": "The specific exercise title or story title from the text, exactly as written. NOT the section header. Empty string if none.",
  "topic": "The main concept in 4-8 words from your analysis. Must reflect what the exercise TEACHES. Examples: 'Pagkakaiba ng Pangungusap at Parirala', 'Mga Uri ng Pang-uri', 'Multiplication of Fractions'.",
  "language_detected": "Filipino" | "English" | "Mixed",
  "competencies_present": ["Up to 4 specific learning competencies using DepEd terminology. Examples: 'pagkilala ng pangungusap at parirala', 'pang-uri', 'pag-unawa sa binasa'."],
  "key_vocabulary": ["Up to 8 Filipino or subject-specific words CENTRAL to this lesson's concept. Must follow the vocabulary extraction rules above. No proper nouns. No particles."],
  "content_summary": "One sentence describing what this page teaches, written for a teacher. Max 25 words.",
  "focus_area": "The single most important concept for a struggling ${grade} reader. Be specific. Max 20 words.",
  "content_density": "simple" | "moderate" | "dense"
}`
}
```

---

## Part 2 — Update `runPass1()` in `src/hooks/useAnalysis.js`

Replace the single-call `runPass1()` with a two-step version.

```js
async function runPass1() {
  setAppScreen('processing')
  setProcessingStep(1)
  setProcessingLabel('Reading the page…')

  const studentContext = await fetchContext()

  try {
    // ── Step 1A: Extract text from image ──────────────────────────
    const extractionPrompt = buildPass1aPrompt()
    const r1a = await callWorker(
      extractionPrompt,
      600,
      currentImageBase64,
      currentImageType
    )
    const extraction = JSON.parse(r1a.replace(/```json|```/g, '').trim())

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

    // ── Step 1B: Analyze extracted text ───────────────────────────
    const analysisPrompt = buildPass1bPrompt(
      extraction.extracted_text,
      selectedSubject,
      studentName,
      studentContext
    )
    const r1b = await callWorkerText(analysisPrompt, 800)
    const check = JSON.parse(r1b.replace(/```json|```/g, '').trim())

    // Merge extraction fields into check
    check.extracted_text  = extraction.extracted_text
    check.image_quality   = extraction.image_quality
    check.quality_note    = extraction.quality_note
    check.can_read        = extraction.can_read

    setProcessingLabel(`Topic found: ${check.topic}`)
    await sleep(600)

    // Initialise confirmed values from analysis
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
```

Key differences from current `runPass1()`:
- Step 1A uses `callWorker` (with image) — extraction only, 600 max tokens
- Step 1B uses `callWorkerText` (no image) — analysis from clean text, 800 max tokens
- `check.extracted_text` is stored on the check object for use by flashcard generation
- Processing labels updated: "Reading the page…" then "Understanding the content…"

---

## Part 3 — Update `generateFlashcards()` in `src/hooks/useAnalysis.js`

The flashcard prompt already uses `check.key_vocabulary` and a lesson summary.
With the new two-step Pass 1, `check.extracted_text` is now available as an
additional input. Update `generateFlashcards` to include it:

```js
async function generateFlashcards(check, subject, studentContext, lesson) {
  setFlashcardsLoading(true)
  try {
    const lessonSummary = [
      lesson.lesson?.title || '',
      lesson.lesson?.overview || '',
      lesson.lesson?.key_points?.join(' ') || ''
    ].filter(Boolean).join(' ').slice(0, 500)

    // extracted_text is now available from the two-step Pass 1
    // Pass it to the flashcard prompt for richer word pool context
    const prompt = buildFlashcardPrompt(
      check,
      subject,
      studentContext,
      lessonSummary,
      check.extracted_text || ''   // ← new parameter
    )
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
```

---

## Part 4 — Update `src/prompts/flashcards.js`

Add `extractedText` as a fifth parameter to `buildFlashcardPrompt`. Use it as
additional context for word selection — the raw extracted text shows exactly
which words appeared in the student's actual material.

```js
export function buildFlashcardPrompt(check, selectedSubject, studentContext, lessonSummary, extractedText = '') {

  const extractedWordsNote = extractedText
    ? `Full text from the student's material (for word selection context):
${extractedText.slice(0, 800)}`
    : ''

  return `You are a Filipino elementary school vocabulary expert...
  // ... rest of existing prompt unchanged ...
  ${extractedWordsNote}
  // ... rest of prompt ...`
}
```

---

## Import updates in `useAnalysis.js`

Add `buildPass1aPrompt` and `buildPass1bPrompt` to the import:

```js
// Before:
import { buildPass1Prompt } from '../prompts/pass1'

// After:
import { buildPass1aPrompt, buildPass1bPrompt } from '../prompts/pass1'
```

Remove the old `buildPass1Prompt` import — it is no longer used.

---

## Processing Step Labels Update

The processing screen currently shows 5 steps. With two-step Pass 1, update
the step labels in `useAnalysis.js`:

| Step | Old label | New label |
|---|---|---|
| 1 | Checking image quality… | Reading the page… |
| 2 | Identifying the lesson topic… | Understanding the content… |
| 3 | Reading the content carefully… | (unchanged) |
| 4 | Writing your lesson summary… | (unchanged) |
| 5 | Building quiz… | (unchanged) |

---

## Acceptance Criteria

- [ ] Scan of the Pangungusap/Parirala worksheet returns `topic` containing
      "Pangungusap" and "Parirala" (not "alkansiya" or a generic title)
- [ ] `key_vocabulary` contains `pangungusap`, `parirala`, `diwa` and does NOT
      contain `Zarah`, `Impong Sela`, `ang`, `sina`, or `pera`
- [ ] `check.extracted_text` is populated after a photo scan and contains
      the full text read from the image
- [ ] Blurry/unreadable image still returns correct error and goes back to upload
- [ ] Poor quality image still shows the yellow warning and continues
- [ ] Text input mode (`runPass1Text`) is completely unchanged
- [ ] Pass 2 receives the enriched check object and generates a correct lesson
- [ ] Flashcard generation receives `extracted_text` and produces better word selection
- [ ] No console errors on normal scan completion
- [ ] Processing screen shows "Reading the page…" then "Understanding the content…"

## Test Cases

**Test 1 — Pangungusap/Parirala worksheet (the problem case)**
Expected topic: "Pagkakaiba ng Pangungusap at Parirala" or similar
Expected key_vocabulary: pangungusap, parirala, diwa, lipon, salita
Must NOT contain: Zarah, Impong Sela, alkansiya, ang, sina

**Test 2 — Clear Math worksheet**
Two-step should still work correctly for non-Filipino content.
Step 1B receives clean English/Math text and analyzes correctly.

**Test 3 — Blurry/unreadable image**
Step 1A detects unreadable → returns to upload screen.
Step 1B never runs.

**Test 4 — Text input mode**
`runPass1Text` is unchanged. Confirm it still goes directly to confirming screen.

## Notes

- Step 1B uses `callWorkerText` (no image) because it's analyzing clean text,
  not an image. This is intentional and correct — the image was already read
  in Step 1A.
- The 600 token limit for Step 1A is sufficient for text extraction only.
  The 800 token limit for Step 1B is sufficient for the structured analysis.
- Total Pass 1 token usage is similar to before (was 800, now 600 + 800 = 1400)
  but spread across two focused calls. The quality improvement justifies the
  slight increase.
- `check.unclear_parts` is removed from the Step 1B output since image quality
  assessment happens in Step 1A. The `quality_note` from Step 1A covers this.
- TICKET_0008 (calamanCy microservice) is paused. The Render service at
  https://tutor-nlp.onrender.com remains deployed but is not used by AralMate
  until a future ticket determines if calamanCy adds value beyond this fix.
