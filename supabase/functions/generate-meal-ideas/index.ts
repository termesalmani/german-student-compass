// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { budget, diet, cookingTime, dislikes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `You generate cheap, simple meal ideas for international students in Germany shopping at supermarkets like Aldi, Lidl, Penny, Netto. Always:
- Stay within the weekly budget in EUR
- Respect dietary preference and disliked ingredients
- Keep recipes under the requested cooking time
- Use realistic, easily available German supermarket ingredients
- Return clean markdown with 5-7 meal ideas, each with: title, ~cost, ~time, ingredients (bulleted), and 2-3 line method.`;

    const user = `Weekly budget: €${budget}
Dietary preference: ${diet}
Max cooking time per meal: ${cookingTime} minutes
Disliked ingredients: ${dislikes || "none"}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit reached. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (res.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to your workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: `AI gateway error: ${text}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await res.json();
    const ideas = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ ideas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});