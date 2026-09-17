# UMG deploy (read this first)

**Production topology is a sidecar. Do not replace `/opt/crm-api` or the live `/CRM` tree.**

Exact host steps, systemd unit, nginx `^~` prefixes, and live-HTML file list:

**[docs/UMG_SIDECAR_DEPLOY.md](./UMG_SIDECAR_DEPLOY.md)**

| Do | Do not |
|---|---|
| Install this repo at `/opt/crm-umg`, port **8787** | Overwrite `/opt/crm-api/server_v14.cjs` |
| Proxy only `/api/checkout/`, `/api/webhooks/umg`, `/api/psp/`, `/api/store-orders` | Proxy `/api/` or `/api/health` to 8787 |
| Keep `umg.env` at `/root/secure-quarantine-20260917-audit/umg.env` (already `600`) | Commit, echo, or log the key |
| Copy drop-in pages from `docs/live-crm/` | Replace live `store-orders.html` (that page is shop fulfillment on 3001) |

Sidecar health: `GET /api/psp/health`  
Live CRM health: `GET /api/health` (v14.09 on :3001)

Callback: `https://crm.biolabsresearch.co/api/webhooks/umg`

Storefront stays v2.99a. Checkout hook (Indian) posts to `POST /api/checkout/charge`.
