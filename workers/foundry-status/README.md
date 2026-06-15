# foundry-status Worker

A tiny Cloudflare Worker that tells the `/play/` page whether Foundry is
actually live. It fetches the tunnel server-side, reads the **real** HTTP
status (which a browser can't, cross-origin), and returns `{ "up": true|false }`.

- **Up:** tunnel returns 200 or a 3xx login redirect → `{ "up": true }`
- **Down:** Foundry closed → Cloudflare 502/503/504, or tunnel gone → `{ "up": false }`

The page (`src/assets/js/play.js`) polls `/api/foundry-status` every 30s and shows
the Foundry iframe only when `up` is true; otherwise it shows the "no active
game" panel. Until this Worker is deployed, that endpoint 404s and the page
treats Foundry as offline (safe default).

## Deploy (you must do this — needs your Cloudflare auth)

```sh
npm install -g wrangler        # if not already installed
cd workers/foundry-status
wrangler login                 # opens browser; authorizes your Cloudflare account
wrangler deploy
```

Or via the Cloudflare dashboard: **Workers & Pages → Create Worker**, paste
`worker.js`, deploy, then **Settings → Triggers → Add route**:
`ahvantir.world/api/foundry-status` (zone `ahvantir.world`).

## Verify after deploy

```sh
curl https://ahvantir.world/api/foundry-status
# Foundry closed -> {"up":false}
# Foundry open   -> {"up":true}
```

If you'd rather deploy without a custom route, `wrangler deploy` also gives a
`https://foundry-status.<your-subdomain>.workers.dev` URL — if you use that
instead, update `STATUS_ENDPOINT` in `src/assets/js/play.js` to point at it
(the Worker already sends the CORS header to allow it).
