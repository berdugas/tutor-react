# TICKET_0003 — useSession Hook: Save Lesson History and Vocabulary to Supabase

**Created by:** Product Lead
**Date:** 2026-04-12
**Priority:** Critical
**Depends on:** TICKET_0001 (Supabase client), TICKET_0002 (student profile)

## Background

TICKET_0002 is complete. Students now have a real profile in Supabase.
The app can scan worksheets and generate lessons — but nothing about those
lessons is saved anywhere. Every session is stateless. When Miguel finishes
a lesson, the quiz score, vocabulary words, and Tala earned vanish on refresh.

This ticket creates the `useSession` hook that writes completed lesson data
to Supabase after every successful Pass 2 result. It also fixes the Tala
persistence problem — the current tala is hardcoded to 145 and never saved.

## Two Problems Being Fixed

**Problem 1 — Lesson history is not saved**
`useAnalysis.js` generates a full lesson object with topic, subject, quiz,
flashcards, and key_terms. None of this is written to `lesson_history` or
`vocabulary_mastered`. It exists only in React state and disappears on refresh.

**Problem 2 — Tala is not persisted**
AppContext has `useState(145)` hardcoded. `earnTala(20)` adds to it in memory
but the value is never written to Supabase. App.jsx reads `tala_total` from
the student row during restore but never sets it into state.

## Requirements

### 1. Create `src/hooks/useSession.js`

This hook exposes one primary function: `saveLesson(lessonData, check)`.

It is called by `useAnalysis.js` after a successful Pass 2 result, just before
`setAppScreen('results')`.

```js
// Signature
export function useSession() {
  const saveLesson = async (lessonData, check) => { ... }
  return { saveLesson }
}
```

**What `saveLesson` must do:**

**Step 1 — Get the current session**
```js
const { data: { session } } = await supabase.auth.getSession()
if (!session) return  // no session, skip silently
const studentId = session.user.id
```

**Step 2 — Write to `lesson_history`**
```js
await supabase.from('lesson_history').insert({
  student_id:         studentId,
  subject:            check.subject_detected || '',
  topic:              check.topic || '',
  content_type:       check.content_type || 'unknown',
  grade_detected:     check.grade_level_estimate || '',
  competencies:       check.competency_clues || [],
  vocabulary_learned: lessonData.lesson?.key_terms?.map(t => t.term) || [],
  quiz_score:         null,    // updated separately when quiz is completed
  tala_earned:        20
})
```

**Step 3 — Write to `vocabulary_mastered`**
For each term in `lessonData.lesson.key_terms`, upsert into vocabulary_mastered.
Because the same word may appear across multiple lessons, use a conflict
resolution strategy: on conflict of (student_id, word), increment times_seen
and update last_seen_at.

The `vocabulary_mastered` table does not have a unique constraint on
(student_id, word) yet. The dev team must add this first:

```sql
-- Run in Supabase SQL Editor before implementing the hook
alter table vocabulary_mastered
  add constraint vocabulary_mastered_student_word_unique
  unique (student_id, word);
```

Then the upsert:
```js
const terms = lessonData.lesson?.key_terms || []
if (terms.length > 0) {
  const vocabRows = terms.map(t => ({
    student_id:    studentId,
    word:          t.term,
    subject:       check.subject_detected || '',
    last_seen_at:  new Date().toISOString(),
    times_seen:    1  // onConflict will increment this
  }))

  await supabase.from('vocabulary_mastered').upsert(vocabRows, {
    onConflict: 'student_id,word',
    ignoreDuplicates: false
  })
  // Note: Supabase upsert does not auto-increment times_seen.
  // For MVP, each upsert overwrites with times_seen: 1.
  // True incrementing requires a Postgres function -- out of scope for this ticket.
}
```

**Step 4 — Update Tala in Supabase**
After writing the lesson, update the student's `tala_total`:
```js
await supabase.from('students')
  .update({
    tala_total:  supabase.rpc ? undefined : undefined,  // see note below
    updated_at:  new Date().toISOString()
  })
  .eq('id', studentId)
```

Note: Supabase does not support atomic increment via the JS client directly.
Use this pattern instead to avoid race conditions:

```js
// First fetch current tala, then write the new total
const { data: student } = await supabase
  .from('students')
  .select('tala_total')
  .eq('id', studentId)
  .single()

const newTotal = (student?.tala_total || 0) + 20

await supabase
  .from('students')
  .update({ tala_total: newTotal, updated_at: new Date().toISOString() })
  .eq('id', studentId)
```

