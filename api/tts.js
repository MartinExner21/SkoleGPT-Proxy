function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) return res.status(500).json({ error: "Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID" });

  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "Missing text" });

  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.4, similarity_boost: 0.9 }
      })
    });

    if (!r.ok) {
      const details = await r.text().catch(() => "");
      return res.status(502).json({ error: "ElevenLabs upstream error", status: r.status, details: details.slice(0, 2000) });
    }

    const buf = await r.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    return res.status(200).send(Buffer.from(buf));
  } catch (e) {
    return res.status(500).json({ error: "Internal TTS proxy error", message: String(e?.message || e) });
  }
}
