# TICKET_0002 — Onboarding Flow: Save Student Profile to Supabase

**Created by:** Product Lead
**Date:** 2026-04-12
**Priority:** Critical
**Depends on:** TICKET_0001 (must be complete and verified first)

## Background

TICKET_0001 is complete. Supabase is connected and anonymous auth is working.
The app currently shows "mike" in the header because `App.jsx` reads the name
from `localStorage` (`am_student_name`). The `NameScreen` component only asks
for a name and writes it to localStorage — nothing goes to Supabase.

This ticket extends the onboarding flow to collect the student profile (name,
grade level, school quarter, school type) and save it to the `students` table
in Supabase. After this ticket, every student has a real persisted profile tied
to their anonymous auth session.

## What Needs to Change

### 1. Extend NameScreen to a multi-step onboarding form

The current `NameScreen` has one field: name. Extend it to three steps shown
in sequence on the same screen:

**Step 1 — Name**
- Existing input: "What's your name?"
- No change to the input itself
- Change: do NOT save to localStorage here — just advance to Step 2

**Step 2 — Grade and Quarter**
- Question: "Anong baitang ka na?" (What grade are you in?)
- Dropdown or button group: Grade 1, Grade 2, Grade 3, Grade 4, Grade 5,
  Grade 6, Grade 7
- Question: "Anong quarter na ngayon?" (What quarter is it now?)
- Dropdown or button group: Quarter 1, Quarter 2, Quarter 3, Quarter 4

**Step 3 — School Type**
- Question: "Anong klase ng paaralan mo?" (What kind of school?)
- Two large buttons: "🏫 Private" and "🏛️ Public"
- Tapping either saves the profile and advances to the upload screen

### 2. Save the profile to Supabase on Step 3 completion

When the student taps Private or Public on Step 3, call Supabase to upsert the
student row. Use the current anonymous auth session user ID as the primary key.

The upsert must write these fields to the `students` table:
- `id` — from `supabase.auth.getSession()` → `session.user.id`
- `name` — from Step 1
- `grade_level` — from Step 2 (e.g. "Grade 4")
- `school_quarter` — from Step 2 as integer (1, 2, 3, or 4)
- `school_type` — from Step 3 ("private" or "public")
- `tala_total` — set to 0 on first save
- `updated_at` — set to `new Date().toISOString()`

```js
// Example upsert pattern
const { data: { session } } = await supabase.auth.getSession()
const { error } = await supabase
  .from('students')
  .upsert({
    id: session.user.id,
    name,
    grade_level: gradeLevel,
    school_quarter: schoolQuarter,
    school_type: schoolType,
    tala_total: 0,
    updated_at: new Date().toISOString()
  })
```

If the upsert fails, log the error to the console but do NOT block the user
from continuing. The app must still advance to the upload screen.

### 3. Update App.jsx — restore profile from Supabase on load

Replace the current localStorage restore logic in `App.jsx` with a Supabase
lookup. On app load:

1. Get the current session from `supabase.auth.getSession()`
2. If a session exists, query `students` table for that user's row
3. If a row exists, set `studentName` from the row and advance to `upload`
   screen
4. If no row exists (new user), stay on the `name` screen (onboarding)
5. If no session exists at all, stay on the `name` screen

```js
// Example restore pattern in App.jsx useEffect
const { data: { session } } = await supabase.auth.getSession()
if (!session) return  // stays on name screen

const { data: student } = await supabase
  .from('students')
  .select('name, grade_level, school_quarter, school_type, tala_total')
  .eq('id', session.user.id)
  .single()

if (student) {
  setStudentName(student.name)
  setAppScreen('upload')
}
// if no student row — stays on name screen (new user, run onboarding)
```

### 4. Update AppContext — add gradeLevel and schoolQuarter to state

Add two new state fields to `AppContext.jsx`:
- `gradeLevel` — string, default `'Grade 4'`
- `schoolQuarter` — integer, default `1`
- `setGradeLevel` and `setSchoolQuarter` exposed in context value

These will be needed by TICKET_0004 when injecting student context into
the AI prompts.

### 5. Remove localStorage dependency for student name

