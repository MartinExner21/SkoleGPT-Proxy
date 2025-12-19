// /api/podcast-chat.js  (Vercel) — ROBUST + FAIL LOUD

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

    const apiKey = process.env.SKOLEGPT_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing env SKOLEGPT_API_KEY" });
    }

    const upstream = await fetch("https://api.skolegpt.dk/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages,
        temperature,
        max_tokens,
      }),
    });

    const rawText = await upstream.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: "SkoleGPT upstream error",
        status: upstream.status,
        details: data || rawText,
      });
    }

    // Robust extraction across common formats
    const extracted =
      (data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.delta?.content ??
        data?.message?.content ??
        data?.text ??
        data?.output_text ??
        data?.output ??
        "").toString().trim();

    if (!extracted) {
      // Fail loud so you see it immediately in the UI
      return res.status(502).json({
        error: "Empty completion text from SkoleGPT",
        details: data || rawText,
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
