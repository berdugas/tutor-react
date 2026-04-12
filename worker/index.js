// AralMate Cloudflare Worker — Kimi API Proxy + RAG Retrieval
// Deploy this to Cloudflare Workers.
// Secrets required:
//   KIMI_API_KEY         — Moonshot AI API key
//   ARALMATE_SECRET      — Shared secret for X-AralMate-Secret header
//   COHERE_API_KEY       — Cohere key for embed-multilingual-v3.0 (1024 dims)
//   SUPABASE_URL         — https://jrejfpkxzdajcmbpgzxx.supabase.co
//   SUPABASE_SERVICE_KEY — Supabase service role key
//
// IMPORTANT: Use the endpoint that matches your Moonshot AI account platform:
//   api.moonshot.ai  — international accounts registered at platform.moonshot.ai
//   api.moonshot.cn  — China/mainland accounts registered at platform.moonshot.cn
// Keys are NOT interchangeable between platforms — wrong endpoint = 401 error.
const KIMI_ENDPOINT = "https://api.moonshot.ai/v1/chat/completions";

export default {
  async fetch(request, env) {
    // 1. Handle CORS preflight
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

    // 2. Only allow POST
    if (request.method !== "POST") {
      return corsResponse(JSON.stringify({ error: "Method not allowed" }), 405);
    }

    // 3. Validate secret header — applies to ALL routes
    const secret = request.headers.get("X-AralMate-Secret");
    if (!secret || secret !== env.ARALMATE_SECRET) {
      return corsResponse(JSON.stringify({ error: "Unauthorized" }), 401);
    }

    const url = new URL(request.url);

    // Route: POST /rag — RAG curriculum retrieval
    if (url.pathname === "/rag") {
      return handleRag(request, env);
    }

    // Route: POST / — Kimi vision proxy (default)
    return handleKimi(request, env);
  }
};

// ── Kimi proxy ────────────────────────────────────────────────────────────────

async function handleKimi(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return corsResponse(JSON.stringify({ error: "Invalid JSON" }), 400);
  }

  const kimiResponse = await fetch(KIMI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.KIMI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const data = await kimiResponse.json();
  return corsResponse(JSON.stringify(data), kimiResponse.status);
}

// ── RAG retrieval ─────────────────────────────────────────────────────────────

async function handleRag(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return corsResponse(JSON.stringify({ error: "Invalid JSON" }), 400);
  }

  const { topic, subject, grade_num } = body;

  if (!topic || !subject) {
    return corsResponse(JSON.stringify({ error: "topic and subject required" }), 400);
  }

  try {
    // Step 1 — Embed the topic using Cohere multilingual-v3.0
    // Cohere has no geographic restrictions -- works from any Cloudflare edge
    // Produces 1024-dimension vectors matching our rag_documents schema
    const embedResponse = await fetch("https://api.cohere.com/v1/embed", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.COHERE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "embed-multilingual-v3.0",
        texts: [`${subject} ${topic}`],
        input_type: "search_query"
      })
    });

    if (!embedResponse.ok) {
      const err = await embedResponse.text();
      console.error("Cohere embed error:", err);
      return corsResponse(JSON.stringify({ chunk: null, error: "embedding failed", detail: err }), 200);
    }

    const embedData = await embedResponse.json();
    const embedding = embedData.embeddings[0];

    // Step 2 — Query Supabase match_curriculum RPC
    // Note: p_quarter is intentionally null -- students can scan any quarter's
    // material regardless of their current school quarter.
    const supabaseResponse = await fetch(
      `${env.SUPABASE_URL}/rest/v1/rpc/match_curriculum_1024`,
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
          p_threshold:     0.4,
          p_count:         3
        })
      }
    );

    if (!supabaseResponse.ok) {
      const err = await supabaseResponse.text();
      console.error("Supabase RPC error:", err);
      return corsResponse(JSON.stringify({ chunk: null, error: "retrieval failed", detail: err, status: supabaseResponse.status }), 200);
    }

    const results = await supabaseResponse.json();

    if (!results || results.length === 0) {
      // No match found -- return null chunk, app will proceed without it
      return corsResponse(JSON.stringify({ chunk: null, similarity: null }), 200);
    }

    // Return the top result, trimmed to 1500 chars to stay within token budget
    const top = results[0];
    const chunkText = top.out_chunk_text?.slice(0, 1500) || null;

    return corsResponse(JSON.stringify({
      chunk:      chunkText,
      subject:    top.out_subject,
      grade:      top.out_grade,
      quarter:    top.out_quarter,
      domain:     top.out_domain_en,
      similarity: Math.round(top.out_similarity * 100) / 100
    }), 200);

  } catch (err) {
    console.error("handleRag error:", err.message);
    // Always return 200 with null chunk -- never crash the lesson flow
    return corsResponse(JSON.stringify({ chunk: null, error: err.message }), 200);
  }
}

// ── Shared ────────────────────────────────────────────────────────────────────

function corsResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-AralMate-Secret"
    }
  });
}
