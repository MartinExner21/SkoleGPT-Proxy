export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { speaker, text } = req.body;

    const voiceId =
      speaker === "A"
        ? process.env.ELEVEN_VOICE_ID_A
        : process.env.ELEVEN_VOICE_ID_B;

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVEN_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.35,
            similarity_boost: 0.75,
            style: 0.35,
            use_speaker_boost: true,
          },
        }),
      }
    );

    const buffer = await upstream.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return res.status(200).json({
      base64,
      mime: "audio/mpeg",
    });
  } catch (err) {
    return res.status(500).json({
      error: "TTS error",
      details: err.message,
    });
  }
}
