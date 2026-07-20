// Chasin' Dreams — live Snack Panel
// Vercel Node serverless function. Reads a brief, asks Gemini to react AS the
// four audience personas, returns { reactions: [{key,score,line,share}] }.
//
// Deploy: drop this repo on Vercel and set GEMINI_API_KEY in the project's
// Environment Variables. (Optional: PANEL_MODEL to override the model.)
// Until then the engine falls back to the modeled read automatically.

const MODEL = process.env.PANEL_MODEL || "gemini-2.5-flash";

const PERSONAS = [
  { key: "chloe", name: "Celiac Chloe",
    bio: "Gluten-free for life. Buys purely on trust and safety, then evangelizes any safe brand she loves to every GF friend. Wants to be SURE it's actually safe before she gets excited." },
  { key: "kayla", name: "Clean-Label Kayla",
    bio: "Reads the back of every bag. Rewards a short, clean label + avocado oil — but rolls her eyes at fear-mongering, preaching, or anything that feels political. Just show her the label." },
  { key: "sage", name: "Snack-Girlie Sage",
    bio: "Gen Z. Follows brands that are a whole vibe/scene, not an ad. Wants to be entertained. Lives on TikTok. A boring product-shot feed loses her instantly; a funny mascot or a real personality wins her." },
  { key: "mara", name: "Lunchbox-Mom Mara",
    bio: "Buys for her gluten-free kid. Highest lifetime value. Wants her kid included at the snack table and needs to trust the label before it goes in the lunchbox. Warm, practical, repeat-buyer if won." },
];

const SYSTEM =
`You are a synthetic consumer panel for Chasin' Dreams Farm, a woman-owned, gluten-free, avocado-oil "ancient grain puffs" snack brand with a fun Y2K "Crunch Party" world and ingredient mascots (Avo, Sorghum, Rice) hosted by founder Syd.
You role-play FOUR distinct shoppers reacting to a single proposed social post. Stay ruthlessly in each persona's point of view — they disagree with each other. Be honest: if a brief is weak, mid, or not for them, say so and score it low. Do not be a cheerleader.
For each persona return:
- score: 0-100, how likely THIS persona is to stop, save/share, and eventually buy based on THIS post.
- line: 1-2 sentences in their own first-person voice reacting to the post (specific to the brief, not generic).
- share: one of "would share", "would save", "would watch", or "would scroll past".
Return ONLY valid JSON, no prose, in exactly this shape:
{"reactions":[{"key":"chloe","score":0,"line":"","share":""},{"key":"kayla","score":0,"line":"","share":""},{"key":"sage","score":0,"line":"","share":""},{"key":"mara","score":0,"line":"","share":""}]}`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) { res.status(500).json({ error: "GEMINI_API_KEY not set" }); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { concept = "", hooks = [], caption = "", pillar = "", dna = "" } = body || {};

  const user =
`PROPOSED POST
Concept: ${concept}
Content pillar: ${pillar}  ·  Format: ${dna}
Hook options: ${(hooks || []).join("  /  ")}
Caption: ${caption}

THE FOUR PERSONAS
${PERSONAS.map(p => `- ${p.key} (${p.name}): ${p.bio}`).join("\n")}

React as all four. Return ONLY the JSON.`;

  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(MODEL) + ":generateContent?key=" + encodeURIComponent(key);
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.9, responseMimeType: "application/json", maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!r.ok) { const t = await r.text(); res.status(502).json({ error: "gemini " + r.status, detail: t.slice(0, 400) }); return; }
    const j = await r.json();
    const txt = (j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts.map(p => p && p.text || "").join("")) || "";
    const m = txt.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : txt);
    res.status(200).json({ reactions: parsed.reactions || [] });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
};
