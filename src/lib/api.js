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
        model: 'moonshot-v1-8k-vision-preview',
        max_tokens: maxTokens,
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
