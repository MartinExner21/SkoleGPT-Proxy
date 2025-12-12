// api/skolegpt.js

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
- Undgå fyldord eller irrelevante begynderfraser.

Svar altid på dansk.`;

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

  const apiKey = process.env.SKOLEGPT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing SKOLEGPT_API_KEY on server" });
  }

  const { userContent } = req.body || {};
  if (!userContent || !userContent.trim()) {
    return res.status(400).json({ error: "Missing 'userContent' in body" });
  }

  try {
    const response = await fetch("https://llm.dbc.dk/v1/chat/completions", {
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
        // VIGTIGT: vi streamer stadig fra SkoleGPT,
        // men vi samler det til én streng her på serveren
        stream: true,
        model: "skolegpt-v3",
        temperature: 0.7,
        top_p: 0.95,
        presence_penalty: 0,
        frequency_penalty: 0
      })
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => "");
      return res.status(502).json({
        error: "SkoleGPT responded with error",
        status: response.status,
        details: txt
      });
    }

    const raw = await response.text();
    // Hvis du vil debugge i Vercel-loggene:
    // console.log("RAW SSE:", raw.slice(0, 800));

    let fullText = "";
    const lines = raw.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const dataPart = trimmed.slice("data:".length).trim();
      if (!dataPart || dataPart === "[DONE]") continue;

      try {
        const obj = JSON.parse(dataPart);
        const choice = obj?.choices?.[0];
        const piece =
          choice?.delta?.content ??
          choice?.message?.content ??
          choice?.text ??
          "";
        if (piece) fullText += piece;
      } catch (e) {
        // hvis en enkelt linje ikke kan parses, skipper vi den bare
        // console.warn("Kunne ikke parse SSE-linje:", trimmed, e);
      }
    }

    if (!fullText.trim()) {
      return res.status(500).json({
        error: "Empty answer from SkoleGPT (after SSE parse)",
        rawPreview: raw.slice(0, 500)
      });
    }

    return res.status(200).json({ answer: fullText });
  } catch (err) {
    console.error("SkoleGPT proxy error:", err);
    return res.status(500).json({ error: "Internal SkoleGPT proxy error" });
  }
}
