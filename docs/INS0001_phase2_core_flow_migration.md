# INS0001 — Phase 2: Core Flow Migration

**Project:** AralMate  
**Branch:** `phase-2-core-flow` from `main` in `D:\tutor-react\aralmate`  
**Prerequisite:** Phase 1 verification gate passed. `fastidious-trifle-8e650c.netlify.app` is live.  
**Goal:** The full upload → Pass 1 → confirmation → Pass 2 → lesson flow works in React. By the end of Phase 2, a complete scan of "Malinis si Tom" must produce a lesson, quiz, and flashcards identical in quality to the HTML version.

---

## Architecture Overview

Before writing any code, understand the three layers:

| Layer | What it does |
|---|---|
| **AppContext** | Holds all shared state — studentName, tala, selectedSubject, image data, lessonData, appScreen, etc. |
| **useAnalysis hook** | Owns the async scan flow: Pass 1 → confirmation state → Pass 2 → results |
| **UI Components** | Receive state via context/props and render it. Never own business logic. |

The `appScreen` value drives what is rendered:

```
'name' → NameScreen
'upload' → UploadZone
'processing' → ProcessingState
'confirming' → ConfirmationCard
'results' → LessonOutput
'error' → error state (auto-resets after 3s)
```

---

## File Structure to Create

```
src/
├── context/
│   └── AppContext.jsx          ← Step 1
├── lib/
│   ├── api.js                  ← Step 2
│   └── constants.js            ← Step 9 (labels/maps)
├── prompts/
│   ├── pass1.js                ← Step 3
│   └── pass2.js                ← Step 4
├── hooks/
│   └── useAnalysis.js          ← Step 5
├── components/
│   ├── NameScreen/
│   │   ├── NameScreen.jsx      ← Step 6
│   │   └── NameScreen.module.css
│   ├── UploadZone/
│   │   ├── UploadZone.jsx      ← Step 7
│   │   ├── UploadZone.module.css
│   │   └── ProcessingState.jsx ← Step 8
│   ├── ConfirmationCard/
│   │   ├── ConfirmationCard.jsx ← Step 9
│   │   └── ConfirmationCard.module.css
│   ├── LessonView/
│   │   └── LessonView.jsx      ← Step 10
│   ├── QuizView/
│   │   └── QuizView.jsx        ← Step 10
│   ├── FlashcardView/
│   │   └── FlashcardView.jsx   ← Step 10
│   └── LessonOutput/
│       └── LessonOutput.jsx    ← Step 10
└── App.jsx                     ← Step 11 (update)
```

---

## Step 1 — Create `AppContext`

**File:** `src/context/AppContext.jsx`

```jsx
import { createContext, useContext, useState } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [studentName, setStudentName]                       = useState('Estudyante')
  const [tala, setTala]                                     = useState(145)
  const [selectedSubject, setSelectedSubject]               = useState(null)
  const [currentImageBase64, setImageBase64]                = useState(null)
  const [currentImageType, setImageType]                    = useState(null)
  const [lessonData, setLessonData]                         = useState(null)
  const [isSimplified, setIsSimplified]                     = useState(false)
  const [currentCardIndex, setCardIndex]                    = useState(0)
  const [cardFlipped, setCardFlipped]                       = useState(false)
  const [quizAnswered, setQuizAnswered]                     = useState({})
  const [pendingCheck, setPendingCheck]                     = useState(null)
  const [confirmedContentType, setConfirmedContentType]     = useState(null)
  const [confirmedSubject, setConfirmedSubject]             = useState(null)
  const [confirmedGrade, setConfirmedGrade]                 = useState(null)
  const [appScreen, setAppScreen]                           = useState('name')
  const [processingStep, setProcessingStep]                 = useState(1)
  const [processingLabel, setProcessingLabel]               = useState('')
  const [imageQualityNote, setImageQualityNote]             = useState(null)

  const earnTala = (n) => setTala(prev => prev + n)

  const resetApp = () => {
    setSelectedSubject(null)
    setImageBase64(null)
    setImageType(null)
    setLessonData(null)
    setIsSimplified(false)
    setCardIndex(0)
    setCardFlipped(false)
    setQuizAnswered({})
    setPendingCheck(null)
    setConfirmedContentType(null)
    setConfirmedSubject(null)
    setConfirmedGrade(null)
    setImageQualityNote(null)
    setAppScreen('upload')
  }

  return (
    <AppContext.Provider value={{
      studentName, setStudentName,
      tala, earnTala,
      selectedSubject, setSelectedSubject,
      currentImageBase64, setImageBase64,
      currentImageType, setImageType,
      lessonData, setLessonData,
      isSimplified, setIsSimplified,
      currentCardIndex, setCardIndex,
      cardFlipped, setCardFlipped,
      quizAnswered, setQuizAnswered,
      pendingCheck, setPendingCheck,
      confirmedContentType, setConfirmedContentType,
      confirmedSubject, setConfirmedSubject,
      confirmedGrade, setConfirmedGrade,
      appScreen, setAppScreen,
      processingStep, setProcessingStep,
      processingLabel, setProcessingLabel,
      imageQualityNote, setImageQualityNote,
      resetApp
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
```

