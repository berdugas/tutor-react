# TICKET_0005 — Reset Flow, Tala Sync, and Phase 3 Cleanup

**Created by:** Product Lead
**Date:** 2026-04-12
**Priority:** High
**Depends on:** TICKET_0003 (Tala in Supabase), TICKET_0004 (student context)

## Background

TICKET_0001 through TICKET_0004 are complete. The core Phase 3 data layer
is working — student profiles persist, lesson history saves, vocabulary
accumulates, and student context feeds into the AI prompts.

This final Phase 3 ticket cleans up three remaining issues:

1. The reset flow is broken — `resetApp()` clears React state but leaves
   the anonymous session and Supabase data intact. After a reset, the app
   should return to the upload screen (not the name screen), because the
   student is still logged in with a valid profile.

2. The `restoreProfile` useEffect in App.jsx has a missing dependency
   (`setTala`) in its dependency array. Minor but should be fixed.

3. After a lesson, the Tala shown in the header updates correctly in memory
   via `earnTala(20)`, but the value in Supabase is updated separately by
   `useSession`. If the user refreshes immediately after earning Tala, the
   header briefly shows the old value until the restore completes. This
   needs a loading state to prevent a flash of wrong data.

## What Needs to Change

### 1. Fix `resetApp` in AppContext.jsx

The current `resetApp` function resets lesson state but sets `appScreen`
back to `'upload'` which is correct. However, it does NOT clear the student
name, grade, or tala — those should persist across resets. A reset means
"start a new scan", not "log out".

Current `resetApp` is almost correct. The only issue is that it already sets
`setAppScreen('upload')` — so if the app is showing the name screen after
reset, something else is causing it.

**Check:** confirm that after calling `resetApp()`, the app lands on the
upload screen with the student name still showing in the header. If it
already works this way, no change needed here. If it lands on the name
screen, the fix is to ensure `resetApp` does not reset `studentName`,
`tala`, `gradeLevel`, or `schoolQuarter`.

The current `resetApp` in AppContext.jsx correctly does NOT reset those
fields. No change needed if behavior is correct.

### 2. Fix the `restoreProfile` useEffect dependency array in App.jsx

The `useEffect` that restores the student profile on load is missing `setTala`
from its dependency array:

```js
// Current (missing setTala):
}, [setStudentName, setGradeLevel, setSchoolQuarter, setAppScreen])

// Fixed:
}, [setStudentName, setGradeLevel, setSchoolQuarter, setTala, setAppScreen])
```

This is a minor lint warning but should be fixed for correctness.

### 3. Add a loading state to prevent Tala flash on restore

Currently when the app loads, Tala starts at `0` (from `useState(0)`) and
then jumps to the real value (e.g. `140`) once `restoreProfile` completes.
This causes a visible flash from 0 to 140 in the header star badge.

Fix by adding a `profileLoading` state to AppContext:

```js
// Add to AppContext.jsx
const [profileLoading, setProfileLoading] = useState(true)
```

Export it in the context value. In `App.jsx`, set it to false after
`restoreProfile` completes:

```js
// In restoreProfile, at the very end (both branches):
async function restoreProfile() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setProfileLoading(false)  // no session -- show onboarding
      return
    }
    const { data: student } = await supabase
      .from('students')
      .select('name, grade_level, school_quarter, school_type, tala_total')
      .eq('id', session.user.id)
      .single()

    if (student) {
      setStudentName(student.name)
      if (student.grade_level) setGradeLevel(student.grade_level)
      if (student.school_quarter) setSchoolQuarter(student.school_quarter)
      if (student.tala_total !== undefined) setTala(student.tala_total)
      setAppScreen('upload')
    }
  } catch (err) {
    console.error('[AralMate] restoreProfile error:', err.message)
  } finally {
    setProfileLoading(false)  // always clear loading
  }
}
```

In `AppShell`, while `profileLoading` is true, show `…` instead of the
Tala number so there is no flash:

```jsx
// In AppShell, wherever tala is rendered:
{profileLoading ? '…' : tala}
```

This requires passing `profileLoading` as a prop to AppShell, or reading
it from context inside AppShell directly.

### 4. Handle the race condition in restoreProfile

The current `restoreProfile` calls `supabase.auth.getSession()` immediately
on mount. But `supabase.js` calls `signInAnonymously()` asynchronously at
module load time -- it may not have resolved yet when `restoreProfile` runs.

Apply the same retry pattern used in `useStudentContext.js`:

```js
// Replace the single getSession() call in restoreProfile with:
let session = null
for (let attempt = 0; attempt < 5; attempt++) {
  const { data } = await supabase.auth.getSession()
  if (data?.session?.user?.id) {
    session = data.session
    break
  }
  await new Promise(r => setTimeout(r, 300))
}
if (!session) {
  setProfileLoading(false)
  return
}
```

This ensures the profile restore always runs with a valid session, even if
the anonymous sign-in is still resolving when the component mounts.

## Technical Context

- **Files to modify:**
  - `src/context/AppContext.jsx` — add `profileLoading` state, export it
  - `src/App.jsx` — fix dependency array, add retry loop, set profileLoading
  - `src/components/AppShell/AppShell.jsx` — use profileLoading for Tala display

- **Files to NOT modify:**
  - `src/hooks/useAnalysis.js`
  - `src/hooks/useSession.js`
  - `src/hooks/useStudentContext.js`
  - `src/prompts/pass1.js`
  - `src/prompts/pass2.js`
  - `src/lib/supabase.js`

## Acceptance Criteria

- [ ] After completing a lesson and tapping Reset, the app returns to the
      upload screen with the student name and Tala still showing in the header
- [ ] Hard refresh shows `…` in the Tala badge briefly, then snaps to the
      correct persisted value — no flash from 0 to the real number
- [ ] Hard refresh restores the correct student name without showing the
      name screen
- [ ] No `[AralMate]` errors in the console on normal app load
- [ ] `restoreProfile` useEffect dependency array includes `setTala`
- [ ] `profileLoading` starts as `true` and becomes `false` after restore
      completes (verify via React DevTools if needed)

## Notes

- This ticket intentionally does NOT implement logout or account switching.
  Those are Phase 4 features. The reset flow in Phase 3 means "scan again",
  not "start over as a new student".
- Do not add a "Log out" or "Switch student" button anywhere in this ticket.
- The `profileLoading` state should only affect the Tala display in AppShell.
  Do not use it to show a full-screen loading spinner -- the app should be
  usable immediately, with just the star count showing `…` briefly.
- After this ticket is complete, Phase 3 is fully done and the team moves
  to RAG integration (TICKET_0006 onwards).
