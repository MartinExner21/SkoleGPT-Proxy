export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { messages, temperature, max_tokens } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing 'messages' array" });
    }

    const SKOLEGPT_API_URL = process.env.SKOLEGPT_API_URL;
    const SKOLEGPT_API_KEY = process.env.SKOLEGPT_API_KEY;

    if (!SKOLEGPT_API_URL || !SKOLEGPT_API_KEY) {
      return res.status(500).json({
        error: "Missing env: SKOLEGPT_API_URL / SKOLEGPT_API_KEY",
      });
    }

    const upstream = await fetch(SKOLEGPT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SKOLEGPT_API_KEY}`,
      },
      body: JSON.stringify({
        messages,
        temperature: typeof temperature === "number" ? temperature : 0.85,
        max_tokens: typeof max_tokens === "number" ? max_tokens : 140,
      }),
    });

    const text = await upstream.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      // upstream returned non-json
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: "SkoleGPT upstream error",
        status: upstream.status,
        details: data || text,
      });
    }

    // Robust parsing (alt efter format)
    const content =
      (data?.choices?.[0]?.message?.content ??
        data?.message?.content ??
        data?.text ??
        data?.output ??
        "").toString().trim();

    return res.status(200).json({ text: content, raw: data ?? text });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
