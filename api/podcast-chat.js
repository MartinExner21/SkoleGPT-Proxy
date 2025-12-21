// /api/podcast-chat.js — forwards to existing working endpoint in SAME Vercel project

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

    // IMPORTANT:
    // This must be the endpoint your existing “læsehjælper” already uses successfully.
    const FORWARD_URL = "https://skolegpt-proxy.vercel.app/api/chat";

    const upstream = await fetch(FORWARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // We forward the exact same OpenAI-style payload we already build:
      body: JSON.stringify({ messages, temperature, max_tokens }),
    });

    const text = await upstream.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: "Upstream (forwarded) error",
        status: upstream.status,
        details: data || text,
      });
    }

    const extracted =
      (data?.choices?.[0]?.message?.content ??
        data?.message?.content ??
        data?.text ??
        data?.output ??
        "").toString().trim();

    if (!extracted) {
      return res.status(502).json({
        error: "Empty completion text from forwarded endpoint",
        details: data || text,
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
