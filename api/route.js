export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { systemPrompt, userPrompt } = body || {};

    if (!userPrompt) {
      return json({ error: "Missing userPrompt" }, 400);
    }

    const SKOLEGPT_API_URL = process.env.SKOLEGPT_API_URL;
    const SKOLEGPT_API_KEY = process.env.SKOLEGPT_API_KEY; // optional

    if (!SKOLEGPT_API_URL) {
      return json({ error: "SKOLEGPT_API_URL not set" }, 500);
    }

    const headers = { "Content-Type": "application/json" };
    if (SKOLEGPT_API_KEY) {
      headers["Authorization"] = SKOLEGPT_API_KEY.startsWith("Bearer ")
        ? SKOLEGPT_API_KEY
        : `Bearer ${SKOLEGPT_API_KEY}`;
    }

    const payload = {
      messages: [
        {
          role: "system",
          content:
            systemPrompt ||
            "Du er SkoleGPT – en dansk læringsassistent. Svar klart og pædagogisk."
        },
        { role: "user", content: userPrompt }
      ]
    };

    const r = await fetch(SKOLEGPT_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return json({ error: t || r.statusText }, r.status);
    }

    const data = await r.json();

    const answer =
      data?.choices?.[0]?.message?.content ??
      data?.answer ??
      data?.message ??
      "";

    return json({ answer }, 200);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
    },
  });
}
