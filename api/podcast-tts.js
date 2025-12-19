function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { speaker, text } = req.body || {};
    if (!speaker || (speaker !== "A" && speaker !== "B")) {
      return res.status(400).json({ error: "speaker must be 'A' or 'B'" });
    }
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Missing 'text'" });
    }

    const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
    const ELEVEN_MODEL_ID = process.env.ELEVEN_MODEL_ID || "eleven_multilingual_v2";

    const ELEVEN_VOICE_ID_A = process.env.ELEVEN_VOICE_ID_A; // fx mand
    const ELEVEN_VOICE_ID_B = process.env.ELEVEN_VOICE_ID_B; // fx kvinde

    if (!ELEVEN_API_KEY || !ELEVEN_VOICE_ID_A || !ELEVEN_VOICE_ID_B) {
      return res.status(500).json({
        error: "Missing env: ELEVEN_API_KEY / ELEVEN_VOICE_ID_A / ELEVEN_VOICE_ID_B",
      });
    }

    const voiceId = speaker === "A" ? ELEVEN_VOICE_ID_A : ELEVEN_VOICE_ID_B;

    // MP3 output format (hurtig, kompatibel)
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: ELEVEN_MODEL_ID,
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.75,
          style: 0.35,
          use_speaker_boost: true,
        },
      }),
    });

    if (!upstream.ok) {
      const t = await upstream.text();
      return res.status(upstream.status).json({
        error: "ElevenLabs upstream error",
        status: upstream.status,
        details: safeJsonParse(t) || t,
      });
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Base64 encode
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = Buffer.from(binary, "binary").toString("base64");

    return res.status(200).json({ base64, mime: "audio/mpeg" });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