---

## Step 2 — Create `src/lib/api.js`

Direct port of `callKimiVision` from the HTML file as a pure async function.

```js
const WORKER_URL = 'https://aralmate-proxy.maykel-clarin.workers.dev'
const APP_SECRET = 'aralmate-2026'

export async function callWorker(prompt, maxTokens, imageBase64, imageType) {
  let resp
  try {
    resp = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AralMate-Secret': APP_SECRET
      },
      body: JSON.stringify({
        model: 'moonshot-v1-8k-vision-preview',
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${imageType};base64,${imageBase64}` } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    })
  } catch {
    throw new Error('Could not reach the Kimi proxy. Check your internet connection.')
  }
  const raw = await resp.text()
  let data
  try { data = JSON.parse(raw) }
  catch { throw new Error(`Worker error (HTTP ${resp.status}): ${raw.slice(0, 200) || 'Empty response'}`) }
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error))
  return data.choices[0].message.content
}
```

---

## Step 3 — Create `src/prompts/pass1.js`

Extract the Pass 1 prompt as a pure function. **Do not change a single word of the prompt text** — copy verbatim from `D:\tutor\aralmate.html` lines 817–858.

```js
export function buildPass1Prompt(studentName, selectedSubject) {
  return `You are an expert in the Philippine DepEd K-12 curriculum, analyzing a photo of school material for ${studentName}, a Grade 4 student who struggles with reading speed and Filipino vocabulary.

The student has selected subject: ${selectedSubject}

Your job is to deeply analyze this image and extract structured information a tutoring AI will use to build a personalized lesson. Apply your knowledge of Philippine elementary school curriculum when making assessments.

Respond ONLY with a valid JSON object. No markdown, no extra text, no explanation outside the JSON.

{
  "image_quality": "good" | "poor" | "unreadable",
  "quality_note": "One sentence if poor or unreadable, max 15 words. Empty string if good.",
  "can_read": true | false,
  "content_type": "narrative_story" | "worksheet" | "vocabulary_list" | "textbook_page" | "notes" | "poem" | "dialogue" | "unknown",
  "content_type_confidence": "high" | "medium" | "low",
  "subject_detected": "Filipino" | "Araling Panlipunan" | "Mathematics" | "Science" | "Mother Tongue" | "unclear",
  "subject_confidence": "high" | "medium" | "low",
  "subject_signals": "List 1-3 specific clues in the image that led to this subject identification. Max 20 words.",
  "grade_level_estimate": "Grade 1-2" | "Grade 3" | "Grade 4" | "Grade 5-6" | "unclear",
  "grade_level_signals": "List 1-2 specific clues: sentence length, vocabulary complexity, concept difficulty. Max 20 words.",
  "title_detected": "The title of the material if visible, exactly as written. Empty string if none.",
  "topic": "The main topic or concept in 4-8 words. Be specific — not 'Filipino story' but 'Personal hygiene and school preparation'.",
  "language_detected": "Filipino" | "English" | "Mixed",
  "competencies_present": ["List the specific learning competencies visible in this material. Use DepEd terminology. Examples: 'pagbasa ng kwento', 'talasalitaan', 'pang-uri', 'pag-unawa sa binasa', 'kasaysayan ng Pilipinas'. List up to 4."],
  "key_vocabulary": ["List up to 8 specific Filipino or subject-specific words from the actual visible text that a Grade 4 struggling reader would benefit from learning. These must be words actually present in the image, not generic words for the topic. For Math/Science, list key terms. Empty array if none found."],
  "content_summary": "One sentence describing what this material is about, written as if explaining to a teacher. Max 25 words.",
  "focus_area": "The single most important thing for a struggling Grade 4 reader to learn from this material. Be specific. Max 20 words.",
  "unclear_parts": "Briefly describe any parts hard to read. Max 15 words. Empty string if all clear.",
  "content_density": "simple" | "moderate" | "dense"
}`
}
```

---

## Step 4 — Create `src/prompts/pass2.js`

Direct port of `buildLessonPrompt()` from the HTML file. **Copy prompt text verbatim.**

```js
export function buildPass2Prompt(check, studentName, selectedSubject) {
  const languageNote = (check.language_detected === 'Filipino' || check.language_detected === 'Mixed')
    ? 'IMPORTANT: The material may be written in Filipino/Tagalog. Read and understand it in Filipino, but write ALL your output in simple English for a Grade 4 student. EXCEPTION: flashcard fronts must always be the Filipino/Tagalog word — never translate the front to English.'
    : ''
  const densityNote = check.content_density === 'dense'
    ? `IMPORTANT: This page has a lot of content. Focus ONLY on this core concept: "${check.focus_area}". Do not try to cover everything on the page.`
    : ''
  const handwritingNote = check.unclear_parts
    ? `NOTE: Some parts were hard to read (${check.unclear_parts}). Make your best effort but note uncertain parts in the unclear_content field.`
    : ''
  const vocabNote = (check.key_vocabulary && check.key_vocabulary.length > 0)
    ? `VOCABULARY PRIORITY: The following specific words were extracted from the student's actual material — prioritize these in flashcards and vocabulary exercises: ${check.key_vocabulary.join(', ')}. Feature these words prominently in key_terms. Give each a very simple definition with a short everyday Filipino example sentence.`
    : ''

  return `You are Alon, a warm and encouraging AI tutor for Filipino Grade 4 students (ages 9-11).
Student profile: ${studentName}, Grade 4, private school Philippines.
Known struggles: slow reading speed, limited Filipino vocabulary, reading comprehension difficulties.
Priority subjects: Filipino language and Araling Panlipunan.
You are analyzing a ${check.content_type || 'photo'} from ${studentName}'s ${selectedSubject} class about: "${check.topic}".
${languageNote}
${densityNote}
${handwritingNote}
${vocabNote}

Respond ONLY with a valid JSON object (no markdown, no extra text):

{
  "topic": "${check.topic}",
  "subject": "${check.subject_detected || selectedSubject}",
  "intro": "2-3 friendly, warm sentences addressing ${studentName} by name, telling them what this lesson is about and why it's interesting. Talk directly to them as 'you'. Be exciting and encouraging!",
  "lesson": {
    "title": "Clear lesson title (max 8 words)",
    "overview": "4-5 sentences explaining the main concept in simple words a 9-year-old understands. Use relatable examples from everyday Filipino life (food, places, family, school). Avoid technical jargon.",
    "overview_simplified": "The same explanation but even simpler — as if explaining to a 7-year-old. Use very short sentences. Max 3 sentences.",
    "key_points": [
      "First important thing to remember about this topic",
      "Second important thing",
      "Third important thing",
      "Fourth important thing"
    ],
    "key_points_simplified": [
      "Simpler version of point 1",
      "Simpler version of point 2",
      "Simpler version of point 3",
      "Simpler version of point 4"
    ],
    "remember_this": "One golden rule or the most important thing to remember. Short, memorable, like a mantra. For Filipino language material, write this in Filipino.",
    "key_terms": [
      {"term": "Word or concept", "definition": "Super simple definition with a short everyday Filipino example."}
    ]
  },
  "unclear_content": "If any part of the image was unclear or hard to read, briefly mention it here. Empty string if everything was clear.",
  "quiz": [
    {"question": "Question testing the main concept?", "options": ["Option A text","Option B text","Option C text","Option D text"], "correct": 2, "explanation": "Friendly explanation of why this is correct. Max 20 words."},
    {"question": "Question 2?", "options": ["A","B","C","D"], "correct": 0, "explanation": "Explanation."},
    {"question": "Question 3?", "options": ["A","B","C","D"], "correct": 3, "explanation": "Explanation."},
    {"question": "Question 4?", "options": ["A","B","C","D"], "correct": 1, "explanation": "Explanation."},
    {"question": "Question 5?", "options": ["A","B","C","D"], "correct": 2, "explanation": "Explanation."}
  ],
  "flashcards": [
    {"front": "Filipino word (Tagalog only, one word)", "back": "English meaning or simple definition"}
  ]
}

IMPORTANT for quiz: Vary the correct answer position across all 5 questions. No position (0,1,2,3) should appear more than twice. Do not follow the example positions above — use your own varied distribution.
IMPORTANT for flashcards: Exactly 8 cards. Front = always the Filipino/Tagalog word, one single word only, never English, never a phrase. Back = English meaning or simple Filipino definition.
Make ALL content appropriate for a Grade 4 Filipino student. Base EVERYTHING strictly on what you can see in the image.`
}
```

---

## Step 5 — Create `src/hooks/useAnalysis.js`

Port of `startAnalysis()` and `proceedWithLesson()` from the HTML file, rewritten to use React context state.

```js
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
```

---

## Step 6 — Build `NameScreen` component

**Files:** `src/components/NameScreen/NameScreen.jsx` + `NameScreen.module.css`

Port from the HTML `#nameScreen` div. Shows on first load when no name is in localStorage.

