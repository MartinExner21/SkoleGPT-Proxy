// /api/podcast-chat.js — forward to existing endpoint + forward auth headers + debug errors

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages, temperature = 0.9, max_tokens = 180 } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing messages[]" });
    }

    // IMPORTANT: this must be your working endpoint used by the læsehjælper
    const FORWARD_URL = "https://skolegpt-proxy.vercel.app/api/chat";

    // Forward headers that might be required by /api/chat
    const incomingAuth =
      (req.headers.authorization || req.headers.Authorization || "").toString();

    const incomingApiKey =
      (req.headers["x-api-key"] || req.headers["X-Api-Key"] || "").toString();

    // If /api/chat expects Authorization and client didn't send it,
    // we can provide server-side key (if you use it that way).
    // If your /api/chat does NOT use Authorization, it will just ignore it.
    const serverAuth = process.env.SKOLEGPT_API_KEY
      ? `Bearer ${process.env.SKOLEGPT_API_KEY}`
      : "";

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Prefer incoming auth, else server auth
    const authToSend = incomingAuth || serverAuth;
    if (authToSend) headers.Authorization = authToSend;

    // Forward x-api-key if present
    if (incomingApiKey) headers["x-api-key"] = incomingApiKey;

    const upstream = await fetch(FORWARD_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages, temperature, max_tokens }),
    });

    const upstreamText = await upstream.text();
    let upstreamJson = null;
    try {
      upstreamJson = JSON.parse(upstreamText);
    } catch {
      upstreamJson = null;
    }

    if (!upstream.ok) {
      return res.status(502).json({
        error: "Upstream (forwarded) error",
        forwardUrl: FORWARD_URL,
        upstreamStatus: upstream.status,
        upstreamContentType: upstream.headers.get("content-type") || "(missing)",
        upstreamBodyPreview: upstreamText.slice(0, 1200),
        upstreamJson,
      });
    }

    const extracted =
      (upstreamJson?.choices?.[0]?.message?.content ??
        upstreamJson?.message?.content ??
        upstreamJson?.text ??
        upstreamJson?.output ??
        "").toString().trim();

    if (!extracted) {
      return res.status(502).json({
        error: "Forwarded endpoint returned no completion text",
        forwardUrl: FORWARD_URL,
        upstreamStatus: upstream.status,
        upstreamBodyPreview: upstreamText.slice(0, 1200),
        upstreamJson,
      });
    }

    return res.status(200).json({ text: extracted });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
