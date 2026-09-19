# UMG sidecar on the live BioLabs CRM host

Adapter merge (PR #1): **`bb1af15e26e7b0609bcdd342321259579898b621`**.  
Sidecar deploy doc landed on `main` as **`0721137`** (or a later commit that contains `docs/UMG_SIDECAR_DEPLOY.md`).

This repo is **not** the live CRM. Do **not** replace `/opt/crm-api` or `/var/www/mastersol/html/CRM`.

| Piece | Production reality |
|---|---|
| Frontend | `https://crm.biolabsresearch.co` → `/var/www/mastersol/html/CRM` (URL prefix `/crm/`) |
| CRM API | `node /opt/crm-api/server_v14.cjs` on `127.0.0.1:3001` — nginx `location /api/` → 3001 |
| Catalog API | products-api on `:4000` |
| This repo | sidecar only, install at **`/opt/crm-umg`**, listen **`127.0.0.1:8787`** |
| Secret | already on host: `/root/secure-quarantine-20260917-audit/umg.env` mode `600` |

`GET /api/health` stays on **3001** (v14.09). Sidecar health is **`GET /api/psp/health`** (localhost or the `/api/psp/` nginx block). Never print `UMG_API_SECRET`.

---

## 1. Install `/opt/crm-umg`

```bash
sudo mkdir -p /opt/crm-umg /var/lib/crm-umg
sudo git clone https://github.com/y0505300530-pixel/crm-app.git /opt/crm-umg
cd /opt/crm-umg
sudo git fetch origin main
sudo git checkout main
sudo git pull --ff-only origin main
git rev-parse HEAD
# must include 0721137 (sidecar deploy) or later: git merge-base --is-ancestor 0721137 HEAD && echo ok
```

If the directory already exists, only `fetch` / `checkout main` / `pull --ff-only`.

```bash
cd /opt/crm-umg
sudo npm ci || sudo npm install
# lockfile in this repo was Windows-built; Linux extras may be required to run tests
sudo npm install --omit=dev @rollup/rollup-linux-x64-gnu @esbuild/linux-x64
sudo npm test
```

Do not set `UMG_DRY_RUN=1` on this host.

Confirm the key file exists without printing it:

```bash
sudo python3 -c "from pathlib import Path; p=Path('/root/secure-quarantine-20260917-audit/umg.env'); t=p.read_text(); print('exists', p.exists(), 'mode', oct(p.stat().st_mode & 0o777), 'keyed', t.startswith('UMG_API_SECRET=') and len(t.strip().split('=',1)[-1])>=32)"
```

---

## 2. systemd unit

File: `/etc/systemd/system/crm-umg.service`

```ini
[Unit]
Description=BioLabs CRM UMG/PSP sidecar (:8787)
After=network.target
# Do not After= or PartOf= crm-api. Leave /opt/crm-api alone.

[Service]
Type=simple
WorkingDirectory=/opt/crm-umg
Environment=PORT=8787
Environment=CRM_PUBLIC_URL=https://crm.biolabsresearch.co
Environment=STORE_PATH=/var/lib/crm-umg/store.json
Environment=UMG_ENV_PATH=/root/secure-quarantine-20260917-audit/umg.env
Environment=PAYMENTS_ENABLED=false
# Do not put UMG_API_SECRET in this file. Do not set UMG_DRY_RUN=1.
# Quote mode is the storefront SoT. Set PAYMENTS_ENABLED=true only when card capture is unlocked.
ExecStart=/usr/bin/node /opt/crm-umg/server/index.js
Restart=on-failure
RestartSec=2
User=root

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now crm-umg
sudo systemctl status crm-umg --no-pager
curl -sS http://127.0.0.1:8787/api/psp/health
# umgSecretConfigured should be true; response must not contain the key
```

---

## 3. nginx — only these prefixes; leave `/api/` → 3001

These `^~` blocks win over the existing `location /api/` proxy to `:3001`. Do **not** change that catch-all.

```nginx
# UMG / PSP sidecar on 127.0.0.1:8787 — do not steal /api/ → 3001
location ^~ /api/checkout/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location = /api/webhooks/umg {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location ^~ /api/psp/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location ^~ /api/store-orders {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

If `$forwarded_for_value` is not defined on this host, use `$proxy_add_x_forwarded_for` in the checkout block too.

| Public path | Sidecar | Why |
|---|---|---|
| `/api/checkout/quote` | yes | storefront SoT while payments are off — see [QUOTE_MODE.md](./QUOTE_MODE.md) |
| `/api/checkout/charge` | yes | UMG cascade, gated by `PAYMENTS_ENABLED` (default **false** → HTTP 503) |
| `/api/webhooks/umg` | yes | UMG portal callback |
| `/api/psp/health` | yes | sidecar health (not `/api/health`) |
| `/api/psp/settings` | yes | Processors UI |
| `/api/psp/dry-run` | yes | admin dry-run |
| `/api/store-orders` + `/poll` | yes | PSP clearing list (not shop fulfillment) |
| `/api/health` | **no — stays 3001** | live CRM v14.09 |
| `/api/login` `/api/orders` `/api/leads` … | **no — stays 3001** | live CRM |

```bash
sudo nginx -t && sudo systemctl reload nginx
```

UMG portal callback:

```
https://crm.biolabsresearch.co/api/webhooks/umg
```

Prove both stacks:

```bash
curl -sS https://crm.biolabsresearch.co/api/health
# still {"status":"ok","version":"14.09",...}

curl -sS https://crm.biolabsresearch.co/api/psp/health
# sidecar: umgSecretConfigured true, no secret field

curl -sS -X POST https://crm.biolabsresearch.co/api/webhooks/umg \
  -H 'Content-Type: application/json' \
  -d '{"ID":"0","Status":"PENDING"}'
# unknown_transaction is OK — route reached 8787, not 3001
```

---

## 4. Processors UI vs live CRM HTML

The React Processors / Store-orders panels in this repo (`src/ProcessorSettings.jsx`, `src/StoreOrders.jsx`) **cannot mount into the live CRM** without a larger rewrite. Live pages are static HTML + `crm.js` / `auth.js`. This repo is a Vite PayTrack shell. Dropping `dist/` over `/CRM` would replace login/dashboard.

Live `/crm/store-orders.html` is **shop fulfillment** against 3001 `GET /api/orders`. Do **not** overwrite it. Sidecar clearing is a different resource: `/api/store-orders`.

### Minimum live-CRM HTML changes

All paths are under **`/var/www/mastersol/html/CRM`** (served as `/crm/…`).

| File | Change |
|---|---|
| `crm.js` | In the `STORE` nav `items` array (next to `store-orders`), add `{ key: 'processors', icon: '🏦', label: 'Processors', m: 1, admin: 1 }` and `{ key: 'psp-clearing', icon: '💳', label: 'PSP Clearing', m: 1 }`. Bump every `crm.js?v=` query on pages you touch. |
| `processors.html` | **New file.** Drop in `docs/live-crm/processors.html` from this repo. |
| `psp-clearing.html` | **New file.** Drop in `docs/live-crm/psp-clearing.html`. |
| `store-orders.html` | Leave as-is (shop orders). Optional later: a “Clearing” link to `psp-clearing.html`. |
| `store-settings.html` | Optional: one row “Card processors → /crm/processors.html”. Not required. |

Copy:

```bash
sudo cp /opt/crm-umg/docs/live-crm/processors.html /var/www/mastersol/html/CRM/processors.html
sudo cp /opt/crm-umg/docs/live-crm/psp-clearing.html /var/www/mastersol/html/CRM/psp-clearing.html
# then edit crm.js NAV as above; do not replace crm.js wholesale
```

Until those three files are updated on the live tree, the sidecar API still works (`curl` / Indian checkout hook / UMG webhook). Operators will not see Processors in the existing sidebar.

---

## 5. Out of scope

- Storefront `biolabsresearch.co` stays v2.99a.
- `/opt/crm-api/server_v14.cjs` is not modified.
- Tagada / Centrobill remain stubs on the sidecar.
- Do not proxy `/api/` or `/api/health` to `:8787`.
