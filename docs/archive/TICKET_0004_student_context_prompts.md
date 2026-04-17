# TICKET_0004 — Inject Student Context into Pass 1 and Pass 2 Prompts

**Created by:** Product Lead
**Date:** 2026-04-12
**Priority:** Critical
**Depends on:** TICKET_0003 (lesson history and vocabulary must exist in Supabase)

## Background

TICKET_0003 is complete. Lesson history and vocabulary are now being saved to
Supabase after every scan. But this data is not being used yet. The AI prompts
still treat every scan as if it's the student's first lesson ever.

This ticket makes the student's history visible to Alon. After this ticket:
- Pass 1 knows what subjects and topics Miguel has studied recently
- Pass 2 knows which vocabulary words Miguel already knows and does not
  re-teach them
- Pass 2 knows Miguel's actual grade level and quarter from his profile,
  not a hardcoded assumption

This is the ticket that makes AralMate genuinely personalized.

## What Needs to Change

### 1. Create `src/hooks/useStudentContext.js`

This hook is responsible for fetching the student's context data from Supabase
and returning it in a shape ready for prompt injection. It is called once at
the start of `runPass1()` in `useAnalysis.js`.

```js
export function useStudentContext() {
  const fetchContext = async () => { ... }
  return { fetchContext }
}
```

**What `fetchContext` must return:**

```js
{
  gradeLevel:       'Grade 4',           // from students table
  schoolQuarter:    2,                   // from students table
  schoolType:       'private',           // from students table
  recentTopics:     ['Pang-uri', 'Pangngalan', 'Mga Uri ng Pangungusap'],
  recentSubjects:   ['Filipino', 'Filipino', 'Filipino'],
  knownWords:       ['mabait', 'masipag', 'malinis', 'maayos'],
}
```

**How to fetch it:**

```js
// Get session
const { data: { session } } = await supabase.auth.getSession()
if (!session) return null
const studentId = session.user.id

// Fetch student profile
const { data: student } = await supabase
  .from('students')
  .select('grade_level, school_quarter, school_type')
  .eq('id', studentId)
  .single()

// Fetch last 5 lessons (most recent first)
const { data: history } = await supabase
  .from('lesson_history')
  .select('topic, subject')
  .eq('student_id', studentId)
  .order('scanned_at', { ascending: false })
  .limit(5)

// Fetch all known vocabulary words
const { data: vocab } = await supabase
  .from('vocabulary_mastered')
  .select('word')
  .eq('student_id', studentId)

return {
  gradeLevel:     student?.grade_level     || 'Grade 4',
  schoolQuarter:  student?.school_quarter  || 1,
  schoolType:     student?.school_type     || 'private',
  recentTopics:   history?.map(h => h.topic)   || [],
  recentSubjects: history?.map(h => h.subject) || [],
  knownWords:     vocab?.map(v => v.word)       || [],
}
```

If any fetch fails, catch the error, log it, and return `null`. The prompt
builders must handle a null context gracefully by falling back to defaults.

### 2. Update `src/prompts/pass1.js`

Change the function signature to accept the student context:

```js
// Before
export function buildPass1Prompt(studentName, selectedSubject)

// After
export function buildPass1Prompt(studentName, selectedSubject, studentContext)
```

Use the context to add a student history block to the prompt. Insert it
after the existing subject line and before the instruction to respond with JSON.

Add this block (built from studentContext):

```js
const historyNote = (studentContext && studentContext.recentTopics.length > 0)
  ? `Student's recent lesson history (last ${studentContext.recentTopics.length} scans):
${studentContext.recentTopics.map((t, i) => `  - ${studentContext.recentSubjects[i]}: ${t}`).join('\n')}
Use this to understand what the student has been studying. If this scan appears
to be on a topic they have studied before, note it in your analysis.`
  : ''

const profileNote = studentContext
  ? `Student grade: ${studentContext.gradeLevel} | Quarter: ${studentContext.schoolQuarter} | School: ${studentContext.schoolType}`
  : 'Student grade: Grade 4 | Quarter: 1 | School: private'
```

Replace the current hardcoded grade reference in the prompt:

```
// Before (hardcoded):
"a Grade 4 student who struggles with reading speed and Filipino vocabulary"

// After (dynamic):
`a ${studentContext?.gradeLevel || 'Grade 4'} student who struggles with reading speed and Filipino vocabulary`
```

Insert `${profileNote}` and `${historyNote}` into the prompt string, after the
subject line and before the JSON instruction block.

### 3. Update `src/prompts/pass2.js`

Change the function signature to accept the student context:

```js
// Before
export function buildPass2Prompt(check, studentName, selectedSubject)

// After
export function buildPass2Prompt(check, studentName, selectedSubject, studentContext)
```

Add two new context blocks at the top of the prompt, after the existing
student profile line:

