export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { systemPrompt, userPrompt } = req.body || {};

  if (!userPrompt) {
    return res.status(400).json({ error: "Missing userPrompt" });
  }

  try {
    const SKOLEGPT_API_URL = process.env.SKOLEGPT_API_URL;
    const SKOLEGPT_API_KEY = process.env.SKOLEGPT_API_KEY; // optional

    if (!SKOLEGPT_API_URL) {
      return res.status(500).json({ error: "SKOLEGPT_API_URL not set" });
    }

    const headers = { "Content-Type": "application/json" };
    if (SKOLEGPT_API_KEY) {
      headers["Authorization"] = SKOLEGPT_API_KEY.startsWith("Bearer ")
        ? SKOLEGPT_API_KEY
        : `Bearer ${SKOLEGPT_API_KEY}`;
    }

    // Tilpas payload hvis din SkoleGPT API ikke er chat-completions-style
    const payload = {
      messages: [
        {
          role: "system",
          content: systemPrompt || "Du er SkoleGPT – en dansk læringsassistent."
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    };

const r = await fetch(SKOLEGPT_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return res.status(r.status).json({ error: t || r.statusText });
    }

    const data = await r.json();

    const answer =
      data?.choices?.[0]?.message?.content ??
      data?.answer ??
      data?.message ??
      "";

    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

/**
 * Minimal “safety” wrapper to ensure SKOLEGPT_API_URL is a string.
 * You can remove this if you prefer.
 */
function SKOOLEGPT_API_URL_SAFE(url) {
  return typeof url === "string" ? url : "";
}
