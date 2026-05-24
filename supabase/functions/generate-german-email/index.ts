// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { situation, recipient, tone } = await req.json();
    if (!situation || typeof situation !== "string") {
      return new Response(
        JSON.stringify({ error: "Field 'situation' is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isCasual = typeof tone === "string" && tone.toLowerCase().includes("casual");
    const system = isCasual
      ? `You are an assistant helping international students in Germany write friendly, casual German emails or messages (Du-form, Hochdeutsch, warm and human but still respectful).
Always produce:
1. A short subject line on the first line, prefixed with "Betreff: ".
2. A warm, casual salutation (e.g. "Hallo [Name]," or "Hi [Name],").
3. A natural, conversational body in casual German.
4. A friendly closing such as "Liebe Grüße" or "Viele Grüße" with a placeholder for the sender's name.
Keep it concise, natural, and human. Return ONLY the email, nothing else.`
      : `You are an assistant helping international students in Germany write polite, formal German emails (Sie-form, Hochdeutsch).
Always produce:
1. A short subject line on the first line, prefixed with "Betreff: ".
2. A proper salutation ("Sehr geehrte Damen und Herren," or named if provided).
3. A clear, polite body in formal German.
4. A closing "Mit freundlichen Grüßen" and a placeholder for the sender's name.
Keep it concise, correct, and respectful. Return ONLY the email, nothing else.`;

    const userPrompt = `Recipient: ${recipient || "Unknown / general office"}
Desired tone: ${tone || "polite and formal"}
Situation (may be in any language, translate to German): ${situation}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `AI gateway error: ${text}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const email = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});