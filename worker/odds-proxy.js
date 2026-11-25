// Cloudflare Worker: keeps the Odds API key private for live.html.
//
// Setup (see LIVE.md): paste this file into a new Worker, then add
//   ODDS_API_KEY     (Secret)  your The Odds API key
//   ALLOWED_ORIGINS  (Text, optional) comma-separated origins allowed to call it,
//                    default "https://tannerstruth.github.io"
//   MIN_SECONDS      (Text, optional) minimum seconds between real upstream calls,
//                    default 60. Requests inside that window get the cached answer
//                    and cost nothing.
//
// GET /odds   -> NCAAB spreads + totals (US books). 2 credits per upstream call.
// GET /usage  -> credits remaining/used, from a free call (0 credits).
//
// The page gets JSON: { fetchedAt, cached, usage:{remaining,used,last}, data }

const SPORT = "basketball_ncaab";
const API = "https://api.the-odds-api.com/v4/sports";

let cache = null; // { at, body } — per isolate, best effort

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "https://tannerstruth.github.io")
      .split(",").map(s => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes("*") || allowed.includes(origin) ||
      origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1");
    const cors = {
      "Access-Control-Allow-Origin": okOrigin ? origin : allowed[0],
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Vary": "Origin",
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
      status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (!okOrigin) return json({ error: "origin not allowed" }, 403);
    if (!env.ODDS_API_KEY) return json({ error: "ODDS_API_KEY secret is not set on the Worker" }, 500);

    const url = new URL(request.url);
    const usageOf = r => ({
      remaining: num(r.headers.get("x-requests-remaining")),
      used: num(r.headers.get("x-requests-used")),
      last: num(r.headers.get("x-requests-last")),
    });

    if (url.pathname === "/usage") {
      // The /sports list is free and still returns the usage headers.
      const r = await fetch(`${API}?apiKey=${encodeURIComponent(env.ODDS_API_KEY)}`);
      return json({ fetchedAt: new Date().toISOString(), usage: usageOf(r) }, r.ok ? 200 : r.status);
    }

    if (url.pathname === "/odds") {
      const minMs = 1000 * Math.max(15, Number(env.MIN_SECONDS || 60));
      if (cache && Date.now() - cache.at < minMs) {
        return json({ ...cache.body, cached: true });
      }
      const q = new URLSearchParams({
        apiKey: env.ODDS_API_KEY,
        regions: "us",
        markets: "spreads,totals",
        oddsFormat: "american",
      });
      const r = await fetch(`${API}/${SPORT}/odds?${q}`);
      const usage = usageOf(r);
      if (!r.ok) return json({ error: `Odds API ${r.status}: ${await r.text()}`, usage }, r.status);
      const body = { fetchedAt: new Date().toISOString(), usage, data: await r.json() };
      cache = { at: Date.now(), body };
      return json({ ...body, cached: false });
    }

    return json({ ok: true, routes: ["/odds", "/usage"] });
  },
};

function num(v) { return v == null || v === "" ? null : Number(v); }
