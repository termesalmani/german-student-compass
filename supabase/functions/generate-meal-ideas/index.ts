// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { budget, diet, cookingTime, dislikes, energy, pantry } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const energyHint =
      energy === "exhausted"
        ? "User is exhausted — keep meals extremely low effort (3-5 ingredients, no real cooking when possible, microwave/boil/assemble only)."
        : energy === "can_cook"
          ? "User has energy to cook — slightly more involved meals are okay, but still simple."
          : "Normal energy — keep meals simple and quick.";

    const system = `You suggest simple, affordable, comforting meal ideas for international students in Germany shopping at Aldi/Lidl/Penny/Netto.

Tone: warm, practical, non-judgmental. Never talk about calories, macros, nutrition, fitness, weight, or "healthy eating goals". This is about surviving busy weeks — not optimizing a diet.

Rules:
- Respect the weekly EUR budget loosely (don't be strict about exact prices)
- Respect dietary preference and disliked ingredients strictly
- Keep prep + cook time under the requested max
- Use cheap, common German supermarket ingredients
- Favor repeatable student staples: rice, pasta, eggs, lentils, canned tomatoes, oats, frozen veg, yogurt, bread, tuna, potatoes
- ${energyHint}

Return ONLY a JSON object (no markdown, no prose) matching:
{
  "meals": [
    {
      "title": "short friendly name like 'Lazy tomato pasta'",
      "time_minutes": number,
      "effort": "minimal" | "easy" | "a bit of cooking",
      "budget_note": "short phrase like 'Cheap & filling' or 'Cupboard basics'",
      "ingredients": ["bullet", "list", "of", "5-8 items"],
      "blurb": "1-2 warm, casual sentences — no pressure, no health talk"
    }
  ]
}
Generate 5 meals.`;

    const user = `Weekly budget: €${budget}
Dietary preference: ${diet}
Max cooking time per meal: ${cookingTime} minutes
Disliked ingredients: ${dislikes || "none"}
Energy level: ${energy || "normal"}
Ingredients they probably already have: ${(pantry && pantry.length) ? pantry.join(", ") : "none specified"}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
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
    const raw = data?.choices?.[0]?.message?.content ?? "";
    let meals: unknown = [];
    try {
      const parsed = JSON.parse(raw);
      meals = Array.isArray(parsed?.meals) ? parsed.meals : [];
    } catch {
      meals = [];
    }
    return new Response(JSON.stringify({ meals }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});