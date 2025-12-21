// /api/podcast-chat.js (Vercel) — DEBUG MODE + robust https

import https from "https";
import { URL } from "url";

function postJson(urlString, headers, bodyObj) {
  const url = new URL(urlString);
  const body = JSON.stringify(bodyObj);

  const options = {
    method: "POST",
    hostname: url.hostname,
    path: url.pathname + (url.search || ""),
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; skolegpt-podcast-proxy/1.0)",
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
          status: res.statusCode || 0,
          headers: res.headers || {},
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

    // IMPORTANT: set THIS to the exact API host once identified
    const upstreamUrl = "https://api.skolegpt.dk/v1/chat/completions";

    const upstream = await postJson(
      upstreamUrl,
      { Authorization: `Bearer ${apiKey}` },
      { messages, temperature, max_tokens }
    );

    const ct = (upstream.headers["content-type"] || "").toString();

    // Try parse JSON if it looks like JSON
    let data = null;
    if (ct.includes("application/json") || upstream.text.trim().startsWith("{")) {
      try {
        data = JSON.parse(upstream.text);
      } catch {
        data = null;
      }
    }

    // If we didn't get JSON, return debug info (THIS is what you need to see)
    if (!ct.includes("application/json")) {
      return res.status(502).json({
        error: "Upstream did not return JSON (likely webapp/WAF/redirect).",
        upstreamUrl,
        upstreamStatus: upstream.status,
        upstreamContentType: ct || "(missing)",
        upstreamPreview: upstream.text.slice(0, 800),
      });
    }

    // JSON but could still be error
    if (upstream.status < 200 || upstream.status >= 300) {
      return res.status(upstream.status).json({
        error: "SkoleGPT upstream error (JSON)",
        upstreamUrl,
        upstreamStatus: upstream.status,
        details: data || upstream.text.slice(0, 800),
      });
    }

    const extracted =
      (data?.choices?.[0]?.message?.content ??
        data?.message?.content ??
        data?.text ??
        "").toString().trim();

    if (!extracted) {
      return res.status(502).json({
        error: "Empty completion text from upstream JSON",
        upstreamUrl,
        upstreamStatus: upstream.status,
        details: data,
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
