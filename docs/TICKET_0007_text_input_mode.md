# TICKET_0007 — Text Input Mode: Generate Lesson from Topic

**Created by:** Product Lead
**Date:** 2026-04-12
**Priority:** High
**Depends on:** TICKET_0006 complete (RAG pipeline live)

## Background

The app currently requires a photo to generate a lesson. This ticket adds a
second input mode: the student types a topic directly and Alon generates a
full lesson, quiz, and flashcards from that text.

This serves two purposes:
1. Students can ask Alon about any topic without needing a worksheet
2. It provides a clean RAG quality test — no image noise, pure topic → lesson

The architecture change is minimal. Pass 1 is skipped entirely. The student's
typed topic becomes the `check` object directly. Pass 2 and RAG run exactly
as they do today.

## User Flow

```
Upload screen
  → Student selects subject (existing selector)
  → Student taps "Type a topic instead"
  → Text input appears
  → Student types topic (e.g. "Pang-uri", "Pagkakaiba ng Pangungusap at Parirala")
  → Student taps "Study This Topic →"
  → Light confirmation screen (no content type — just subject + grade)
  → Pass 2 runs with text-based check object + RAG chunk
  → Normal lesson output (lesson, quiz, flashcards)
```

## What Needs to Be Built

### 1. Update `src/components/UploadZone/UploadZone.jsx`

Add a text input mode toggle below the upload buttons.

**New UI elements:**

```jsx
{/* Divider */}
<div className={styles.divider}>
  <span>— o kaya —</span>
</div>

{/* Text topic input */}
<div className={styles.textMode}>
  <div className={styles.textModeLabel}>📝 I-type ang topic:</div>
  <input
    className={styles.topicInput}
    type="text"
    placeholder="hal. Pang-uri, Kasaysayan ng Pilipinas, Fractions..."
    value={topicText}
    onChange={e => setTopicText(e.target.value)}
    onKeyDown={e => e.key === 'Enter' && handleTopicSubmit()}
    disabled={uploadLocked || isProcessing}
    maxLength={120}
  />
  <button
    className={styles.topicBtn}
    onClick={handleTopicSubmit}
    disabled={uploadLocked || isProcessing || !topicText.trim()}
  >
    {isProcessing ? '⏳ Ginagawa…' : '🦅 Pag-aralan Ito →'}
  </button>
</div>
```

**New state in UploadZone:**
```js
const [topicText, setTopicText] = useState('')
```

**New handler:**
```js
function handleTopicSubmit() {
  const topic = topicText.trim()
  if (!topic || !selectedSubject) return
  runPass1Text(topic)   // new function in useAnalysis -- see below
}
```

The text input must be disabled when no subject is selected (same lock as
the photo buttons). Show the same `lockHint` message.

The text input and photo buttons are NOT mutually exclusive — both are always
visible. If the student has typed a topic AND uploaded a photo, the photo
takes precedence. The text input is cleared when a photo is uploaded.

### 2. Update `src/hooks/useAnalysis.js`

Add a new exported function `runPass1Text(topic)` alongside the existing
`runPass1()`.

```js
export function useAnalysis() {
  // ... existing code ...

  async function runPass1Text(topic) {
    // Skip Pass 1 entirely -- build the check object from the typed topic
    const check = {
      topic:               topic,
      subject_detected:    selectedSubject,
      content_type:        'text_input',   // new content type flag
      grade_level_estimate: studentContext?.gradeLevel || 'Grade 4',
      language_detected:   'Filipino',     // assume Filipino for now
      key_vocabulary:      [],             // no image to extract from
      competency_clues:    [],
      content_density:     'moderate',
      focus_area:          topic,
      unclear_parts:       '',
      can_read:            true,
      image_quality:       'good'
    }

    // Set confirmed values -- no confirmation card needed for text input
    // (subject and grade are already known from student profile)
    setPendingCheck(check)
    setConfirmedContentType('text_input')
    setConfirmedSubject(selectedSubject)
    setConfirmedGrade(studentContext?.gradeLevel || 'Grade 4')

    // Go directly to confirming screen for a light review
    // (student can still change subject or grade if needed)
    setAppScreen('confirming')
  }

  return { runPass1, runPass1Text, runPass2 }
}
```

Note: `runPass1Text` still goes to the confirming screen. This is intentional
-- the student gets to verify the subject and grade before Pass 2 runs.
The confirmation card will show the typed topic, subject, and grade.

### 3. Update `src/lib/api.js`

Add a new `callWorkerText` function for text-only Kimi calls (no image):

```js
export async function callWorkerText(prompt, maxTokens) {
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
          content: prompt   // plain string -- no image_url
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

### 4. Update `src/prompts/pass2.js`

Add a text input variant of the Pass 2 prompt. The key difference: remove
the image reference instruction and replace it with a knowledge-based
generation instruction.

Add a `isTextMode` parameter to `buildPass2Prompt`:

```js
export function buildPass2Prompt(
  check, studentName, selectedSubject, studentContext, curriculumChunk, isTextMode = false
)
```

Change the final instruction line based on mode:

```js
// Replace the last line of the prompt:
const sourceInstruction = isTextMode
  ? `Generate this lesson from your knowledge of the Philippine DepEd curriculum.
Use the curriculum reference above as your primary guide.
Make all content appropriate for a ${grade} Filipino student.
Use relatable Filipino examples (food, family, school, places in the Philippines).
Do NOT reference "the image" or "what you can see" — there is no image.`
  : `Make ALL content appropriate for a ${grade} Filipino student. Base EVERYTHING strictly on what you can see in the image.`
