# UMG deploy notes (CRM only)

Site tip stays **v2.99a**. This is the CRM payment processor — not a storefront change.

## Secret (server only)

Do **not** commit or print the key.

1. Write the key on the CRM host only:

```
/root/secure-quarantine-20260917-audit/umg.env
```

File contents (one line, no quotes unless the value itself has them):

```
UMG_API_SECRET=<64-char key from UMG portal>
```

2. Permissions: `chmod 600` and owner root / the CRM service user.
3. Optional override: `UMG_ENV_PATH=/other/path/umg.env` or `UMG_API_SECRET` in the systemd environment (still never in git).
4. `GET /api/health` returns `umgSecretConfigured: true|false` and the path — never the value.

## Process

```
npm test
node server/index.js          # default :8787
# vite `npm run dev` proxies /api → 8787
```

Env:

| Variable | Purpose |
|---|---|
| `PORT` | CRM API port (default 8787) |
| `STORE_PATH` | JSON store for orders + settings (default `server/data/store.json`) |
| `CRM_PUBLIC_URL` | Public origin used to build the callback URL, e.g. `https://crm.biolabsresearch.co` |
| `UMG_DRY_RUN=1` | Force mock UMG (no live calls) |
| `UMG_POLL_MS` | Pending/3DS poll interval (default 30000) |

## Callback URL (UMG portal)

Set the webhook to:

```
https://<CRM_PUBLIC_URL>/api/webhooks/umg
```

Example: `https://crm.biolabsresearch.co/api/webhooks/umg`

Payload accepted: `{ "ID": "<txn id>", "Status": "APPROVED|DECLINED|PENDING|CANCELED|CAPTURED|REFUNDED|CHARGEBACK" }` (case-insensitive keys).

Until the portal callback is live, CRM polls `GET https://pay.umg.inc/rest/v1/transactions/<id>?Authorization=<base64(key)>` for PENDING / 3DS rows.

## Charge API (future storefront hook — Indian)

`POST /api/checkout/charge`

- Same cart `idempotencyKey` is reused — no double charge after approval/pending.
- PAN/CVV are used only in-memory for the UMG POST and are not stored.
- Soft decline / timeout / 5xx / processor-down → next enabled PSP.
- Hard decline (fraud / do-not-honor / invalid card) stops the cascade.

Tagada and Centrobill are stubs (processor-down / not wired).

## Sandbox note

UMG sandbox often returns HTTP 201 + `DECLINED` `Code:203`. That is a **soft** decline, not a broken adapter. Treat `APPROVED` the same shape when the MID is live.