```jsx
import { useState } from 'react'
import styles from './NameScreen.module.css'

export default function NameScreen({ onSave }) {
  const [value, setValue] = useState('')

  const handleSave = () => {
    const name = value.trim()
    if (!name) return
    localStorage.setItem('am_student_name', name)
    onSave(name)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <div className={styles.alon}>🦅</div>
        <h2>Kamusta! Ako si Alon 🦅</h2>
        <p>What's your name? I want to know who I'm helping!</p>
        <input
          className={styles.input}
          type="text"
          placeholder="Type your name here…"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoComplete="off"
        />
        <button className={styles.btn} onClick={handleSave}>Let's go! →</button>
      </div>
    </div>
  )
}
```

**CSS rules to port from HTML:** `#nameScreen`, `.name-screen-inner`, `.name-alon-emoji`, `#nameInput`, `#nameScreen button`. Use CSS variables only — no hardcoded hex values.

---

## Step 7 — Build `UploadZone` component

**Files:** `src/components/UploadZone/UploadZone.jsx` + `UploadZone.module.css`

Contains the greeting card, subject selector, upload buttons, image preview, and analyze button. Uses `useApp()` for state and `useAnalysis()` for the scan trigger.

**Key behaviours to preserve exactly:**

- Upload buttons locked (`opacity: 0.4, pointer-events: none`) until subject is selected
- Camera input: `accept="image/*" capture="environment"`
- Gallery input: `accept="image/*"`
- Image preview shown after file selection with "Change photo / ✕" link that clears the image
- `currentImageBase64` and `currentImageType` set in context when file is read via `FileReader`
- Image quality note (`imageQualityNote` from context) shown below preview — red for error, yellow for warning
- "Let Alon Read This!" button calls `runPass1()` from `useAnalysis()`
- Button disabled while processing

