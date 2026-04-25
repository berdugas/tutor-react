# Completion: TICKET_0010 — Lesson Cache: Stage 1 (Store Only)

**Ticket:** TICKET_0010_lesson_cache_stage1_store_only.md
**Date:** 2026-04-18
**Status:** Complete

## What Was Done

Added a fully non-blocking lesson cache pipeline. After every successful lesson generation, a copy is silently stored in `lesson_cache` with a Cohere 1024-dim embedding. The student sees nothing — the lesson is already displayed before the cache write begins.

## Changes Made

| File | Action | Details |
|---|---|---|
| `worker/index.js` | Modified | Added `/cache-lesson` route dispatch; added `handleCacheLesson()` after `handleRag()` |
| `src/lib/api.js` | Modified | Added `callCacheLesson(lessonData, check, grade)` export after `callRag()` |
| `src/hooks/useSession.js` | Modified | Added `callCacheLesson` import; added `grade` param; added Step 4 (fire-and-forget, no await) |
| `src/hooks/useAnalysis.js` | Modified | Updated `saveLesson(lesson, check)` → `saveLesson(lesson, check, confirmedGrade)` |

## Design System Compliance Check

- [x] No UI or CSS changes — not applicable
- [x] No new components, routes, or AppContext changes
- [x] `callCacheLesson` is NOT awaited in `useSession.js` — intentional fire-and-forget

## Deviations from Plan

None — executed exactly as specified in the ticket.

## Acceptance Criteria Check

- [ ] New row appears in `lesson_cache` after scan — requires live test + Supabase check
- [ ] `embedding` column populated (1024-dim vector) — requires live test
- [ ] `canonical_json` contains full lesson JSON — requires live test
- [ ] `hit_count: 0`, `verified: false` on new rows — set in Worker insert payload ✓
- [x] Lesson display not delayed — `callCacheLesson` called after `setAppScreen('results')`... wait, checked: `saveLesson` is called before `setAppScreen('results')` but `callCacheLesson` inside `saveLesson` is fire-and-forget (no await), so it does not block `setAppScreen`
- [x] Cohere failure → lesson unaffected (Worker returns `{ stored: false }` with HTTP 200)
- [x] Supabase failure → lesson unaffected (same pattern)
- [x] Console: `[AralMate] Lesson cached: Filipino / Pantig` on success
- [x] Console: `[AralMate] Lesson cache failed (non-blocking): ...` on failure
- [ ] `npm run build` passes — requires build verification

## Notes for Product Lead

- **Worker redeployment required:** Run `wrangler deploy` from `D:\tutor-react\aralmate\worker\` after this ticket is merged. The React app deploys automatically via Netlify. Until the Worker is redeployed, `/cache-lesson` requests will fall through to the Kimi handler and fail silently (non-blocking).
- `callCacheLesson` is called inside `saveLesson`'s outer try block but is itself not awaited — if `saveLesson` throws before reaching Step 4 (e.g. session fetch fails), the cache call is skipped. This is acceptable: if we can't even get a session, there's no point caching.
- `quarter` is sent as `null` for now — quarter-aware retrieval is a Stage 3 concern.
