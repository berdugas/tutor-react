const WORKER_URL = 'https://aralmate-proxy.maykel-clarin.workers.dev'
const APP_SECRET = 'aralmate-2026'

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
    return { chunk: null }  // never throw — lesson must always proceed
  }
}

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
      // Log full detail so we can diagnose failures
      console.warn('[AralMate] Lesson cache failed (non-blocking):', data.error, data.detail || '', 'HTTP:', data.http_status || '')
    }
  } catch (err) {
    console.warn('[AralMate] Lesson cache failed (non-blocking):', err.message)
    // Never rethrow — this must never affect the lesson experience
  }
}

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
        model: 'kimi-k2.5',
        max_tokens: maxTokens,
        // Disable thinking mode — we need structured JSON output, not reasoning chains.
        // Thinking mode burns tokens on internal reasoning before writing output,
        // which causes truncation on dense content.
        // Note: 'thinking' is a top-level field in the raw Kimi API (not extra_body).
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: prompt
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
        model: 'kimi-k2.5',
        max_tokens: maxTokens,
        // Disable thinking mode — structured JSON output does not benefit from
        // chain-of-thought reasoning, and thinking tokens burn the output budget.
        // Note: 'thinking' is a top-level field in the raw Kimi API (not extra_body).
        thinking: { type: 'disabled' },
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
