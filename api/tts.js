// api/tts.js

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    return res
      .status(500)
      .json({ error: "Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID" });
  }

  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Missing 'text' in body" });
  }

  try {
    const elevenUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

    const ttsRes = await fetch(elevenUrl, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.9
        }
      })
    });

    if (!ttsRes.ok) {
      const txt = await ttsRes.text().catch(() => "");
      return res.status(502).json({
        error: "ElevenLabs responded with error",
        status: ttsRes.status,
        details: txt
      });
    }

    const audioBuffer = await ttsRes.arrayBuffer();

    res.setHeader("Content-Type", "audio/mpeg");
    res.status(200).send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error("TTS proxy error:", err);
    res.status(500).json({ error: "Internal TTS proxy error" });
  }
}