**Subject buttons — four options:**

| Label | Icon | Value |
|---|---|---|
| Filipino | 🇵🇭 | `'Filipino'` |
| Araling Panlipunan | 🗺️ | `'Araling Panlipunan'` |
| Mathematics | 🔢 | `'Mathematics'` |
| Science | 🔬 | `'Science'` |

Selected subject gets `.selected` style — sky blue background, white text, scale(1.03).

**Tips section** — static list at the bottom of the upload zone. Port from HTML `.upload-tips` div.

---

## Step 8 — Build `ProcessingState` component

**File:** `src/components/UploadZone/ProcessingState.jsx`

Renders the five processing steps. Reads `processingStep` and `processingLabel` from context.

**Step definitions:**

| Step | Icon | Default label |
|---|---|---|
| 1 | 🔍 | Checking image quality… |
| 2 | 🏷️ | Identifying the lesson topic… |
| 3 | 📖 | Reading the content… |
| 4 | ✍️ | Writing your lesson summary… |
| 5 | 🎮 | Building quiz & flashcards… |

**Step states:**
- `wait` — grey dot, muted text
- `active` — sky blue pulsing dot, full text, current `processingLabel` shown
- `done` — green ✓, muted text

Steps 1–2 are used by `runPass1()`. Steps 3–5 are used by `runPass2()`. The active step is determined by `processingStep` from context.

