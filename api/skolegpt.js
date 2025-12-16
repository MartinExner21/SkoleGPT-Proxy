const INIT_PROMPT = `Du er SkoleGPT og skal hjælpe en ordblind elev eller voksen med at forstå en tekst eller svare på et spørgsmål.

1) Forklar i enkelt, mundtligt dansk.
2) Korte sætninger.
3) Forklar svære ord.
4) Behold meningen.
5) Tal direkte til brugeren.

VIGTIGT:
- Start ikke ens hver gang. Variér let.
Svar altid på dansk.`;

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.SKOLEGPT_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing SKOLEGPT_API_KEY on server" });

  const { userContent } = req.body || {};
  if (!userContent || !userContent.trim()) {
    return res.status(400).json({ error: "Missing 'userContent' in body" });
  }

  try {
    const r = await fetch("https://llm.dbc.dk/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "text/event-stream"
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: INIT_PROMPT },
          { role: "user", content: userContent }
        ],
        stream: true,
        model: "skolegpt-v3",
        temperature: 0.7,
        top_p: 0.95
      })
    });

    if (!r.ok) {
      const details = await r.text().catch(() => "");
      return res.status(502).json({
        error: "SkoleGPT upstream error",
        status: r.status,
        details: details.slice(0, 2000)
      });
    }

    const raw = await r.text();
    let full = "";

    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const dataPart = t.slice(5).trim();
      if (!dataPart || dataPart === "[DONE]") continue;

      try {
        const obj = JSON.parse(dataPart);
        const c = obj?.choices?.[0];
        const piece = c?.delta?.content ?? c?.message?.content ?? c?.text ?? "";
        if (piece) full += piece;
      } catch {
        // skip unparseable lines
      }
    }

    if (!full.trim()) {
      return res.status(500).json({
        error: "Empty answer from SkoleGPT (after SSE parse)",
        rawPreview: raw.slice(0, 800)
      });
    }

    return res.status(200).json({ answer: full });
  } catch (e) {
    return res.status(500).json({
      error: "Internal proxy error",
      message: String(e?.message || e)
    });
  }
}
