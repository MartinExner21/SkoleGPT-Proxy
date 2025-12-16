export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  const ok =
    Boolean(process.env.SKOLEGPT_API_KEY) &&
    Boolean(process.env.ELEVENLABS_API_KEY) &&
    Boolean(process.env.ELEVENLABS_VOICE_ID);

  res.status(200).json({
    ok,
    has_SKOLEGPT_API_KEY: Boolean(process.env.SKOLEGPT_API_KEY),
    has_ELEVENLABS_API_KEY: Boolean(process.env.ELEVENLABS_API_KEY),
    has_ELEVENLABS_VOICE_ID: Boolean(process.env.ELEVENLABS_VOICE_ID),
    timestamp: new Date().toISOString()
  });
}
