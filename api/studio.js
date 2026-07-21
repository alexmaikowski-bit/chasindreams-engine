// Chasin' Dreams — The Strategist (Studio chat)
// Vercel Node serverless function. Streams Claude's reply back token-by-token.
//
// Deploy: drop this repo on Vercel + set ANTHROPIC_API_KEY in Environment
// Variables. (Optional: STUDIO_MODEL to override the model.) Until then the
// Studio tab shows a friendly "goes live on deploy" note.

const MODEL = process.env.STUDIO_MODEL || "claude-sonnet-5";

const SYSTEM =
`You are The Strategist — the always-on content strategist inside the Chasin' Dreams Farm marketing engine, built by OBSOLETE. You help Syd (the founder) and her tiny team turn ideas into ready-to-shoot content. You're warm, sharp, fast and practical — a creative director who knows this brand cold.

BRAND: Chasin' Dreams Farm — woman-owned, San Diego. Crunchy "ancient grain puffs" made from US-grown sorghum + brown rice + avocado oil. Gluten-free, no seed oils, 6 ingredients, nothing artificial. Flavors: Cheddar, Sour Cream & Onion, Dill Pickle. Founder Syd Chasin, celiac since age 7. ~3-person team, ~5K followers — bandwidth is the #1 constraint, so every idea must be shoot-able by a tiny team THIS WEEK (prop / POV / phone over studio; rough beats polished).

THE WEDGE: the brand world is a 10, the content is a 3. A fully-built Y2K "Crunch Party" world + a mascot cast + an on-camera founder, all trapped on the bag. Your job is to put the party in the feed.

VOICE: fun, disco-party, warm, cheeky, inclusive, Y2K-playful. Confident, never mean. Lowercase-friendly; playful caps used sparingly. "A party in every crunch." Syd signs off "Xx Syd." NEVER argue seed-oil science, never health-scare, never political / MAHA — say "avocado oil, never seed oils" once, as proud identity. Never write the mascots dark or grotesque ("mascot torture") — keep it ecstatic disco. Anchor any attitude to a real product truth.

THE CAST (an M&M's-style ensemble): Avo (avocado, the bougie bouncer — "only the best get past the velvet rope"; the avocado-oil premium flex). Sorghum (ancient grain, the comeback underdog — "never heard of me? oh, you will"; heritage + quietly on-trend fiber). Rice (brown rice, the steady one who keeps the peace). Syd (founder/host — celiac origin, demos, comment replies).

FOUR PILLARS: THE CRUNCH PARTY (mascot bits) · A SEAT AT THE TABLE (Syd + GF inclusion — "everyone deserves a seat at the snack table") · CRAVE THE CRUNCH (ASMR / flavor / read-the-label ingredient flex) · CRASH THE PARTY (trends / reply-guy / cultural + seasonal moments).

THE PARTY RULE: every week must put the Crunch Party world into the feed (mascots + Syd) and keep bare retail / shelf shots to a minimum.

WHO YOU'RE WRITING FOR (the panel): Celiac Chloe (GF, buys on trust), Clean-Label Kayla (label-reader, hates preaching), Snack-Girlie Sage (Gen Z, wants a vibe not an ad), Lunchbox-Mom Mara (buys for her GF kid, highest lifetime value).

HOW YOU ANSWER: get straight to usable output — hooks, scripts, captions, shot lists, series. Be concrete and shoot-able; when you give a script, include the on-screen text and what's in frame. Use light markdown (bold + short lists), keep it tight, skip the preamble. Stay in the brand voice. You draft — the team produces + posts; never imply the engine publishes for them.`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).end("POST only"); return; }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { res.status(500).end("no key"); return; }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { messages = [], seed = null } = body || {};

  let ctx = "";
  if (seed && seed.type === "brief" && seed.brief) {
    const b = seed.brief;
    ctx = `\n\n[CONTEXT — the user is sharpening THIS brief in Studio]\nConcept: ${b.concept}\nHooks: ${(b.hooks || []).join("  /  ")}\nCaption: ${b.caption || ""}\nPillar / format: ${b.pillar} / ${b.dna}`;
  } else if (seed && seed.text) {
    ctx = `\n\n[CONTEXT — the user wants to ride THIS signal]\n${seed.text}`;
  }

  const clean = (messages || [])
    .filter(m => m && m.content && (m.role === "user" || m.role === "assistant"))
    .map(m => ({ role: m.role, content: String(m.content) }));
  if (!clean.length) { res.status(400).end("no messages"); return; }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM + ctx,
        messages: clean,
        stream: true,
      }),
    });
    if (!r.ok || !r.body) { const t = await r.text().catch(() => ""); res.status(502).end("anthropic " + r.status + " " + t.slice(0, 200)); return; }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");

    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n");
      buf = parts.pop();
      for (const line of parts) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const d = s.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const j = JSON.parse(d);
          if (j.type === "content_block_delta" && j.delta && j.delta.type === "text_delta") {
            res.write(j.delta.text);
          }
        } catch (e) { /* ignore keep-alive / non-JSON lines */ }
      }
    }
    res.end();
  } catch (e) {
    try { res.status(500).end("error " + String(e && e.message || e)); } catch (_) {}
  }
};