- Remove `localStorage.getItem('am_student_name')` from `App.jsx`
- Remove `localStorage.setItem('am_student_name', name)` from `NameScreen.jsx`
- Remove `localStorage.setItem('am_student_name', name)` from the
  `handleEditName` function in `App.jsx`

Do NOT remove the `handleEditName` function itself — just stop writing to
localStorage. Supabase is now the source of truth.

## Technical Context

- **Files to modify:**
  - `src/components/NameScreen/NameScreen.jsx` — extend to multi-step
  - `src/components/NameScreen/NameScreen.module.css` — add styles for steps
  - `src/context/AppContext.jsx` — add gradeLevel, schoolQuarter state
  - `src/App.jsx` — replace localStorage restore with Supabase lookup

- **Files to import in modified files:**
  - `import { supabase } from '../../lib/supabase.js'` — in NameScreen
  - `import { supabase } from '../lib/supabase.js'` — in App.jsx

- **Files to NOT modify:**
  - `src/lib/supabase.js` — already correct
  - `src/lib/constants.js` — already correct
  - `src/lib/api.js` — not related

- **Related tickets:**
  - TICKET_0001 (prerequisite — must be done)
  - TICKET_0003 (depends on this — useSession writes lesson history)
  - TICKET_0004 (depends on this — gradeLevel used in prompts)

## Design Constraints

- The three onboarding steps must feel like a conversation with Alon, not a
  form. Use Alon's emoji (🦅) and friendly Filipino/English language.
- Use button groups (large tappable cards) for grade, quarter, and school
  type — not dropdowns. This is a tablet-first app used by 9–11 year olds.
- Step indicator (e.g. 1 of 3) should be visible at the top of the screen.
- Use existing CSS variables from `src/styles/tokens.css` for all colors.
  No hardcoded hex values.
- Fonts: Baloo 2 for headings, Nunito for body text — same as the rest of
  the app.
- The transition between steps should be smooth — a simple fade or slide.
- Do NOT add a back button between steps for MVP. Forward only.

## Grade Options

Use these exact values for the grade_level field:
```
'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
'Grade 5', 'Grade 6', 'Grade 7'
```

Note: this is more granular than the existing GRADE_OPTIONS in constants.js
which are detection labels (Grade 1-2, Grade 3, etc.). The onboarding grade
is the student's actual grade — store exactly as "Grade 4" etc.

## Acceptance Criteria

- [ ] NameScreen shows 3 steps in sequence: Name → Grade+Quarter → School Type
- [ ] Tapping "Let's go" on Step 1 advances to Step 2 (no Supabase call yet)
- [ ] Step 2 shows 7 grade buttons and 4 quarter buttons, all selectable
- [ ] Step 3 shows Private and Public buttons
- [ ] Tapping Private or Public saves the student profile to Supabase and
      advances to the upload screen
- [ ] The `students` table in Supabase has a new row after onboarding
      (verify in Supabase Table Editor)
- [ ] On next app load (hard refresh), the student's name is restored from
      Supabase and the upload screen is shown directly (onboarding is skipped)
- [ ] If the Supabase upsert fails, a console.error is logged but the user
      still reaches the upload screen
- [ ] `localStorage` is no longer used for student name anywhere in the app
- [ ] `gradeLevel` and `schoolQuarter` are available in AppContext
- [ ] No hardcoded colors — CSS variables only
- [ ] No console errors on load or after onboarding completion

## Notes

- There will be multiple anonymous users in Supabase from TICKET_0001 testing.
  These are harmless — they have no `students` row so they will always land on
  the onboarding screen.
- The `handleEditName` function in `App.jsx` allows the student to edit their
  name from the AppShell pencil icon. After this ticket, clicking the pencil
  and saving a new name should also update the `students` table. This is a
  small addition — a single upsert call in `handleEditName`. Do not remove
  `handleEditName`, just make it write to Supabase as well.
- Do NOT ask for weak_subjects during onboarding — that field is populated
  later based on actual lesson history, not user self-report.
- Keep the onboarding fast. A student should be at the upload screen within
  60 seconds of first opening the app.
