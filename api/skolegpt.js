// api/skolegpt.js  (STREAMING proxy -> SSE)
// Returnerer text/event-stream med deltas:  data: {"delta":"..."}  og til sidst data: [DONE]

const INIT_PROMPT = `Du er SkoleGPT og skal hjælpe en ordblind elev eller voksen med at forstå en tekst eller svare på et spørgsmål.

Når du får et spørgsmål samt evt. markeret tekst og/eller hele sidens indhold:
1) Forklar i et enkelt, mundtligt dansk sprog.
2) Brug korte og tydelige sætninger.
3) Undgå svære fagord, eller forklar dem.
4) Behold hovedbetydningen.
5) Tal direkte til brugeren.

VIGTIGT:
- Start ALDRIG to svar på samme måde.
- Variér åbningssætningen med små venlige twists, men hold sproget neutralt og let at forstå.
- Svar som standard kort: 4-8 korte linjer. Afslut evt. med "Vil du have en mere detaljeret forklaring?"
Svar altid på dansk.`;

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.SKOLEGPT_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing SKOLEGPT_API_KEY on server" });

  const { userContent } = req.body || {};
  if (!userContent || !String(userContent).trim()) {
    return res.status(400).json({ error: "Missing 'userContent' in body" });
  }

  try {
    const upstream = await fetch("https://llm.dbc.dk/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "text/event-stream"
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: INIT_PROMPT },
          { role: "user", content: String(userContent) }
        ],
        stream: true,
        model: "skolegpt-v3",
        temperature: 0.6,
        top_p: 0.9,
        presence_penalty: 0,
        frequency_penalty: 0
      })
    });

    if (!upstream.ok || !upstream.body) {
      const txt = await upstream.text().catch(() => "");
      return res.status(502).json({
        error: "SkoleGPT upstream error",
        status: upstream.status,
        details: txt
      });
    }

    // SSE response til klienten
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    // Helper: skriv SSE-linje
    const writeDelta = (delta) => {
      // JSON-escape via stringify
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    };

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // upstream kommer som SSE-linjer; vi splitter på newline
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const dataPart = trimmed.slice("data:".length).trim();
        if (!dataPart) continue;

        if (dataPart === "[DONE]") {
          res.write(`data: [DONE]\n\n`);
          res.end();
          return;
        }

        // parse upstream chunk JSON
        try {
          const obj = JSON.parse(dataPart);
          const choice = obj?.choices?.[0];
          const piece =
            choice?.delta?.content ??
            choice?.message?.content ??
            "";

          if (piece) writeDelta(piece);
        } catch {
          // ignore parse fejl
        }
      }
    }

    // fallback hvis upstream sluttede uden [DONE]
    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err) {
    console.error("SkoleGPT streaming proxy error:", err);
    try {
      res.status(500).json({ error: "Internal SkoleGPT proxy error" });
    } catch {
      // hvis headers allerede sendt
      try {
        res.write(`data: ${JSON.stringify({ error: "Internal error" })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
      } catch {}
    }
  }
}
