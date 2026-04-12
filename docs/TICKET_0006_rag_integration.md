# TICKET_0006 — RAG Integration: Curriculum Context in Pass 2

**Created by:** Product Lead
**Date:** 2026-04-12
**Priority:** High
**Depends on:** TICKET_0005 complete, RAG knowledge base ingested (222 chunks in rag_documents)

## Background

Phase 3 is complete. The student data layer is working — profiles, lesson
history, vocabulary, and student context are all feeding into the AI prompts.

This ticket begins Phase 4: RAG integration. The goal is to connect Alon's
lesson generation to the actual DepEd MATATAG curriculum knowledge base
stored in Supabase's `rag_documents` table (222 chunks, 1536-dim embeddings).

After this ticket, Pass 2 will receive the real curriculum chunk for the
detected topic — the actual learning competencies, content standards, and
performance standards from the MATATAG curriculum guide — and use it as the
authoritative foundation for the lesson it generates.

## Architecture Decision

The embedding call (topic text → vector) and the Supabase vector search
must happen server-side in the Cloudflare Worker — NOT in the React app.

Reason: Both require secret keys (OpenAI API key for embedding, Supabase
service role key for querying rag_documents). These must never be exposed
in the browser.

The flow is:
```
React app
  → POST /rag to Cloudflare Worker (topic + subject + grade_num)
    → Worker calls OpenAI to embed the topic text
    → Worker calls Supabase match_curriculum() RPC with the vector
    → Worker returns the best matching chunk text
  → React app injects chunk into Pass 2 prompt
```

## Part 1 — Cloudflare Worker Changes

### File to modify: `D:\tutor\worker.js`

Add a new route `POST /rag` alongside the existing Kimi proxy route.

The Worker currently handles all POST requests as Kimi proxy calls. Add URL
path routing so:
- `POST /` → existing Kimi proxy (no change)
- `POST /rag` → new RAG retrieval route

### New environment variables needed in Cloudflare Worker

Add these as encrypted Secrets in the Cloudflare dashboard
(Workers → aralmate-proxy → Settings → Variables → Secrets):

- `OPENAI_API_KEY` — OpenAI API key for embeddings
- `SUPABASE_URL` — Supabase project URL (https://jrejfpkxzdajcmbpgzxx.supabase.co)
- `SUPABASE_SERVICE_KEY` — Supabase service role key (from Supabase Settings → API)

The existing `KIMI_API_KEY` and `ARALMATE_SECRET` are unchanged.

### Updated worker.js structure

```js
export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204)
    }

    if (request.method !== "POST") {
      return corsResponse(JSON.stringify({ error: "Method not allowed" }), 405)
    }

    // Validate secret header — applies to ALL routes
    const secret = request.headers.get("X-AralMate-Secret")
    if (!secret || secret !== env.ARALMATE_SECRET) {
      return corsResponse(JSON.stringify({ error: "Unauthorized" }), 401)
    }

    const url = new URL(request.url)

    // Route: POST /rag — RAG curriculum retrieval
    if (url.pathname === "/rag") {
      return handleRag(request, env)
    }

    // Route: POST / — existing Kimi proxy (unchanged)
    return handleKimi(request, env)
  }
}
```

### New `handleRag` function

```js
async function handleRag(request, env) {
  let body
  try {
    body = await request.json()
  } catch {
    return corsResponse(JSON.stringify({ error: "Invalid JSON" }), 400)
  }

  const { topic, subject, grade_num } = body

  if (!topic || !subject) {
    return corsResponse(JSON.stringify({ error: "topic and subject required" }), 400)
  }

  try {
    // Step 1 — Embed the topic using OpenAI text-embedding-3-small
    const embedResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: `${subject} ${topic}`  // prepend subject for better retrieval
      })
    })

    if (!embedResponse.ok) {
      const err = await embedResponse.text()
      console.error("OpenAI embed error:", err)
      return corsResponse(JSON.stringify({ chunk: null, error: "embedding failed" }), 200)
    }

    const embedData = await embedResponse.json()
    const embedding = embedData.data[0].embedding

    // Step 2 — Query Supabase match_curriculum RPC
    // Note: p_quarter is intentionally null -- students can scan any quarter's
    // material regardless of their current school quarter.
    const supabaseResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/rpc/match_curriculum`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": env.SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
          query_embedding: embedding,
          p_subject:       subject,
          p_grade_num:     grade_num || null,
          p_quarter:       null,
          p_threshold:     0.3,
          p_count:         3
        })
      }
    )

    if (!supabaseResponse.ok) {
      const err = await supabaseResponse.text()
      console.error("Supabase RPC error:", err)
      return corsResponse(JSON.stringify({ chunk: null, error: "retrieval failed" }), 200)
    }

    const results = await supabaseResponse.json()

    if (!results || results.length === 0) {
      // No match found -- return null chunk, app will proceed without it
      return corsResponse(JSON.stringify({ chunk: null, similarity: null }), 200)
    }

    // Return the top result, trimmed to 1500 chars to stay within token budget
    const top = results[0]
    const chunkText = top.chunk_text?.slice(0, 1500) || null

    return corsResponse(JSON.stringify({
      chunk:        chunkText,
      subject:      top.subject,
      grade:        top.grade,
      quarter:      top.quarter_label,
      domain:       top.domain_en,
      similarity:   Math.round(top.similarity * 100) / 100
    }), 200)

  } catch (err) {
    console.error("handleRag error:", err.message)
    // Always return 200 with null chunk -- never crash the lesson flow
    return corsResponse(JSON.stringify({ chunk: null, error: err.message }), 200)
  }
}
```

### Refactor existing Kimi code into `handleKimi`

Move the existing Kimi proxy logic into its own function for cleanliness:

```js
async function handleKimi(request, env) {
  let body
  try {
    body = await request.json()
  } catch {
    return corsResponse(JSON.stringify({ error: "Invalid JSON" }), 400)
  }

  const kimiResponse = await fetch("https://api.moonshot.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.KIMI_API_KEY}`
    },
    body: JSON.stringify(body)
  })

  const data = await kimiResponse.json()
  return corsResponse(JSON.stringify(data), kimiResponse.status)
}
```

## Part 2 — React App Changes

### 1. Add `callRag` to `src/lib/api.js`

Add a new exported function alongside the existing `callWorker`:

```js
export async function callRag(topic, subject, gradeNum) {
  try {
    const resp = await fetch(`${WORKER_URL}/rag`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AralMate-Secret': APP_SECRET
      },
      body: JSON.stringify({
        topic,
        subject,
        grade_num: gradeNum
      })
    })
    const data = await resp.json()
    return data  // { chunk, subject, grade, quarter, domain, similarity } or { chunk: null }
  } catch (err) {
    console.error('[AralMate] callRag error:', err.message)
    return { chunk: null }  // never throw -- lesson must always proceed
  }
}
```

### 2. Create `src/hooks/useRag.js`

```js
import { callRag } from '../lib/api'

