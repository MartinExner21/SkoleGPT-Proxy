// /api/podcast-chat.js (Vercel) — FIXED TLS: uses https://skolegpt.dk (matches cert)

import https from "https";
import { URL } from "url";

function postJson(urlString, headers, bodyObj) {
  const url = new URL(urlString);
  const body = JSON.stringify(bodyObj);

  const options = {
    method: "POST",
    hostname: url.hostname, // "skolegpt.dk"
    path: url.pathname + (url.search || ""),
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      ...headers,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          text: data,
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
    const { messages, temperature = 0.9, max_tokens = 180 } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Missing messages[]" });
    }

    const apiKey = process.env.SKOLEGPT_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing env SKOLEGPT_API_KEY" });
    }

    const upstream = await postJson(
      "https://skolegpt.dk/v1/chat/completions",
      { Authorization: `Bearer ${apiKey}` },
      { messages, temperature, max_tokens }
    );

    let data = null;
    try {
      data = JSON.parse(upstream.text);
    } catch {
      data = null;
    }

    if (!upstream.ok) {
      return res.status(upstream.status || 502).json({
        error: "SkoleGPT upstream error",
        status: upstream.status,
        details: data || upstream.text,
      });
    }

    const extracted =
      (data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.delta?.content ??
        data?.message?.content ??
        data?.text ??
        data?.output_text ??
        data?.output ??
        "").toString().trim();

    if (!extracted) {
      return res.status(502).json({
        error: "Empty completion text from SkoleGPT",
        details: data || upstream.text,
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
