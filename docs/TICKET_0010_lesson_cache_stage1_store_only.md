# TICKET_0010 — Lesson Cache: Stage 1 (Store Only)

**Created by:** Product Lead
**Date:** 2026-04-18
**Priority:** High

---

## Background

This ticket implements Stage 1 of the lesson cache system — **data accumulation only**.

No retrieval, no cache serving, no personalization pass. Those come in Stage 3 after
shadow-mode validation. The sole purpose of this ticket: after every successful lesson
generation, silently save a copy to `lesson_cache` in Supabase with a Cohere embedding.
Miguel notices nothing. The lesson display is never delayed or blocked.

The data gathered during MVP testing is valuable — every scan is a human-validated
curriculum artifact. By the time cache serving is enabled (Stage 3), the most common
Grade 4 topics will already have verified cached lessons ready to serve instantly.

### Already done (product lead)
- `lesson_cache` table created in Supabase with RLS enabled ✅
- Columns: id (uuid), topic (text), subject (text), grade (text), quarter (int4),
  embedding (vector 1024), canonical_json (jsonb), hit_count (int, default 0),
  verified (bool, default false), quality_score (int nullable),
  generated_from (text), created_at (timestamptz), updated_at (timestamptz)

### What this ticket builds
Three pieces across three files:

1. **`worker/index.js`** — new `/cache-lesson` POST route
2. **`src/lib/api.js`** — new `callCacheLesson()` function
3. **`src/hooks/useSession.js`** — call `callCacheLesson()` at end of `saveLesson()`

### After implementation
Product lead deploys the updated Worker to Cloudflare (`wrangler deploy`).
The React app deploys automatically via Netlify on push. No new Worker secrets
needed — `COHERE_API_KEY` and `SUPABASE_SERVICE_KEY` are already configured.

---

## Requirements

### Must Have
- [ ] Worker `/cache-lesson` route: embed topic+subject via Cohere, insert row
      into `lesson_cache` via Supabase service key
- [ ] `callCacheLesson()` in `api.js`: fire-and-forget POST to `/cache-lesson`,
      never throws, never blocks the caller
- [ ] `useSession.js` calls `callCacheLesson()` after all existing save steps
- [ ] Failure of cache save never affects lesson display — fully non-blocking
- [ ] Console log on success: `[AralMate] Lesson cached: ${subject} / ${topic}`
- [ ] Console log on failure: `[AralMate] Lesson cache failed (non-blocking): ${err}`

### Nice to Have
- [ ] Nothing — scope is tightly defined. Do not add other changes.

---

## Technical Context

- **Files to modify:**
  - `worker/index.js`
  - `src/lib/api.js`
  - `src/hooks/useSession.js`
- **No other files** — no UI, no AppContext, no prompt changes
- **No new Worker secrets** — `COHERE_API_KEY` and `SUPABASE_SERVICE_KEY` already exist
- **Embedding model:** Cohere `embed-multilingual-v3.0` (1024 dims) — same as RAG
- **Embedding string:** `"${subject} ${topic}"` — same pattern as RAG, no grade in embedding
- **Grade handling:** stored as a column (`grade text`), used as filter in Stage 3 retrieval
- **input_type:** `"search_document"` for storage (vs `"search_query"` for RAG retrieval)
  — this is a Cohere distinction that improves retrieval quality in Stage 3
- **No deduplication:** always insert in Stage 1. Stage 3 similarity threshold handles
  selecting the best match from multiple stored entries for the same topic.
- **RLS:** lesson_cache has RLS enabled. Service key bypasses RLS — Worker inserts work.
  The React app anon key cannot write to this table directly — correct by design.

---

## Exact Specifications

### Change 1 — `worker/index.js`: Add `/cache-lesson` route

**Step A** — Add route dispatch in the main `fetch()` handler, after the `/rag` check:

```javascript
// Route: POST /cache-lesson — Lesson cache storage (Stage 1)
if (url.pathname === "/cache-lesson") {
  return handleCacheLesson(request, env);
}
```

**Step B** — Add handler function after `handleRag()`:

```javascript
// ── Lesson cache storage ──────────────────────────────────────────────────────

async function handleCacheLesson(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return corsResponse(JSON.stringify({ error: "Invalid JSON" }), 400);
  }

  const { topic, subject, grade, quarter, lesson_json, generated_from } = body;

  if (!topic || !subject || !grade || !lesson_json) {
    return corsResponse(
      JSON.stringify({ error: "topic, subject, grade, lesson_json required" }),
      400
    );
  }

  try {
    // Step 1 — Embed using Cohere multilingual-v3.0
    // input_type "search_document" for storage; "search_query" used during retrieval
    // Embedding string: "${subject} ${topic}" — same pattern as RAG, no grade in string
    const embedResponse = await fetch("https://api.cohere.com/v1/embed", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.COHERE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "embed-multilingual-v3.0",
        texts: [`${subject} ${topic}`],
        input_type: "search_document"
      })
    });

    if (!embedResponse.ok) {
      const err = await embedResponse.text();
      console.error("Cohere embed error (cache-lesson):", err);
      // Return 200 with stored: false — caller treats this as non-blocking failure
      return corsResponse(JSON.stringify({ stored: false, error: "embedding failed" }), 200);
    }

    const embedData = await embedResponse.json();
    const embedding = embedData.embeddings[0];

    // Step 2 — Insert into lesson_cache
    // Always insert — no deduplication in Stage 1
    const insertResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/lesson_cache`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": env.SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({
          topic,
          subject,
          grade,
          quarter:        quarter || null,
          embedding,
          canonical_json: lesson_json,
          generated_from: generated_from || topic,
          hit_count:      0,
          verified:       false
        })
      }
    );

    if (!insertResponse.ok) {
      const err = await insertResponse.text();
      console.error("Supabase insert error (cache-lesson):", err);
      return corsResponse(JSON.stringify({ stored: false, error: "insert failed" }), 200);
    }

    return corsResponse(JSON.stringify({ stored: true }), 200);

  } catch (err) {
    console.error("handleCacheLesson error:", err.message);
    // Always return 200 — never crash the lesson flow
    return corsResponse(JSON.stringify({ stored: false, error: err.message }), 200);
  }
}
```

---

### Change 2 — `src/lib/api.js`: Add `callCacheLesson()`

Add after `callRag()`, before `callWorkerText()`:

```javascript
export async function callCacheLesson(lessonData, check, grade) {
  // Fire-and-forget — never throws, never blocks the lesson display
  try {
    const resp = await fetch(`${WORKER_URL}/cache-lesson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AralMate-Secret': APP_SECRET
      },
      body: JSON.stringify({
        topic:          check.topic || '',
        subject:        check.subject_detected || '',
        grade:          grade || check.grade_level_estimate || 'Grade 4',
        quarter:        null,   // quarter filtering deferred to Stage 3
        lesson_json:    lessonData,
        generated_from: check.topic || ''
      })
    })
    const data = await resp.json()
    if (data.stored) {
      console.log('[AralMate] Lesson cached:', check.subject_detected, '/', check.topic)
    } else {
      console.warn('[AralMate] Lesson cache failed (non-blocking):', data.error)
    }
  } catch (err) {
    console.warn('[AralMate] Lesson cache failed (non-blocking):', err.message)
    // Never rethrow — this must never affect the lesson experience
  }
}
```

---

### Change 3 — `src/hooks/useSession.js`: Call `callCacheLesson()`

**Step A** — Add import at the top of the file:

```javascript
import { callCacheLesson } from '../lib/api'
```

**Step B** — Add `grade` parameter to `saveLesson()`:

```javascript
async function saveLesson(lessonData, check, grade) {
```

**Step C** — Add cache save as the final step inside `saveLesson()`, after the
existing Step 3 (tala_total update), still inside the outer try block:

```javascript
      // Step 4 — Save to lesson cache (Stage 1: store only, non-blocking)
      // Never awaited in a way that blocks — fire and move on
      callCacheLesson(lessonData, check, grade)

    } catch (err) {
      // Outer catch — session fetch or unexpected failure. Never blocks UI.
      console.error('[AralMate] saveLesson unexpected error:', err.message)
    }
```

Note: `callCacheLesson` is called without `await` intentionally here — it is
truly fire-and-forget. The lesson is already displayed to the student by the time
this runs. If the cache save fails, nothing visible changes for Miguel.

---

### `useAnalysis.js` — Update `saveLesson` call site

In `useAnalysis.js`, `saveLesson` is called as:
```javascript
await saveLesson(lesson, check)
```

This must be updated to pass the confirmed grade:
```javascript
await saveLesson(lesson, check, confirmedGrade)
```

The dev team must locate this call in `runPass2()` and add `confirmedGrade` as
the third argument. `confirmedGrade` is already in scope at that point.

---

## Files Modified Summary

| File | Change |
|---|---|
| `worker/index.js` | Add `/cache-lesson` route dispatch + `handleCacheLesson()` function |
| `src/lib/api.js` | Add `callCacheLesson()` function |
| `src/hooks/useSession.js` | Import `callCacheLesson`, add `grade` param, add Step 4 |
| `src/hooks/useAnalysis.js` | Pass `confirmedGrade` to `saveLesson()` call |

---

## Acceptance Criteria

- [ ] After a successful lesson scan, a new row appears in the `lesson_cache`
      Supabase table with correct topic, subject, and grade values
- [ ] The `embedding` column is populated (not null) — 1024-dimension vector
- [ ] The `canonical_json` column contains the full lesson JSON object
- [ ] The `hit_count` is 0 and `verified` is false on new rows
- [ ] The lesson display is not delayed — the save happens after the results
      screen is shown, not before
- [ ] If the Cohere embed call fails, the lesson still displays normally
- [ ] If the Supabase insert fails, the lesson still displays normally
- [ ] Console shows `[AralMate] Lesson cached: Filipino / Pantig` on success
- [ ] Console shows `[AralMate] Lesson cache failed (non-blocking): ...` on failure
- [ ] `npm run build` passes with no errors

---

## Notes

- The Worker must be redeployed by the product lead after this ticket executes.
  The dev team writes the code; the product lead runs `wrangler deploy` from
  `D:\tutor-react\aralmate\worker\` or deploys via the Cloudflare dashboard.
- No new Worker secrets are needed — `COHERE_API_KEY` and `SUPABASE_SERVICE_KEY`
  are already configured in the Cloudflare Worker environment.
- `callCacheLesson` is intentionally NOT awaited in `useSession.js` — it is
  fire-and-forget. Do not add `await`. Do not wrap it in try/catch in the caller
  (the function handles its own errors internally).
- The `quarter` field is sent as `null` for now. Quarter-aware retrieval is a
  Stage 3 concern — the column exists for future use.
- Do not add any UI, loading states, or user-facing feedback for the cache save.
  It is entirely invisible to the student.
- After this ticket is verified, the product lead should scan several worksheets
  and confirm rows are appearing in the `lesson_cache` Supabase table before
  moving to Stage 2 (shadow mode).