export function useRag() {
  async function fetchCurriculumChunk(topic, subject, gradeNum) {
    if (!topic || !subject) return null

    const result = await callRag(topic, subject, gradeNum)

    // Only return the chunk if similarity is meaningful (>= 0.3)
    // A null chunk means Pass 2 proceeds without curriculum context
    if (!result.chunk) {
      console.warn('[AralMate] RAG: no curriculum chunk found for', subject, topic)
      return null
    }

    console.log(
      `[AralMate] RAG: matched ${result.subject} ${result.grade} ${result.quarter}`,
      `(similarity: ${result.similarity})`
    )

    return result.chunk
  }

  return { fetchCurriculumChunk }
}
```

### 3. Update `src/prompts/pass2.js`

Add `curriculumChunk` as a fourth parameter (after `studentContext`):

```js
// Before:
export function buildPass2Prompt(check, studentName, selectedSubject, studentContext)

// After:
export function buildPass2Prompt(check, studentName, selectedSubject, studentContext, curriculumChunk)
```

Add a new curriculum context block, inserted AFTER the `recentTopicsNote`
block and BEFORE the JSON instruction:

```js
const curriculumNote = curriculumChunk
  ? `DEPED MATATAG CURRICULUM REFERENCE:
${curriculumChunk}

Use the learning competencies above as the foundation for this lesson.
- The quiz questions must test the specific competencies listed
- Key terms must align with vocabulary identified in the curriculum
- The lesson overview must address what the curriculum defines as the
  content standard for this topic
- Do not teach concepts beyond what the curriculum specifies for this level`
  : ''
```

Insert `${curriculumNote}` after `${recentTopicsNote}` in the return string.

### 4. Update `src/hooks/useAnalysis.js`

Import `useRag` and call `fetchCurriculumChunk` inside `runPass2`, after
`fetchContext` and before `buildPass2Prompt`:

```js
// Add to imports
import { useRag } from './useRag'

// Add inside useAnalysis()
const { fetchCurriculumChunk } = useRag()

// Add inside runPass2(), after fetchContext:
const studentContext = await fetchContext()