Port the `procTitle` and `procSub` dynamic text from context as well.

---

## Step 9 — Build `ConfirmationCard` component

**Files:** `src/components/ConfirmationCard/ConfirmationCard.jsx` + `ConfirmationCard.module.css`

Port the three-row expandable attribute editor exactly from the HTML `confirmArea` div.

**First create `src/lib/constants.js`** — shared label maps used by ConfirmationCard and other components:

```js
export const CONTENT_TYPE_LABELS = {
  'narrative_story': '📄 Story',
  'worksheet':       '📋 Worksheet',
  'vocabulary_list': '📝 Vocab List',
  'textbook_page':   '📖 Textbook',
  'dialogue':        '💬 Dialogue',
  'poem':            '📜 Poem',
  'unknown':         '❓ Other'
}

export const GRADE_LABELS = {
  'Grade 1-2': '🌱 Grade 1–2',
  'Grade 3':   '📗 Grade 3',
  'Grade 4':   '📘 Grade 4',
  'Grade 5-6': '📙 Grade 5–6',
  'unclear':   '🤷 Hindi alam'
}

export const CONTENT_TYPE_OPTIONS = [
  { value: 'narrative_story', label: '📄 Story' },
  { value: 'worksheet',       label: '📋 Worksheet' },
  { value: 'vocabulary_list', label: '📝 Vocab List' },
  { value: 'textbook_page',   label: '📖 Textbook' },
  { value: 'dialogue',        label: '💬 Dialogue' },
  { value: 'poem',            label: '📜 Poem' },
  { value: 'unknown',         label: '❓ Other' }
]

export const SUBJECT_OPTIONS = [
  { value: 'Filipino',             label: '🇵🇭 Filipino' },
  { value: 'Araling Panlipunan',   label: '🗺️ Araling Panlipunan' },
  { value: 'Mathematics',          label: '🔢 Mathematics' },
  { value: 'Science',              label: '🔬 Science' }
]

export const GRADE_OPTIONS = [
  { value: 'Grade 1-2', label: '🌱 Grade 1–2' },
  { value: 'Grade 3',   label: '📗 Grade 3' },
  { value: 'Grade 4',   label: '📘 Grade 4' },
  { value: 'Grade 5-6', label: '📙 Grade 5–6' },
  { value: 'unclear',   label: '🤷 Hindi alam' }
]
```

**ConfirmationCard behaviour:**

