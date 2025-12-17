// api/health.js

export default function handler(req, res) {
  // CORS (så extensionen kan kalde den)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const hasSkole = Boolean(process.env.SKOLEGPT_API_KEY);
  const hasEleven = Boolean(process.env.ELEVENLABS_API_KEY);
  const hasVoice = Boolean(process.env.ELEVENLABS_VOICE_ID);

  // ok=true betyder: backend er oppe + env vars er sat
  return res.status(200).json({
    ok: hasSkole && hasEleven && hasVoice,
    env: {
      SKOLEGPT_API_KEY: hasSkole,
      ELEVENLABS_API_KEY: hasEleven,
      ELEVENLABS_VOICE_ID: hasVoice
    }
  });
}
