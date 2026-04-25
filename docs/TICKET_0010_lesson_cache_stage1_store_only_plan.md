# Plan: TICKET_0010 — Lesson Cache: Stage 1 (Store Only)

**Ticket:** TICKET_0010_lesson_cache_stage1_store_only.md
**Date:** 2026-04-18
**Status:** Awaiting Approval

## Summary

After every successful lesson generation, silently save a copy to `lesson_cache` in Supabase with a Cohere 1024-dim embedding. Fully fire-and-forget — never blocks the lesson display, never visible to the student. Four files touched.

## Implementation Plan

### Phase 1 — `worker/index.js`

- [ ] Add `/cache-lesson` route dispatch after the `/rag` check
- [ ] Add `handleCacheLesson()` function after `handleRag()`:
  - Validates required fields: `topic`, `subject`, `grade`, `lesson_json`
  - Embeds `"${subject} ${topic}"` via Cohere `embed-multilingual-v3.0` with `input_type: "search_document"`
  - Inserts row into `lesson_cache` via Supabase service key
  - Returns `{ stored: true }` on success, `{ stored: false, error: "..." }` on failure
  - Always returns HTTP 200 — never returns a 5xx that could surface as a JS exception

### Phase 2 — `src/lib/api.js`

- [ ] Add `callCacheLesson(lessonData, check, grade)` after `callRag()`, before `callWorkerText()`
  - POSTs to `${WORKER_URL}/cache-lesson` with `X-AralMate-Secret` header
  - Sends: `topic`, `subject`, `grade`, `quarter: null`, `lesson_json`, `generated_from`
  - Logs success/failure to console
  - Never rethrows — all errors caught internally

### Phase 3 — `src/hooks/useSession.js`

- [ ] Add `import { callCacheLesson } from '../lib/api'` at top
- [ ] Add `grade` as third parameter to `saveLesson(lessonData, check, grade)`
- [ ] Add Step 4 as the final step inside the outer try block (after tala_total update):
  ```javascript
  callCacheLesson(lessonData, check, grade)  // no await — fire-and-forget
  ```

### Phase 4 — `src/hooks/useAnalysis.js`

- [ ] Update `saveLesson` call in `runPass2()` from:
  ```javascript
  await saveLesson(lesson, check)
  ```
  to:
  ```javascript
  await saveLesson(lesson, check, confirmedGrade)
  ```
  `confirmedGrade` is already in scope at this point.

### Phase 5 — Completion file

- [ ] Write completion doc

## Files to Be Created / Modified

| File | Action | Purpose |
|---|---|---|
| `worker/index.js` | Modify | Add `/cache-lesson` route + `handleCacheLesson()` |
| `src/lib/api.js` | Modify | Add `callCacheLesson()` export |
| `src/hooks/useSession.js` | Modify | Import + call `callCacheLesson` as Step 4 |
| `src/hooks/useAnalysis.js` | Modify | Pass `confirmedGrade` to `saveLesson()` |

## Design System Compliance

Not applicable — no UI or CSS changes.

## Dependencies and Risks

- `lesson_cache` table already exists in Supabase with RLS enabled (product lead confirmed)
- `COHERE_API_KEY` and `SUPABASE_SERVICE_KEY` already in Worker environment (no new secrets)
- Worker must be redeployed by product lead after this ticket — code change only
- `callCacheLesson` intentionally NOT awaited in `useSession.js` — fire-and-forget by design

## Estimated Scope

- **Files affected:** 4
- **Complexity:** Low — specifications are exact, pattern follows existing RAG handler