- Thumbnail: `currentImageBase64` from context rendered as `<img>` — `src={\`data:image/jpeg;base64,${currentImageBase64}\`}`
- Three rows: URI NG MATERYAL (content type), SUBJECT, GRADE LEVEL
- Each row shows the current confirmed value and a `✎` edit icon
- Tapping a row expands it inline to show option buttons — only one row open at a time
- Tapping an option updates the confirmed value in context, collapses the row, changes `✎` to `✓` in leaf green
- "Tama na, ituloy! ✓" button calls `runPass2()` from `useAnalysis()`
- All CSS must use design system variables — no hardcoded hex values

**Local state for the component** — which row is currently open (`openRow: null | 'contentType' | 'subject' | 'grade'`) — this is UI state managed with `useState` inside the component, not in context.

---

## Step 10 — Build output components

### `src/components/LessonView/LessonView.jsx`

Port `buildLesson()` from HTML. Reads `lessonData` and `isSimplified` from context. `setIsSimplified` toggles simplified mode.

**Sections to render:**
1. Unclear content note (if `lessonData.unclear_content` is non-empty)
2. "📖 What This Lesson Is About" — `lesson.title` + `lesson.overview` (or `overview_simplified`)
3. "✅ Key Points to Remember" — `lesson.key_points` (or `key_points_simplified`) as individual cards
4. "⭐ Most Important" — `lesson.remember_this` in a highlighted box
5. "🔤 Key Terms" — `lesson.key_terms` as term + definition pairs

**Simplify button** — "✨ Simplify this lesson" / "📖 Show full lesson" toggle. Calls `setIsSimplified(!isSimplified)`. When simplified, badge shows "Simplified mode" in violet.

### `src/components/QuizView/QuizView.jsx`

Port `buildQuiz()` and `answerQuiz()` from HTML. Reads `lessonData` and `quizAnswered` from context.

**Behaviour to preserve:**
- Once an option is selected, all options for that question become disabled
- Correct option gets green border/background
- Wrong selected option gets red border/background
- Feedback text appears below each answered question
- `earnTala(5)` on correct answer
- When all 5 questions answered, score card appears with emoji + score + personalised message using `studentName`
- `earnTala(score * 3)` on completion
- Score card scrolls into view smoothly

### `src/components/FlashcardView/FlashcardView.jsx`

Port `renderCard()`, `flipCard()`, `nextCard()`, `prevCard()` from HTML. Uses `currentCardIndex`, `setCardIndex`, `cardFlipped`, `setCardFlipped` from context.

**Behaviour to preserve:**
- Progress bar updates per card
- Card shows "TERM" label on front, "DEFINITION" label on back
- Flip animates the card (or re-renders — either is acceptable)
- Prev disabled on first card, Next disabled on last card
- `earnTala(2)` on each Next

### `src/components/LessonOutput/LessonOutput.jsx`

Wrapper component managing tab state locally with `useState`. Renders tab bar with three tabs — Lesson, Quiz, Cards — and the active tab's component.