**Block 1 — Known vocabulary (most important):**
```js
const knownWordsNote = (studentContext && studentContext.knownWords.length > 0)
  ? `KNOWN VOCABULARY: ${studentName} already knows these words from previous lessons:
${studentContext.knownWords.join(', ')}.
Do NOT re-teach these words in key_terms or flashcards. You may use them
freely in explanations and examples since ${studentName} already knows them.
Focus key_terms and flashcards on NEW words from this lesson.`
  : ''
```

**Block 2 — Recent topics:**
```js
const recentTopicsNote = (studentContext && studentContext.recentTopics.length > 0)
  ? `RECENT LESSONS: ${studentName} has recently studied: ${studentContext.recentTopics.join(', ')}.
Build on this existing knowledge where relevant. Do not re-introduce concepts
already covered unless this lesson directly extends them.`
  : ''
```

**Block 3 — Dynamic student profile line:**
Replace the hardcoded student profile line:
```js
// Before:
`Student profile: ${studentName}, Grade 4, private school Philippines.`

// After:
`Student profile: ${studentName}, ${studentContext?.gradeLevel || 'Grade 4'}, ${studentContext?.schoolType || 'private'} school Philippines, Quarter ${studentContext?.schoolQuarter || 1}.`
```

Insert `${knownWordsNote}` and `${recentTopicsNote}` after the existing
`${vocabNote}` block, before the JSON instruction.

### 4. Update `src/hooks/useAnalysis.js`

Import and call `useStudentContext` at the start of `runPass1()`:

```js
// Add to imports
import { useStudentContext } from './useStudentContext'

// Add inside useAnalysis()
const { fetchContext } = useStudentContext()

// Add at the START of runPass1(), before buildPass1Prompt:
const studentContext = await fetchContext()  // null if fetch fails -- handled gracefully

// Pass context to prompt builders:
const prompt = buildPass1Prompt(studentName, selectedSubject, studentContext)
```

In `runPass2()`, pass the context to `buildPass2Prompt`. Since `fetchContext`
was already called in `runPass1`, store it in a ref so it can be reused in
`runPass2` without a second database call:

```js
// Inside useAnalysis, at hook level (not inside runPass1/runPass2):
const studentContextRef = useRef(null)

// In runPass1, after fetchContext:
studentContextRef.current = studentContext

// In runPass2, use the cached value:
const prompt = buildPass2Prompt(check, studentName, confirmedSubject, studentContextRef.current)
```

This avoids a duplicate Supabase call between Pass 1 and Pass 2.

## Technical Context

- **File to create:**
  - `src/hooks/useStudentContext.js`

- **Files to modify:**
  - `src/prompts/pass1.js` — add studentContext parameter, inject history
  - `src/prompts/pass2.js` — add studentContext parameter, inject known words
  - `src/hooks/useAnalysis.js` — call fetchContext, pass to prompt builders,
    cache with useRef

- **Files to NOT modify:**
  - `src/lib/supabase.js`
  - `src/context/AppContext.jsx`
  - `src/hooks/useSession.js`
  - `src/lib/api.js`

- **React import needed in useAnalysis.js:**
  ```js
  import { useRef } from 'react'
  ```

## Acceptance Criteria

- [ ] `src/hooks/useStudentContext.js` exists and exports `useStudentContext`
- [ ] `fetchContext()` returns the correct shape with gradeLevel, schoolQuarter,
      schoolType, recentTopics, recentSubjects, knownWords
- [ ] `buildPass1Prompt` accepts and uses the third `studentContext` argument
- [ ] `buildPass2Prompt` accepts and uses the fourth `studentContext` argument
- [ ] Both prompt builders handle `studentContext = null` without throwing
- [ ] After 2+ lesson scans, the Pass 2 prompt contains the known vocabulary
      list (verify by adding a temporary `console.log(prompt)` in runPass2
      before the callWorker call, then remove it after verification)
- [ ] The student's actual grade level appears in the prompt (not hardcoded
      "Grade 4" for every student)
- [ ] `fetchContext` is called only once per scan — result is cached in a ref
      and reused in runPass2
- [ ] A fetchContext failure (Supabase error) does not break the scan —
      prompts fall back to defaults gracefully
- [ ] No console errors on normal scan completion

## Notes

- The `knownWords` list may become large over time (hundreds of words).
  For MVP this is fine — OpenAI handles long prompts well. In a future
  ticket we can limit to the most recently seen N words.
- The first scan a new student does will have an empty context (no history,
  no known words). This is expected and the prompts handle it via the
  conditional blocks that only inject content when arrays are non-empty.
- Do not modify the JSON output structure of Pass 1 or Pass 2 in this ticket.
  Only the prompt instructions change — the output schema stays identical.
  This is important because LessonView, QuizView, and FlashcardView all
  depend on the existing output shape.
- The `useRef` cache for studentContext is a clean pattern here because
  runPass1 and runPass2 are always called in sequence within the same
  component lifecycle. There is no risk of the ref being stale between calls.