```

Also update the "You are analyzing" line to handle text mode:

```js
const sourceDescription = isTextMode
  ? `${studentName} wants to study: "${check.topic}" in ${selectedSubject}.`
  : `You are analyzing a ${check.content_type || 'photo'} from ${studentName}'s ${selectedSubject} class about: "${check.topic}".`
```

Also remove the `unclear_content` field from the JSON schema for text mode
since there's no image to have unclear parts.

### 5. Update `runPass2` in `src/hooks/useAnalysis.js`

Detect text mode and use the correct API call and prompt variant:

```js
async function runPass2() {
  const check = {
    ...pendingCheck,
    content_type:        confirmedContentType,
    subject_detected:    confirmedSubject,
    grade_level_estimate: confirmedGrade
  }

  const isTextMode = check.content_type === 'text_input'

  // ... existing processing steps ...

  const studentContext  = await fetchContext()
  const confirmedGradeNum = parseInt((confirmedGrade || '').replace('Grade ', '')) || null
  const profileGradeNum   = parseInt((studentContext?.gradeLevel || '').replace('Grade ', '')) || 4
  const gradeNum = confirmedGradeNum || profileGradeNum

  const curriculumChunk = await fetchCurriculumChunk(
    check.topic,
    check.subject_detected || confirmedSubject,
    gradeNum
  )

  const prompt = buildPass2Prompt(
    check, studentName, confirmedSubject, studentContext, curriculumChunk, isTextMode
  )

  // Use text-only call for text mode, image call for photo mode
  const r2 = isTextMode
    ? await callWorkerText(prompt, 2500)
    : await callWorker(prompt, 2500, currentImageBase64, currentImageType)

  // ... rest of existing runPass2 logic unchanged ...
}
```

### 6. Update `src/components/UploadZone/UploadZone.module.css`

Add styles for the new text mode elements. Use existing CSS variables only.

```css
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  margin: 8px 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1.5px;
  background: var(--border);
}

.textMode {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.textModeLabel {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
}

.topicInput {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid var(--border);
  border-radius: 12px;
  font-family: 'Nunito', sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
  background: var(--card);
  outline: none;
  transition: border-color 0.2s;
}

.topicInput:focus {
  border-color: var(--sky);
}

.topicInput::placeholder {
  color: var(--muted);
}

.topicInput:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.topicBtn {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, var(--sky) 0%, var(--sky-dk) 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-family: 'Baloo 2', cursive;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.topicBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

### 7. Update `src/hooks/useAnalysis.js` — pass studentContext to runPass1Text

`runPass1Text` needs `studentContext` to set the grade. Call `fetchContext`
at the start of `runPass1Text`:

```js
async function runPass1Text(topic) {
  const studentContext = await fetchContext()

  const check = {
    topic,
    subject_detected:     selectedSubject,
    content_type:         'text_input',
    grade_level_estimate: studentContext?.gradeLevel || 'Grade 4',
    language_detected:    'Filipino',
    key_vocabulary:       [],
    competency_clues:     [],
    content_density:      'moderate',
    focus_area:           topic,
    unclear_parts:        '',
    can_read:             true,
    image_quality:        'good'
  }

  setPendingCheck(check)
  setConfirmedContentType('text_input')
  setConfirmedSubject(selectedSubject)
  setConfirmedGrade(studentContext?.gradeLevel || 'Grade 4')
  setAppScreen('confirming')
}
```

## Technical Context

- **Files to modify:**
  - `src/components/UploadZone/UploadZone.jsx` — add text input UI
  - `src/components/UploadZone/UploadZone.module.css` — add styles
  - `src/hooks/useAnalysis.js` — add `runPass1Text`, update `runPass2`
  - `src/lib/api.js` — add `callWorkerText`
  - `src/prompts/pass2.js` — add `isTextMode` parameter and variants

- **Files to NOT modify:**
  - `src/prompts/pass1.js` — not used in text mode
  - `src/context/AppContext.jsx`
  - `src/hooks/useSession.js`
  - `src/hooks/useStudentContext.js`
  - `worker/index.js` — no Worker changes needed

## Acceptance Criteria

- [ ] Text input field and "Pag-aralan Ito" button appear below the upload
      buttons on the upload screen
- [ ] Text input is disabled when no subject is selected
- [ ] Typing a topic and tapping the button goes to the confirmation card
- [ ] Confirmation card shows the typed topic, subject, and grade correctly
- [ ] Confirming runs Pass 2 and generates a full lesson with quiz and
      flashcards
- [ ] The Pass 2 prompt does NOT say "based on the image" in text mode
- [ ] RAG runs and the `[AralMate] RAG: matched...` log appears in console
- [ ] Lesson saves to Supabase `lesson_history` after completion
- [ ] Text mode lesson is indistinguishable from photo mode lesson in the UI
- [ ] Uploading a photo after typing a topic clears the topic input
- [ ] No console errors on text mode scan completion
- [ ] Test with: "Pang-uri", "Pagkakaiba ng Pangungusap at Parirala",
      "Kasaysayan ng Watawat ng Pilipinas", "Fractions Grade 4"

## Notes

- `callWorkerText` sends `content` as a plain string (not an array with
  image_url). Kimi's API accepts both formats -- the Worker passes the
  body through unchanged so no Worker update is needed.
- The `unclear_content` field in the Pass 2 JSON response may still appear
  in text mode since the JSON schema template includes it. This is fine --
  just leave it in the schema and it will return an empty string.
- Text mode does NOT use `setImageBase64` or `setImageType` -- those remain
  null. The `runPass2` function already handles null image gracefully when
  `isTextMode` is true.
- The `language_detected` is hardcoded to 'Filipino' for text mode. This
  is a reasonable default for AralMate's use case. A future improvement
  could detect the language from the typed topic.
- Topic input is capped at 120 characters via `maxLength`. This is enough
  for any reasonable topic name and prevents very long inputs.
