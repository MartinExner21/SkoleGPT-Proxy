// /api/podcast-chat.js — adapts messages[] -> /api/skolegpt { userContent } and parses SSE delta stream

function extractTextFromSSE(sseText) {
  // SSE lines look like: data: {"delta":"Jeg"}  ... data: [DONE]
  const lines = sseText.split(/\r?\n/);
  let out = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;

    const payload = trimmed.slice(5).trim(); // after "data:"
    if (!payload || payload === "[DONE]") continue;

    try {
      const obj = JSON.parse(payload);
      if (typeof obj?.delta === "string") out += obj.delta;
      else if (typeof obj?.text === "string") out += obj.text;
      else if (typeof obj?.content === "string") out += obj.content;
    } catch {
      // ignore non-JSON SSE lines
    }
  }

  return out.trim();
}

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

    // Convert messages -> userContent for /api/skolegpt
    const systemParts = messages
      .filter((m) => m?.role === "system" && typeof m?.content === "string")
      .map((m) => m.content.trim())
      .filter(Boolean);

    const convoParts = messages
      .filter((m) => m?.role !== "system" && typeof m?.content === "string")
      .map((m) => {
        const role = (m.role || "user").toString();
        const label =
          role === "assistant" ? "ASSISTANT" :
          role === "user" ? "USER" :
          role.toUpperCase();
        return `${label}: ${m.content.trim()}`;
      })
      .filter(Boolean);

    const userContent = [
      systemParts.length ? `SYSTEM:\n${systemParts.join("\n\n")}` : "",
      convoParts.length ? `CONVERSATION:\n${convoParts.join("\n")}` : "",
      `CONSTRAINTS:\nSvar på dansk. Max 2 sætninger. Kort, afbrydende, lidt uenig.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const FORWARD_URL = "https://skolegpt-proxy.vercel.app/api/skolegpt";

    const incomingAuth =
      (req.headers.authorization || req.headers.Authorization || "").toString();

    const incomingApiKey =
      (req.headers["x-api-key"] || req.headers["X-API-KEY"] || "").toString();

    const serverAuth = process.env.SKOLEGPT_API_KEY
      ? `Bearer ${process.env.SKOLEGPT_API_KEY}`
      : "";

    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
    };

    const authToSend = incomingAuth || serverAuth;
    if (authToSend) headers.Authorization = authToSend;
    if (incomingApiKey) headers["x-api-key"] = incomingApiKey;

    const upstream = await fetch(FORWARD_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        userContent,
        temperature,
        max_tokens,
      }),
    });

    const upstreamText = await upstream.text();

    if (!upstream.ok) {
      return res.status(502).json({
        error: "Upstream (forwarded) error",
        forwardUrl: FORWARD_URL,
        upstreamStatus: upstream.status,
        upstreamContentType: upstream.headers.get("content-type") || "(missing)",
        upstreamBodyPreview: upstreamText.slice(0, 1200),
      });
    }

    // 1) Try JSON (non-stream response)
    let extracted = "";
    try {
      const j = JSON.parse(upstreamText);
      extracted =
        (j?.text ??
          j?.message ??
          j?.content ??
          j?.result ??
          j?.output ??
          j?.choices?.[0]?.message?.content ??
          "").toString().trim();
    } catch {
      extracted = "";
    }

    // 2) If not JSON, treat as SSE delta stream
    if (!extracted) {
      extracted = extractTextFromSSE(upstreamText);
    }

    if (!extracted) {
      return res.status(502).json({
        error: "Forwarded endpoint returned no completion text",
        forwardUrl: FORWARD_URL,
        upstreamStatus: upstream.status,
        upstreamContentType: upstream.headers.get("content-type") || "(missing)",
        upstreamBodyPreview: upstreamText.slice(0, 1200),
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
