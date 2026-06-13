# Foundry VTT — Cloudflare Tunnel Setup

This document covers everything needed to make the `/play` page on ahvantir.world
serve a live Foundry VTT session through a Cloudflare Tunnel.

The tunnel routes `play-tunnel.ahvantir.world` → `localhost:30000` (Foundry's default
port) on your Windows machine. The `/play` page on the static site embeds Foundry
in an iframe once the tunnel is running.

---

## Step 1 — Install cloudflared on Windows

Download the Windows installer from Cloudflare's official download page:
https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

Run the installer. Verify with:

```
cloudflared --version
```

---

## Step 2 — Authenticate cloudflared

```
cloudflared tunnel login
```

A browser window opens. Log in with the Cloudflare account that manages the
`ahvantir.world` zone. cloudflared stores a certificate at
`C:\Users\klfal\.cloudflared\cert.pem`.

---

## Step 3 — Create the tunnel

```
cloudflared tunnel create ahvantir-foundry
```

This generates:
- A **tunnel UUID** (printed to the console)
- A **credentials file** at `C:\Users\klfal\.cloudflared\<TUNNEL-UUID>.json`

---

## Step 4 — Fill in the config file

Open `.cloudflared\config.yml` in the repo root and replace both placeholders:

```yaml
tunnel: <TUNNEL-UUID>            # ← paste the UUID from Step 3
credentials-file: C:\Users\klfal\.cloudflared\<TUNNEL-UUID>.json  # ← same UUID
```

---

## Step 5 — Add the DNS record in Porkbun

In Porkbun DNS for `ahvantir.world`, add a CNAME record:

| Type  | Name                | Value                             | TTL  |
|-------|---------------------|-----------------------------------|------|
| CNAME | play-tunnel         | `<TUNNEL-UUID>.cfargotunnel.com`  | Auto |

This routes `play-tunnel.ahvantir.world` to the Cloudflare Tunnel network.

---

## Step 6 — Enable WebSocket support in Cloudflare

Foundry VTT uses WebSockets for real-time game updates (dice rolls, map sync, chat).
Tunnels do not enable WebSocket passthrough by default.

In the Cloudflare dashboard:
Zero Trust → Networks → Tunnels → `ahvantir-foundry` → Settings →
Enable **WebSocket connections**

---

## Step 7 — Update the FOUNDRY_URL constant in play.js

Open `src/assets/js/play.js` and replace the placeholder at the top of the file:

```js
var FOUNDRY_URL = 'https://play-tunnel.ahvantir.world';
```

If you used a different hostname in Step 5, update this to match.

Also update the `frame-src` directive in `src/_includes/layouts/base.njk` if the
hostname changed:

```html
frame-src https://play-tunnel.ahvantir.world
```

Deploy the site after both changes so the updated iframe URL and CSP go live.

---

## Step 8 — Start the tunnel

**One-time test run** (keeps the tunnel alive while the terminal is open):

```
cloudflared tunnel run ahvantir-foundry
```

**Install as a Windows service** (starts automatically on boot, survives terminal close):

```
cloudflared service install
```

Then start it:

```
net start Cloudflared
```

---

## Step 9 — Update Foundry options.json

> **Important:** Make these changes while Foundry is fully stopped. Editing
> options.json while Foundry is running has no effect and may be overwritten.

The file is at: `C:\Users\klfal\AppData\Local\FoundryVTT\Config\options.json`

Current relevant values (as read 2026-06-12):
```json
"hostname":   null,
"proxySSL":   false,
"proxyPort":  null
```

Required changes:
```json
"hostname":   "play-tunnel.ahvantir.world",
"proxySSL":   true,
"proxyPort":  null
```

**Why:** `hostname` tells Foundry its public address, which it uses when generating
absolute URLs and internal CSP headers. `proxySSL: true` tells Foundry it is sitting
behind an HTTPS proxy (Cloudflare), so it generates `https://` URLs instead of
`http://`.

---

## Step 10 — Allow iframe embedding from ahvantir.world

By default Foundry sets `X-Frame-Options: SAMEORIGIN`, which blocks the site from
embedding it in an iframe. Override this via a Cloudflare Transform Rule on the tunnel.

In the Cloudflare dashboard:

1. Go to your zone (`ahvantir.world`) → **Rules** → **Transform Rules** →
   **Modify Response Header**
2. Create a new rule named `Allow Foundry iframe embedding`
3. Match: `(http.host eq "play-tunnel.ahvantir.world")`
4. Add two response header operations:
   - **Remove** header: `X-Frame-Options`
   - **Set** header: `Content-Security-Policy` →
     `frame-ancestors 'self' https://ahvantir.world`

This allows `ahvantir.world` to embed the Foundry iframe while still blocking
embedding from any other domain.

---

## Summary checklist

- [ ] cloudflared installed and authenticated
- [ ] Tunnel created (`cloudflared tunnel create ahvantir-foundry`)
- [ ] `.cloudflared/config.yml` filled in (UUID + credentials path)
- [ ] Porkbun CNAME: `play-tunnel` → `<UUID>.cfargotunnel.com`
- [ ] WebSocket support enabled in Cloudflare Zero Trust dashboard
- [ ] `FOUNDRY_URL` constant updated in `src/assets/js/play.js`
- [ ] `frame-src` in `src/_includes/layouts/base.njk` matches the tunnel hostname
- [ ] Tunnel running (`cloudflared tunnel run` or Windows service)
- [ ] Foundry `options.json` updated: `hostname`, `proxySSL: true`
- [ ] Cloudflare Transform Rule: remove `X-Frame-Options`, set `frame-ancestors`
- [ ] Site redeployed after code changes