// Get student's grade number for RAG filtering
const gradeNum = parseInt(studentContext?.gradeLevel?.replace('Grade ', '')) || 4

// Fetch curriculum chunk -- non-blocking, returns null if no match
const curriculumChunk = await fetchCurriculumChunk(
  check.topic,
  check.subject_detected || confirmedSubject,
  gradeNum
)

// Pass to prompt builder
const prompt = buildPass2Prompt(
  check,
  studentName,
  confirmedSubject,
  studentContext,
  curriculumChunk
)
```

## Technical Context

- **File to modify (Worker):** `D:\tutor\worker.js`
- **Files to modify (React):**
  - `src/lib/api.js` — add `callRag`
  - `src/prompts/pass2.js` — add `curriculumChunk` parameter
  - `src/hooks/useAnalysis.js` — call `fetchCurriculumChunk`, pass to prompt
- **File to create (React):**
  - `src/hooks/useRag.js`
- **Files to NOT modify:**
  - `src/hooks/useSession.js`
  - `src/hooks/useStudentContext.js`
  - `src/context/AppContext.jsx`
  - `src/prompts/pass1.js`

## Known Word Cap — Fix in useStudentContext.js

As students accumulate vocabulary, the known words list will grow large and
consume too many tokens. Add a cap of 50 most recent words in
`useStudentContext.js`:

Change the vocabulary query from:
```js
supabase
  .from('vocabulary_mastered')
  .select('word')
  .eq('student_id', studentId)
```

To:
```js
supabase
  .from('vocabulary_mastered')
  .select('word, last_seen_at')
  .eq('student_id', studentId)
  .order('last_seen_at', { ascending: false })
  .limit(50)
```

This caps at the 50 most recently seen words — the most relevant ones for
avoiding re-teaching.

## Cloudflare Deployment Steps

After updating `worker.js`, the dev team must redeploy the Worker:

1. Go to Cloudflare Dashboard → Workers & Pages → aralmate-proxy
2. Add the three new Secrets:
   - `OPENAI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
3. Deploy the updated `worker.js` (Edit Code → paste → Save and Deploy)
4. Verify the new route works by calling it directly:

```bash
curl -X POST https://aralmate-proxy.maykel-clarin.workers.dev/rag \
  -H "Content-Type: application/json" \
  -H "X-AralMate-Secret: aralmate-2026" \
  -d '{"topic": "Pang-uri", "subject": "Filipino", "grade_num": 4}'
```

Expected response:
```json
{
  "chunk": "[Filipino | Grade 4 | Quarter 1 | Pakikinig at Pagbasa]\n...",
  "subject": "Filipino",
  "grade": "Grade 4",
  "quarter": "Quarter 1",
  "domain": "Listening and Reading",
  "similarity": 0.82
}
```

## Acceptance Criteria

- [ ] Worker `/rag` route responds correctly to the curl test above
- [ ] Worker returns `{ chunk: null }` gracefully when no match found
      (test with: `{ "topic": "zxqwerty", "subject": "Filipino", "grade_num": 4 }`)
- [ ] `callRag` added to `src/lib/api.js`
- [ ] `src/hooks/useRag.js` created and exports `useRag`
- [ ] `buildPass2Prompt` accepts and uses `curriculumChunk` parameter
- [ ] `buildPass2Prompt` handles `curriculumChunk = null` without throwing
- [ ] After a scan, the Pass 2 prompt contains a `DEPED MATATAG CURRICULUM
      REFERENCE` block with real competency text (verify via temporary
      console.log in runPass2 then remove)
- [ ] If RAG fails or returns null, the scan completes normally without error
- [ ] Vocabulary query in useStudentContext.js capped at 50 most recent words
- [ ] No new console errors on normal scan completion
- [ ] Worker redeployed and live at the existing URL

## Notes

- The `/rag` route always returns HTTP 200 even on internal errors -- it
  returns `{ chunk: null }` instead of throwing. This is intentional.
  A failed RAG call must never break the lesson flow.
- `p_quarter: null` is deliberate. Students scan worksheets from any quarter
  regardless of their current school quarter. The vector similarity handles
  quarter matching automatically through semantic relevance.
- The `grade_num` is parsed from the student's profile gradeLevel string
  (e.g. "Grade 4" → 4). If parsing fails, it defaults to 4.
- Chunk is trimmed to 1500 characters to stay within Kimi's 8k token budget.
  The trim happens in the Worker, not the React app.
- After this ticket is complete and verified, TICKET_0007 and TICKET_0008
  are no longer needed as separate tickets -- this ticket covers the full
  RAG integration end to end (embed + retrieve + inject).
