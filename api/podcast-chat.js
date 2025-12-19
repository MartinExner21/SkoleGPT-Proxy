export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { messages, temperature = 0.9, max_tokens = 140 } = req.body;

    const upstream = await fetch(
      "https://api.skolegpt.dk/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SKOLEGPT_API_KEY}`,
        },
        body: JSON.stringify({
          messages,
          temperature,
          max_tokens,
        }),
      }
    );

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json(data);
    }

    const text =
      data?.choices?.[0]?.message?.content?.trim() ?? "";

    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
}