```jsx
import { useState } from 'react'
import LessonView from '../LessonView/LessonView'
import QuizView from '../QuizView/QuizView'
import FlashcardView from '../FlashcardView/FlashcardView'
import { useApp } from '../../context/AppContext'
import styles from './LessonOutput.module.css'

export default function LessonOutput() {
  const [activeTab, setActiveTab] = useState('lesson')
  const { isSimplified, setIsSimplified, lessonData, earnTala } = useApp()

  return (
    <div className={styles.output}>
      {/* Alon intro bubble */}
      <div className={styles.alonIntro}>
        <div className={styles.introCard}>
          <div className={styles.introAlon}>🦅</div>
          <div className={styles.introBubble}>
            <div className={styles.introLabel}>🦅 Alon says</div>
            <div className={styles.introText}>{lessonData?.intro}</div>
          </div>
        </div>
      </div>

      {/* Readability note */}
      {lessonData?.unclear_content && (
        <div className={styles.readabilityNote}>
          ⚠️ Alon's note: "{lessonData.unclear_content}" Some parts were a little hard to read. If something seems off, try uploading a clearer photo!
        </div>
      )}

      {/* Tab bar */}
      <div className={styles.tabsBar}>
        <button className={`${styles.tabBtn} ${activeTab === 'lesson' ? styles.active : ''}`} onClick={() => setActiveTab('lesson')}>📖 Lesson</button>
        <button className={`${styles.tabBtn} ${activeTab === 'quiz' ? styles.active : ''}`} onClick={() => setActiveTab('quiz')}>❓ Quiz</button>
        <button className={`${styles.tabBtn} ${activeTab === 'flashcards' ? styles.active : ''}`} onClick={() => setActiveTab('flashcards')}>🃏 Cards</button>
      </div>

      {/* Tab content */}
      <div className={styles.tabContent}>
        {activeTab === 'lesson' && <LessonView />}
        {activeTab === 'quiz' && <QuizView />}
        {activeTab === 'flashcards' && <FlashcardView />}
      </div>

      {/* Simplify bar — lesson tab only */}
      {activeTab === 'lesson' && (
        <div className={styles.simplifyBar}>
          <button className={styles.simplifyBtn} onClick={() => setIsSimplified(s => !s)}>
            {isSimplified ? '📖 Show full lesson' : '✨ Simplify this lesson'}
          </button>
          <div className={`${styles.simplifyBadge} ${isSimplified ? styles.simplified : ''}`}>
            {isSimplified ? 'Simplified mode' : 'Make it easier'}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Step 11 — Update `App.jsx`

Replace the Phase 1 placeholder with the full screen router.

```jsx
import { useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import AppShell from './components/AppShell/AppShell'
import WelcomePanel from './components/WelcomePanel/WelcomePanel'
import NameScreen from './components/NameScreen/NameScreen'
import UploadZone from './components/UploadZone/UploadZone'
import ProcessingState from './components/UploadZone/ProcessingState'
import ConfirmationCard from './components/ConfirmationCard/ConfirmationCard'
import LessonOutput from './components/LessonOutput/LessonOutput'

function AralMateApp() {
  const {
    studentName, setStudentName,
    tala, appScreen, setAppScreen,
    lessonData, resetApp
  } = useApp()

  // Restore name from localStorage on first load
  useEffect(() => {
    const saved = localStorage.getItem('am_student_name')
    if (saved) {
      setStudentName(saved)
      setAppScreen('upload')
    }
  }, [])

  const leftContent = () => {
    if (appScreen === 'name')       return null
    if (appScreen === 'processing') return <ProcessingState />
    if (appScreen === 'confirming') return <ConfirmationCard />
    return <UploadZone />
  }

  const rightContent = () => {
    if (appScreen === 'results') return <LessonOutput />
    return <WelcomePanel studentName={studentName} visible={true} />
  }

  const handleEditName = () => {
    const n = prompt('Change your name:')
    if (n?.trim()) {
      setStudentName(n.trim())
      localStorage.setItem('am_student_name', n.trim())
    }
  }

  return (
    <AppShell
      studentName={studentName}
      tala={tala}
      onEditName={handleEditName}
      showReset={appScreen === 'results'}
      onReset={resetApp}
      leftChildren={
        appScreen === 'name'
          ? <NameScreen onSave={(name) => { setStudentName(name); setAppScreen('upload') }} />
          : leftContent()
      }
      rightChildren={rightContent()}
    />
  )
}

export default function App() {
  return (
    <AppProvider>
      <AralMateApp />
    </AppProvider>
  )
}
```

**Note:** Update `AppShell` to accept and handle `showReset` and `onReset` props — add a "✕ New" reset button to the nav bar that is only visible when `showReset` is true.

---

## Step 12 — Add `TalaFlash` notification

**File:** `src/components/TalaFlash/TalaFlash.jsx`

A fixed toast notification that appears for 2 seconds when Tala is earned. Port from HTML `.tala-flash` element.

The component should listen to `tala` changes in context. When `earnTala(n)` is called, show the flash with `+n Tala!` for 2 seconds then hide.

Implementation hint: store a `flashMessage` string in context alongside `tala`. `earnTala` sets both. The component watches `flashMessage` and shows/hides accordingly.

Add `<TalaFlash />` at the top level inside `AralMateApp`, before `<AppShell>`.

---

## CSS Rules to Port

All CSS from the HTML file must be ported into the relevant component's CSS Module. **Use CSS variables only — no hardcoded hex values.**

Key CSS sections and their target component modules:

| HTML CSS section | Target CSS Module |
|---|---|
| `.upload-zone`, `.upload-prompt`, `.up-btn`, `.upload-tips` | `UploadZone.module.css` |
| `.subject-btn`, `.subject-btns`, `.subject-label` | `UploadZone.module.css` |
| `.processing`, `.proc-card`, `.proc-step`, `.proc-step-dot` | `ProcessingState.module.css` (create this) |
| `.confirm-area`, `.confirm-card`, `.confirm-row`, `.confirm-opt-btn` | `ConfirmationCard.module.css` |
| `.alon-intro`, `.intro-card`, `.intro-bubble`, `.intro-label` | `LessonOutput.module.css` |
| `.tabs-bar`, `.tab-btn`, `.tab-content` | `LessonOutput.module.css` |
| `.simplify-bar`, `.simplify-btn`, `.simplify-badge` | `LessonOutput.module.css` |
| `.lesson-section`, `.lesson-card`, `.key-point`, `.remember-box`, `.key-term` | `LessonView.module.css` (create this) |
| `.quiz-q`, `.quiz-opt`, `.quiz-feedback`, `.quiz-score` | `QuizView.module.css` (create this) |
| `.flashcard`, `.flashcard-wrap`, `.card-nav`, `.fc-progress` | `FlashcardView.module.css` (create this) |
| `.tala-flash` | `TalaFlash.module.css` (create this) |
| `#nameScreen`, `.name-screen-inner` | `NameScreen.module.css` |
| `.readability-note` | `LessonOutput.module.css` |

---

## Verification Gate — Phase 2

All of the following must pass before deploying to Netlify:

### Full scan test
1. Upload "Malinis si Tom" image with Filipino selected
2. Pass 1 returns JSON with `content_type: 'narrative_story'`, `subject_detected: 'Filipino'`, `grade_level_estimate: 'Grade 3'`
3. Confirmation card shows three correct rows
4. Tap "Tama na, ituloy!" without changing anything
5. Lesson generates with overview, key points, key terms, 5 quiz questions, and 8 flashcards

### Confirmation override test
1. Upload "Malinis si Tom" with Filipino selected
2. On confirmation card, tap Subject row → select Araling Panlipunan
3. Tap confirm
4. Lesson generated must be for Araling Panlipunan — not Filipino
5. Confirms confirmed values correctly override Pass 1 detection

### Quiz test
1. Answer all 5 quiz questions
2. Score card appears with correct score
3. Tala increments on correct answers and on completion
4. Correct options show green, wrong selected option shows red

### Flashcard test
1. Flip a card — term shows on front, definition on back
2. Navigate with Prev / Next
3. Progress bar updates per card
4. Tala increments on each Next

### Simplify test
1. On lesson tab, tap "✨ Simplify this lesson"
2. Overview and key points switch to simplified versions
3. Badge shows "Simplified mode" in violet
4. Tap again — full version restores

### Reset test
1. After a complete lesson, tap "✕ New"
2. All state clears — upload zone reappears
3. Welcome panel returns on desktop
4. No stale data from previous session

### No console errors
Open DevTools during the full flow. Zero errors at any screen or transition.

---

## Important Rules

- **CSS variables only** — no hardcoded hex values anywhere in component CSS modules
- **Prompt text verbatim** — do not paraphrase or shorten any text in `pass1.js` or `pass2.js`
- **No business logic in components** — components render, hooks orchestrate, context stores
- **One component per file** — no combining multiple components in the same file
- **Submit as a plan first** — do not implement without tech lead review

---

*AralMate — Ang Kasama Mo sa Pag-aaral*  
*Migration Plan v1.0 — April 2026*
