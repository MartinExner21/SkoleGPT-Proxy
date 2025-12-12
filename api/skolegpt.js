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
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: INIT_PROMPT },
          { role: "user", content: userContent }
        ],
        stream: false,          // vi gør det simpelt: ikke streaming
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

    const data = await response.json();
    const answer =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.delta?.content ??
      "";

    if (!answer) {
      return res.status(500).json({ error: "Empty answer from SkoleGPT" });
    }

    return res.status(200).json({ answer });
  } catch (err) {
    console.error("SkoleGPT proxy error:", err);
    return res.status(500).json({ error: "Internal SkoleGPT proxy error" });
  }
}

