export const runtime = "nodejs"; // vigtigt hvis du ellers kører edge

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders() });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { systemPrompt, userPrompt } = body || {};

    if (!userPrompt) return json({ error: "Missing userPrompt" }, 400);

    const url = process.env.SKOLEGPT_API_URL;
    const key = process.env.SKOLEGPT_API_KEY; // optional

    if (!url) return json({ error: "SKOLEGPT_API_URL not set" }, 500);

    const headers = { "Content-Type": "application/json" };
    if (key) headers["Authorization"] = key.startsWith("Bearer ") ? key : `Bearer ${key}`;

    const payload = {
      messages: [
        { role: "system", content: systemPrompt || "Du er SkoleGPT – en dansk læringsassistent." },
        { role: "user", content: userPrompt }
      ]
    };

    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return json({ error: t || r.statusText, upstreamStatus: r.status }, r.status);
    }

    const data = await r.json();
    const answer =
      data?.choices?.[0]?.message?.content ??
      data?.answer ??
      data?.message ??
      "";

    return json({ answer }, 200);
  } catch (e) {
    // Her får du den reelle årsag i svaret
    return json(
      {
        error: "fetch failed",
        details: {
          name: e?.name,
          message: e?.message,
          code: e?.cause?.code || e?.code,
          cause: e?.cause ? String(e.cause) : null
        }
      },
      500
    );
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" }
  });
}
