/**
 * foundry-status — Cloudflare Worker
 *
 * Reports whether the Foundry VTT origin behind the Cloudflare tunnel is
 * actually reachable, as JSON: { "up": true | false }.
 *
 * Why this exists: the /play/ page can't tell a live Foundry (HTTP 200) apart
 * from a closed one (Cloudflare 502 — tunnel up, origin down) using a browser
 * fetch, because a cross-origin `no-cors` response is opaque and hides the
 * status code. A Worker fetches server-side and CAN read the real status, so
 * the page polls this endpoint instead of probing the tunnel directly.
 *
 * Deploy at https://ahvantir.world/api/foundry-status (see wrangler.toml).
 */

const FOUNDRY_URL = "https://play-tunnel.ahvantir.world/";

export default {
  async fetch() {
    let up = false;
    try {
      const res = await fetch(FOUNDRY_URL, {
        method: "GET",
        // A login redirect (302 -> /join) still means Foundry is up, so keep
        // it as a 3xx rather than following it.
        redirect: "manual",
        // Never serve a cached verdict — Foundry's state changes minute to minute.
        cf: { cacheTtl: 0, cacheEverything: false },
      });
      // Foundry up  -> 200, or 3xx login redirect.
      // Origin down -> Cloudflare 502/503/504 (tunnel reachable, Foundry isn't).
      up = res.status >= 200 && res.status < 400;
    } catch (_) {
      // DNS / connection failure — the whole tunnel is gone.
      up = false;
    }

    return new Response(JSON.stringify({ up }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        // Same-origin when served at /api/... on ahvantir.world; this header
        // also lets a *.workers.dev deployment be read by the site if needed.
        "Access-Control-Allow-Origin": "https://ahvantir.world",
      },
    });
  },
};
