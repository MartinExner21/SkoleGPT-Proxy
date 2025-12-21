// /api/podcast-tts.js — ElevenLabs TTS (env names aligned with project)

import https from "https";
import { URL } from "url";

function postJsonForBinary(urlString, headers, bodyObj) {
  const url = new URL(urlString);
  const body = JSON.stringify(bodyObj);

  const options = {
    method: "POST",
    hostname: url.hostname,
    path: url.pathname + (url.search || ""),
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      Accept: "audio/mpeg",
      ...headers,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve({
          ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
          status: res.statusCode || 0,
          buffer: buf,
        });
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { speaker, text } = req.body || {};
    if (speaker !== "A" && speaker !== "B") {
      return res.status(400).json({ error: "speaker must be 'A' or 'B'" });
    }
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Missing text" });
    }

    // ✅ ENV NAMES MATCH YOUR PROJECT
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceA = process.env.ELEVENLABS_VOICE_ID_A;
    const voiceB = process.env.ELEVENLABS_VOICE_ID_B;

    if (!apiKey || !voiceA || !voiceB) {
      return res.status(500).json({
        error:
          "Missing env ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID_A / ELEVENLABS_VOICE_ID_B",
      });
    }

    const voiceId = speaker === "A" ? voiceA : voiceB;

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

    const upstream = await postJsonForBinary(
      url,
      { "xi-api-key": apiKey },
      {
        text: text.trim(),
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.75,
          style: 0.35,
          use_speaker_boost: true,
        },
      }
    );

    if (!upstream.ok) {
      const details = upstream.buffer.toString("utf8").slice(0, 2000);
      return res.status(upstream.status || 502).json({
        error: "ElevenLabs upstream error",
        status: upstream.status,
        details,
      });
    }

    const base64 = upstream.buffer.toString("base64");
    return res.status(200).json({ base64, mime: "audio/mpeg" });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: err?.message || String(err),
    });
  }
}