**Error handling:** Every Supabase call in `saveLesson` must be wrapped in
try/catch. A failure must log to console but NEVER throw or block the UI.
The lesson must always display even if saving fails.

### 2. Fix Tala persistence in App.jsx

In the existing `restoreProfile` function in `App.jsx`, the student row is
already fetched. Add one line to restore the tala into AppContext state:

```js
// Inside the restoreProfile useEffect, after if (student) {
if (student.tala_total !== undefined) {
  setTala(student.tala_total)
}
```

This requires `setTala` to be exposed from AppContext. Currently `setTala`
is internal to AppContext and not exported in the context value. Export it.

### 3. Fix tala hardcode in AppContext

Change:
```js
const [tala, setTala] = useState(145)
```
To:
```js
const [tala, setTala] = useState(0)
```

And add `setTala` to the AppContext.Provider value object.

### 4. Wire useSession into useAnalysis

In `src/hooks/useAnalysis.js`, import and call `saveLesson` after a successful
Pass 2 result, before `setAppScreen('results')`:

```js
// Add to imports
import { useSession } from './useSession'

// Add inside useAnalysis()
const { saveLesson } = useSession()

// Add inside runPass2(), after validating lesson data, before setAppScreen:
await saveLesson(lesson, check)  // non-blocking — errors handled inside hook
```

## Technical Context

- **File to create:**
  - `src/hooks/useSession.js`

- **Files to modify:**
  - `src/hooks/useAnalysis.js` — import and call saveLesson
  - `src/context/AppContext.jsx` — change tala default to 0, export setTala
  - `src/App.jsx` — add setTala to restoreProfile, add to useApp destructure

- **Files to NOT modify:**
  - `src/lib/supabase.js`
  - `src/prompts/pass1.js`
  - `src/prompts/pass2.js`
  - `src/lib/api.js`

- **SQL to run in Supabase before implementing:**
```sql
alter table vocabulary_mastered
  add constraint vocabulary_mastered_student_word_unique
  unique (student_id, word);
```

## What `lessonData` and `check` Look Like

For reference, here is the shape of the two objects passed to `saveLesson`:

**`check` object (from Pass 1):**
```json
{
  "topic": "Pang-uri (Adjectives)",
  "subject_detected": "Filipino",
  "content_type": "worksheet",
  "grade_level_estimate": "Grade 4",
  "language_detected": "Filipino",
  "key_vocabulary": ["mabait", "masipag", "malinis"],
  "competency_clues": ["Nagagamit ang pang-uri"]
}
```

**`lessonData` object (from Pass 2):**
```json
{
  "topic": "Pang-uri (Adjectives)",
  "subject": "Filipino",
  "lesson": {
    "title": "What Are Adjectives?",
    "key_terms": [
      { "term": "mabait", "definition": "kind / good-natured" },
      { "term": "masipag", "definition": "hardworking" }
    ]
  },
  "quiz": [...],
  "flashcards": [...]
}
```

## Acceptance Criteria

- [ ] `src/hooks/useSession.js` exists and exports `useSession`
- [ ] After completing a scan and viewing results, a new row appears in
      `lesson_history` in Supabase Table Editor
- [ ] `vocabulary_mastered` table gains rows for each key_term in the lesson
- [ ] Tala default is 0 (not 145) in AppContext
- [ ] `setTala` is exported from AppContext context value
- [ ] After a hard refresh, the Tala count shown in the header matches the
      `tala_total` stored in the `students` table
- [ ] A Supabase failure in `saveLesson` does NOT prevent the lesson from
      displaying -- the results screen always appears
- [ ] No console errors on normal lesson completion
- [ ] The unique constraint on `(student_id, word)` exists in `vocabulary_mastered`

## Notes

- `saveLesson` is called with `await` in `useAnalysis.js` but any internal
  errors must be caught inside the hook itself. The caller should never
  need to handle errors from `saveLesson`.
- The `quiz_score` field in `lesson_history` is saved as `null` initially.
  Updating it when the student completes the quiz is out of scope for this
  ticket — that is TICKET_0005 territory.
- The `tala_earned` field is hardcoded to 20 for now (matching the current
  `earnTala(20)` call in useAnalysis). Dynamic Tala calculation is
  TICKET_0005.
- For MVP, `times_seen` in vocabulary_mastered does not truly increment --
  it is overwritten with 1 on each upsert. True spaced repetition tracking
  requires a Postgres RPC function and is out of scope for Phase 3.
