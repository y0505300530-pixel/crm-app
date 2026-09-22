# CRM & Retention Inventory Report

**Sites:** biolabsresearch.co · crm.biolabsresearch.co  
**Audit date:** 2026-09-22 (IDT / Asia/Jerusalem)  
**Method:** READ-ONLY live SSH + dig/curl GET/HEAD + GitHub metadata. No mutations.  
**Evidence tags:** **LIVE-READ** = counted/read from production today; **ESTIMATE** = inferred from code/UI without a live provider pull.

---

## One-page summary

### What exists (LIVE-READ)

| Layer | What | Status |
|-------|------|--------|
| **CRM admin UI** | Static HTML under `/var/www/mastersol/html/CRM` on `crm.biolabsresearch.co` | Live |
| **blitz-api (crm-api)** | Custom Node/Express `server_v14.cjs` @ `:3001`, PM2 name `blitz-api` | Online, health `14.09` |
| **products-api** | Custom Node `:4000`, PM2 `products-api` — catalog, subscribe, track, notify-order, stock APIs | Online |
| **crm-umg / PSP sidecar** | `/opt/crm-umg` Node `:8787`, systemd `crm-umg.service` | Online, **`PAYMENTS_ENABLED=false` → mode=`quote`** |
| **Storefront** | `/var/www/biofirst/html` (repo `biolabsresearch-co`) served as biolabsresearch.co / blrcommerce | Live |
| **Email provider** | Customer.io (keys present in `/opt/crm-api/.env`; CRM Marketing UI is CIO proxy) | Connected (keys present; last CIO meta sync 2026-09-08) |
| **Contacts** | `leads.json` **22** leads; coupon INSIDER25 on **17** | Live |
| **Quotes (UMG)** | **21** quotes, all `quote_requested` / `Not Contacted`, all `emailSent=true` | Live |
| **Shop orders** | `orders.json` **26** rows (mixed inquiry/signup/manual payment methods) | Live |
| **Abandoned checkouts** | **13** sessions in UMG store (mostly QA), capture JS live on checkout | Capture live; follow-up digest **disabled** |
| **Segmentation** | CRM marketing segments VIP / Customers / Insiders + newsletter sends | Partially live |
| **Inventory UI + stock API** | CRM Inventory page + `/msolpeptides-api/stock/*` | Code exists; **no `stock_qty` in catalog JSON today** |
| **Analytics** | GA4 `G-KCMPHP783M` (Marketing prop **552249403**) via cookie consent + CIO track; CRM digests day-based (endpoint **404 until route wired**) | Partial — GA live post-consent; leads-digest route missing |

### Dead / dormant (LIVE-READ)

- **Card charge path:** `PAYMENTS_ENABLED=false`; charge returns payments_disabled / quote mode.
- **INSIDER25 promo bar:** `promo-bar.js` is a stub that kills `#promoStack` (removed 2026-09-15); email-capture still hands out code `INSIDER25`.
- **Abandon digest job:** `ABANDON_DIGEST_ENABLED` unset/false → in-process interval **not started**; `abandonedDigestAt=null`.
- **Marketing segment auto-sync:** `MARKETING_SYNC_INTERVAL_MIN=0` → scheduled sync **off**.
- **CIO people sync stamp:** `cio-meta.json` `last_sync_at` = 2026-09-08 (stale vs today).
- **biofirst-sync.timer:** loaded but **disabled/inactive** (biofirst.co nginx on this host only 302-loops; real biofirst moved to 159.223.116.190 per comment).
- **CRM Automations / Campaigns pages:** placeholder UI (“Connect Customer.io…”) with toast stubs; real journeys live only in Customer.io.
- **Shop stock ledger:** `stock_movements.json` / `stock_writeoffs.json` / PO / sales / invoices = **empty (0)**.
- **Customer account / order history:** `/account` `/login` `/orders` → **404** on biolabsresearch.co.
- **UMG card orders:** 6 probe/QA orders only (3 approved / 3 declined); not a production paid book.

### Missing / blockers for retention

- No first-party sequencing engine (journeys = Customer.io only).
- No post-quote / reorder / cross-sell / back-in-stock / notify-me productized flows on storefront.
- No customer self-serve account.
- VIP segment exists (1 member) but no loyalty program / points / tiers.
- Lot/batch tracking: not in product schema (UI has no lot fields).
- UMG admin/list endpoints (`GET /api/checkout/abandon`, `GET /api/store-orders`, `PUT /api/psp/settings`, digest POST) appear **unauthenticated at app layer** (nginx still required; still a risk) — **LIVE-READ** from code.
- Deliverability last-30d metrics: CRM has `/api/cio/deliverability` but values not pulled in this audit without authenticated CRM session (**ESTIMATE:** available only via CIO/CRM login).

---

## Table: retention feature → status → where → what blocks it

| Feature | Status | Where it lives | What blocks it |
|---------|--------|----------------|----------------|
| Email capture / INSIDER25 | **Exists** (capture live; promo UI dead) | Storefront `email-capture.js` → `POST /api/subscribe` → products-api → `leads.json` + CIO `subscribed` event; coupon still `INSIDER25` | Promo bar removed; welcome letter now CIO campaign 4 only (local welcome mail removed 2026-09-22). Code still promises “valid 30 days” in UI. |
| Abandoned follow-up | **Partially** | Capture: `checkout-abandon.js` → `POST crm…/api/checkout/abandon` → UMG store; CIO readiness checks “Shop Abandonment” journey filter; digest code in `abandon.js` | Digest disabled (`ABANDON_DIGEST_ENABLED` off); `abandonedDigestAt=null`; all 13 abandons QA-like; CIO journey health not verified live in this audit |
| Post-quote follow-up | **Partially** | Quote create + admin notify (`mail.js` → `admin@biolabsresearch.co`); CRM page stubs “Post-order follow-up” | No automated customer sequence after quote; all 21 quotes still `Not Contacted`; no CRM task/SLA engine |
| Reorder / same items | **Does not** | Stub copy on Automations page only | No reorder journey, no “buy again”, no order-history UX |
| Cross-sell after quote | **Does not** | — | No rules / recommendations / CIO campaign wired from quote events |
| Promo bar / campaigns | **Partially** | `promo-bar.js` stub; CRM Campaigns/Marketing pages; CIO broadcasts/newsletters (3 sent) | Storefront promo dead; campaign start/pause is CIO-side (CRM toasts) |
| VIP / loyalty | **Partially** | Segment `mseg_vip` (1 email); UI gold cart burst “no VIP copy” | No points, tiers, VIP pricing, or enrollment path |
| Customer account / order history | **Does not** | HEAD `/account` `/login` `/orders` = 404 | Never built on storefront |
| Inventory / stock / lot | **Partially** | CRM Inventory UI + stock adjust/writeoff/PO APIs | Public `products-data.json` has **no** `stock_qty` / lot fields; movements=0; lot not modeled |
| Back-in-stock / notify-me | **Does not** | — | No waitlist endpoint or storefront control |
| Segmentation / tagging | **Exists** | `marketing-segments.json` (VIP/Customers/Insiders); CIO segment ids 17–19; newsletter audience | Auto-sync off (`MARKETING_SYNC_INTERVAL_MIN=0`); old `segments.json` Italy rule orphaned |

---

## Data inventory

All counts **LIVE-READ** 2026-09-22 unless noted. Secrets/PANs never stored in report.

### A. `/opt/crm-api/data/` (blitz-api JSON store)

| File | Purpose | Rows / size today |
|------|---------|-------------------|
| `leads.json` | Contacts / insider + imported leads | **22** |
| `users.json` | CRM staff accounts | **9** (5 admin, 4 staff) |
| `.sessions.json` | Active CRM sessions | **3** sessions |
| `marketing-segments.json` | CRM↔CIO segments | **3** |
| `marketing-newsletters.json` | Newsletter drafts/sends | **3** (all `sent`) |
| `marketing-email-backups.json` | Letter text backups | **4** |
| `marketing-log.json` | Segment sync log | **13** events |
| `segments.json` | Legacy local segment | **1** (“Italy 3+ orders”) |
| `cio-meta.json` | CIO sync watermark | `last_sync_at` 2026-09-08T13:36:23Z |
| `ui-prefs.json` | Per-user nav layout | **3** |
| `backups/` | Hourly in-process backups | **80** backup dirs/files |
| `snapshots/` | Daily snapshots | through 2026-09-22 |

### B. Leads — full field list (LIVE-READ union)

`id`, `email`, `phone`, `company`, `city`, `country`, `coupon`, `notes`, `priority`, `status`, `status_manual_override`, `unsubscribed`, `cio_person_id`, `created_at`, `updated_at`, `last_email_sent_at`, `last_open_at`, `last_click_at`, `marketing_consent`, `marketing_consent_at`, `consent_source`, `consent_text`

**Breakdown (LIVE-READ):**

| Dimension | Counts |
|-----------|--------|
| status | Not Contacted 21 · Qualified 1 |
| coupon | INSIDER25 **17** · WELCOME10 1 · empty 4 |
| unsubscribed | true **2** · false 20 |
| marketing_consent | true **6** · empty 16 |
| consent_source | subscribe **6** · empty 16 |
| country | empty 15 · US 5 · Italy 1 · Spain 1 |
| priority | empty 15 · High 7 |
| cio_person_id nonempty | **0 / 22** |
| last_open_at / last_click_at | **0 / 22** |
| last_email_sent_at | **3 / 22** |

### C. `/var/lib/crm-umg/store.json` (UMG)

| Collection | Count | Key fields |
|------------|-------|------------|
| `quotes` | **21** | `id`, `amount`, `currency`, `customer{}`, `items[]`, `status`=`quote_requested`, `type`=`lead`, `crmStatus`=`Not Contacted`, `emailSent`, `emailError`, `session_id`, `attribution`, `idempotencyKey`, `notes`, `createdAt`, `updatedAt` |
| `orders` | **6** | `id` BLR-100x, `amount`, `currency`, `status` approved|declined, `customer{}`, `items[]`, `attempts[]`, processors, `idempotencyKey` |
| `abandoned_checkouts` | **13** (dict by session_id) | `session_id`, `stage`, `status` open|converted, `customer{}`, `items[]`, `subtotal`, `coupon`, `first_seen`, `last_seen`, `converted_*` |
| `settings` | processors umg/tagada/centrobill | umg sandbox enabled; others off |
| `seq` / `quoteSeq` | 1006 / 5021 | |
| `abandonedDigestAt` | **null** | |

**Quote value (LIVE-READ):** sum **$2141.00**, avg **$101.95**, min $20, max $210; unique emails **16**.  
**Abandon (LIVE-READ):** open 7 · converted 6; stages shipping 6 / contact 5 / email 2; **all sessions QA/probe-named**; emails on **13/13**.

### D. `/var/www/mastersol/html/MSOLPEPTIDES/` (products-api / ops)

| File | Rows | Notes |
|------|------|-------|
| `products-data.json` | **20** active catalog | No stock/lot fields on disk today |
| `orders.json` | **26** | types: null 21, insider-signup 5; status cancelled 8 / shipped 2 / new 1 / delivered 1 / null 14 |
| `customers.json` | **1** | ops customer record |
| `messages.json` | **12** | contact form |
| `suppliers.json` | **2** | |
| `quotations.json`, `sales.json`, `invoices.json`, `purchase_orders.json`, `stock_movements.json`, `stock_writeoffs.json`, `expenses.json`, `income.json`, `representatives.json`, `supplier_payments.json` | **0** each | Dormant ledgers |
| `activity_log.json` | **5** | |

**Shop order money (LIVE-READ, rows with numeric total):** n=16, sum **$2656.83**, avg **$166.05**; emails nonempty 17 / unique 10; **repeat customers 4** (max 4 orders). Payment methods mix inquiry/bank/Zelle/card-manual/quote — not a clean card LTV book.

### E. CRM users (LIVE-READ roles only)

9 users: admins include mastersol + biolabsresearch admin + owner addresses; 4 staff (affiliates + one personal). Password fields present as `passwordScrypt` / legacy `passwordHash` — not listed.

---

## Endpoint and job inventory

### Storefront-facing (nginx → products-api `:4000`)

On biolabsresearch.co / blrcommerce (`/api/*` → `/msolpeptides-api/*`):

| Path | Method | Auth | Caller | Writes |
|------|--------|------|--------|--------|
| `/api/subscribe` | POST | Public (+ rate limit) | `email-capture.js` | `leads.json`, CIO identify + `subscribed` event, returns `track_token` |
| `/api/track` | POST | Signed `track_token` | `cart-vial.js` | CIO events `cart_updated`, `checkout_started` |
| `/api/checkout-identify` | POST | Public (stricter email) | checkout form | CIO identify only |
| `/api/notify-order` | POST | Public (+ shop_order RL) | checkout | `orders.json` + CIO transactional msg ids |
| `/api/contact` | POST | Public | contact form | `messages.json` |
| `/api/coupon-quote` | POST | Public | cart | discount calc (INSIDER25=25%) |
| `/api/products` | GET | Public safe fields; CRM auth → full | storefront / Inventory | — / writes via PUT POST admin |

Also mirrored under `crm.biolabsresearch.co/msolpeptides-api/*`.

### UMG / PSP (`crm.biolabsresearch.co` → `:8787`)

| Path | Method | Auth (app) | Caller | Writes |
|------|--------|------------|--------|--------|
| `/api/checkout/quote` | POST | Public + CORS allowlist | `checkout-quote.js` | `quotes[]`, admin quote email attempt |
| `/api/checkout/charge` | POST | Public + CORS; **503 if payments off** | `checkout-charge.js` (dormant) | would write `orders[]` |
| `/api/checkout/abandon` | POST | Public + IP rate limit; CORS | `checkout-abandon.js` | `abandoned_checkouts` |
| `/api/checkout/abandon` | GET | **None in code** | CRM UI / ops | read |
| `/api/checkout/leads-digest` | GET | **`X-Marketing-Key`** (designed) | Marketing daily digest | read-only shaped rows — **NOT MOUNTED → live 404** |
| `/api/store-orders` (+`/:id`) | GET | **None in code** | CRM Orders | read |
| `/api/store-orders/poll` | POST | **None in code** | ops | poll processors |
| `/api/psp/health` | GET | Public | health | — |
| `/api/psp/settings` | GET/PUT | **None in code** | Processors UI | settings |
| `/api/psp/abandoned-digest` | POST | uses `MARKETING_DIGEST_KEY` for related digest paths; endpoint itself not clearly gated in index | timer/manual | email digest |
| `/api/psp/dry-run` | POST | **None in code** | QA | mock charge |
| `/api/webhooks/umg` (+tagada/centrobill) | POST | webhook secrets from `UMG_ENV_PATH` | PSP | order status |
| `/api/health` | GET | Public | — | — |

**CORS charge/quote/abandon allowlist (LIVE-READ code defaults):**  
`https://biolabsresearch.co`, `https://www.biolabsresearch.co`, `https://blrcommerce.io`, `https://www.blrcommerce.io`  
(override via env `CORS_STOREFRONT_ORIGINS`). Staff paths emit no CORS.

### blitz-api (`:3001`, nginx `/api/` except UMG prefixes)

Auth: session cookie after `POST /api/login` (scrypt passwords); `requireAuth` / `requireAdmin`.

| Mount | Notes |
|-------|-------|
| `/api/login` `/api/logout` `/api/session` | Public login / auth session |
| `/api/users*` `/api/me/*` `/api/audit` `/api/activity` | Admin/staff |
| `/api/leads*` | CRUD + import + sheets import (admin) |
| `/api/cio/*` | status, campaigns, messages, deliverability, lint, triggers |
| `/api/segments*` | legacy local segments |
| `/api/marketing/*` | overview, customer, readiness |
| `/api/marketing/segments*` | CRM segments + sync |
| `/api/marketing/newsletter*` | newsletter CRUD/test/send |
| `/api/marketing/emails*` | letter edit/test |
| `/api/marketing/people/:email/unsubscribe` + DELETE | CIO unsub/delete |
| `/api/health` | public |

**blitz-api CORS_ORIGINS (env names only):** includes mastersol + `https://crm.biolabsresearch.co` (from `.env.example` / live key list).

### Jobs / timers

| Job | Mechanism | Running? |
|-----|-----------|----------|
| Hourly CRM JSON backup | `setInterval` in `server_v14.cjs` | Yes (process up) |
| Daily snapshot | `setInterval` in server | Yes |
| Session persist / cleanup / rate-limit sweep / audit cleanup | in-process intervals | Yes |
| Marketing segment sync | `MARKETING_SYNC_INTERVAL_MIN=0` | **Off** |
| UMG payment poller | `startPoller` ~30s | Yes (process started it) |
| UMG abandon digest | `setInterval` only if `ABANDON_DIGEST_ENABLED` | **Not running** |
| `crm-data-backup.sh` | cron every 6h | Yes (crontab) |
| `daily-backup.sh` | cron 03:00 | Yes |
| sheets token copy | cron */30 | Yes |
| `mail-chain-check` | cron 07:15 | Yes (`/opt/mail-chain-check`) |
| `biofirst-sync.timer` | every 15s | **Inactive/disabled** |
| Custom CRM systemd timers | — | **None** (only `crm-umg.service`) |

PM2 processes online: `blitz-api`, `products-api`, `shop-chat`.

---

## 1. Architecture

**Custom vs framework:** Fully custom Node (Express for blitz-api; hand-rolled HTTP for products-api & crm-umg). No Shopify/Woo/Espo. Static HTML CRM + static storefront.

**Code locations & deploy:**

| Component | Path | Process | Repo |
|-----------|------|---------|------|
| CRM API | `/opt/crm-api` (`server_v14.cjs` + marketing/cio/leads modules) | PM2 `blitz-api` | GitHub `y0505300530-pixel/crm-app` (public); local checkout has **no git remote configured** |
| CRM UI | `/var/www/mastersol/html/CRM` | nginx static | historically MasterSol tree |
| UMG/PSP | `/opt/crm-umg` | systemd `crm-umg.service` | not a git repo on server |
| Catalog/ops API | `/var/www/mastersol/html/MSOLPEPTIDES/products-api.cjs` | PM2 `products-api` | MasterSol tree |
| Storefront | `/var/www/biofirst/html` | nginx biolabsresearch / blrcommerce | `y0505300530-pixel/biolabsresearch-co` |

**Auth model:**

- **Admin CRM:** email+password → session (idle 12h / max 7d); roles `admin`|`staff`; pageAccess; ADMIN_SECRET shared with products-api for catalog writes.
- **Public storefront APIs:** no customer login; subscribe/track/quote/abandon are public with nginx rate limits + track_token HMAC (`CIO_TRACK_TOKEN_SECRET`).
- **Payments:** disabled; quote-only.

**CORS note (charge):** allowlist exact-match reflect; never `*`. Live defaults listed above. Charge blocked by payments flag regardless.

---

## 2. Contacts / consent

**Counts by source (LIVE-READ):**

- Insider subscribe path: coupon INSIDER25 dominant (17); consent_source=`subscribe` only on **6** (newer M6 consent fields); older leads lack consent_* fields.
- Unsubscribed flag on lead: **2**.
- Bounce: **not stored** in leads.json (CIO owns bounce; `/api/cio/deliverability` aggregates message types when called).

**Dedupe / validation:** email normalized lowercase on upsert; subscribe validates format ≤200 chars; consent explicit `false` rejected.

**Unsubscribe one-click?**

- Customer.io emails: privacy copy claims every email has unsubscribe (**ESTIMATE** / site policy text in nginx).
- CRM: authenticated `POST /api/marketing/people/:email/unsubscribe` sets CIO `unsubscribed:true`.
- Lead-level `unsubscribed` filtered on CIO campaign trigger path (`filterUnsubscribed` / cio-routes).
- Storefront identify/subscribe **never sends** `unsubscribed:true` (by design comments).
- **Gap:** no proven sync that CRM `leads.json.unsubscribed` is updated when someone clicks CIO one-click (**open question**). cio_person_id empty on all leads weakens linkage.

---

## 3. Orders / quotes

**Lifecycle today:** Storefront is **quote/inquiry mode**. Checkout posts to `/api/checkout/quote` (UMG) and historically `/api/notify-order` (shop orders.json). Card charge path present but disabled.

**Totals (LIVE-READ):**

| Book | n | Money signal |
|------|---|--------------|
| UMG quotes | 21 | sum $2141 · avg ~$102 · all Not Contacted |
| UMG card orders | 6 | QA; 3 approved incl. $158 / $1887 probes |
| Shop orders.json | 26 | ~$2657 across 16 totaled rows; many cancelled/null |

**Repeat / LTV / VIP feasibility:** Only **4** repeat emails in shop orders; VIP segment has **1** member. Feasible once paid orders are real and identities merge (lead ↔ order ↔ CIO). **Today LTV is not production-grade (QA-heavy).**

**Abandon:** 13 captured, all linked to email, 6 converted to quote ids; **no post-capture email digest running**; reliance on CIO abandonment journey (filter readiness checked by CRM Marketing page, not re-verified here).

---

## 4. Email

**Provider:** Customer.io (LIVE-READ: CIO_* env keys present; CRM Marketing is “window on Customer.io”).

**From / domains:**

- Newsletter default from: `BioLabs Research <admin@biolabsresearch.co>` (code default / `CIO_NEWSLETTER_FROM`).
- Order notify: `ORDER_NOTIFY_TO` (env); transactional message ids `CIO_ORDER_MANAGER_MSG_ID`, `CIO_ORDER_CUSTOMER_MSG_ID`.
- Quote notify target: `admin@biolabsresearch.co` via webhook/CIO transactional URL if configured; else queued/none.

**DNS (LIVE-READ dig, no changes):**

| Domain | SPF | DMARC | DKIM |
|--------|-----|-------|------|
| biolabsresearch.co | `v=spf1 include:_spf.google.com ~all` | `v=DMARC1; p=none` | `google._domainkey` / CIO selectors **not resolved** in this audit (timeouts/empty) |
| biofirst.co | same Google SPF | `p=none` + rua admin@biofirst.co | same |

MX: Google for biolabsresearch.co; biofirst uses smtp.google.com.

**Templates / automations:**

- **Live:** Welcome on `subscribed` (CIO campaign 4 per code comment 2026-09-22); 3 newsletters sent (Sep 9/14/18); order manager/customer transactional ids wired; quote admin notify code path.
- **Dormant / placeholder:** CRM Automations page mock journeys (post-order, etc.); INSIDER25 site promo; abandon digest; local insider welcome mail removed.

**Deliverability last 30d:** Endpoint exists (`GET /api/cio/deliverability`) — **not pulled** without CRM session in this pass (**ESTIMATE:** use CRM Marketing or CIO UI).

**Sequencing engine:** **None first-party.** Sequencing = Customer.io journeys only.

---

## 5. Retention mechanics (detail)

See feature table above. Short form:

1. **Capture works** (subscribe + abandon + quote).  
2. **Nurture is thin** (newsletter blasts + CIO journeys of unknown completeness).  
3. **Monetize/retain loops missing** (account, reorder, BIS, loyalty, post-quote cadence, promo orchestration).  
4. **Ops inventory half-built** (UI/API yes, quantities/lots empty).

---

## 6. Analytics (CRM vs GA4) + track_token / consent / unsub verification

**Sources:** CRM/server LIVE-READ (this audit) + Marketing box GA4 property **552249403** + storefront JS (Marketing attributions marked **LIVE-READ · Marketing**). Numbers below are not invented.

### 6.1 Split: what lives where

| Lane | Owns | Never |
|------|------|-------|
| **CRM only** | email, cart line items, `quote_number`, `amount`, `crm_status`, spam flags (disposable/gibberish), `session_id`, `form_page` (`checkout_quote` / `checkout_abandon:<stage>`), attribution object (**utm_*** / landing / click-id **param names only** — values of click ids sanitized), Insider `consent_text` | PII → GA4 |
| **GA4 only** | sessions/users, source/medium, landing, country/device, `page_view` / scroll / engagement, aggregate custom events | emails, quote IDs, cart contents |
| **Both (loose)** | `generate_lead` (GA) vs CRM quote rows | Counts **diverge** (Soft-QA, cookie consent gate, bots) — expected |

**Marketing digests (intended contract):** `GET /api/checkout/leads-digest?day=YYYY-MM-DD` (Jerusalem day) + header `X-Marketing-Key` (`MARKETING_DIGEST_KEY`). Digests join by **day**, not `track_token`.

**LIVE-READ blocker:** `buildLeadsDigest()` + docs exist under `/opt/crm-umg/server/lib/leads-digest.js` and `docs/MARKETING-LEADS-DIGEST.md`, and `MARKETING_DIGEST_KEY` is set on `crm-umg.service`, but **`server/index.js` does not register the route**. Probe today: `GET :8787/api/checkout/leads-digest` → **404 `not_found`**. Marketing may still have day digests from an earlier wire-up or offline export — **do not assume the live endpoint works until the route is mounted**.

Digest row shape (from library, LIVE-READ code): email, form_page, attribution fields, cart_contents, quote_number, amount, crm_status, session_id, spam_score/flags, disposable/gibberish — **no track_token field**.

### 6.2 track_token — verified in DB/code (READ-ONLY)

| Question | Answer (LIVE-READ) |
|----------|-------------------|
| Persisted on contact / `leads.json`? | **No.** Lead field union has no `track_token` / track_* key. |
| Written on quote / abandon payloads or UMG store? | **No.** `store.json` contains zero `track_token`. Quotes/abandons store `session_id` + optional `attribution` (sanitizeAttribution). Quotes with attribution today: **1/21**; abandons with attribution: **0/13**; quotes with session_id: **11/21**. |
| Browser issuance? | **Yes.** Insider `POST /api/subscribe` returns `track_token` → `localStorage biolabs_track` (`email-capture.js`). Cart/`checkout-identify` can also write token (`cart-vial.js`). Token = HMAC over email (`CIO_TRACK_TOKEN_SECRET`); used only to authorize `POST /api/track` CIO events. |
| Digests join on track_token? | **No** — by design day filter on quotes/abandons. (Endpoint currently 404 anyway.) |
| Quote/abandon attach attribution how? | Storefront calls `BLRAttribution.read()` when present (`checkout-quote.js` / `checkout-abandon.js`). **Note:** no `attribution.js` file under `/var/www/biofirst/html` today; `BLRAttribution` global not defined in a discoverable storefront JS file — explains sparse attribution on stored rows. |

### 6.3 CIO segments sync — verified

| Item | LIVE-READ |
|------|-----------|
| Scheduled sync | **`MARKETING_SYNC_INTERVAL_MIN=0` → off** (server logs “scheduled sync is off”) |
| Last successful sync stamps | VIP 2026-09-10 · Customers 2026-09-09 · Insiders 2026-09-09 |
| Manual sync | `POST /api/marketing/segments/sync-all` and `/:id/sync` still exist (require CRM auth) |
| Conclusion | Segments **can** sync but are **not auto-syncing**; membership snapshots are ~12 days stale vs audit day |

### 6.4 Unsubscribe honoured on send paths? — verified

| Send path | Honours unsub? | Mechanism |
|-----------|----------------|-----------|
| CRM → CIO campaign trigger (`/api/cio/campaigns/:id/triggers`) | **Yes (local)** | Filters `leads.json` with `!unsubscribed` before trigger; can return `all_recipients_unsubscribed` |
| CRM Newsletter broadcast | **Yes (provider)** | API-triggered CIO broadcast; code explicitly relies on CIO suppression / unsubscribe links (no duplicate suppression list) |
| CRM `POST /api/marketing/people/:email/unsubscribe` | **Yes** | Track API PUT `{unsubscribed:true}` |
| Storefront identify / subscribe | **Does not set unsub** | By design never sends `unsubscribed` on identify (avoids clobbering CIO) |
| Order transactional (`cioSendEmail` manager/customer) | **Partial / CIO-side** | No local leads.json filter before send; depends on CIO transactional + profile suppression |
| Quote admin notify | N/A (to `admin@…`) | Not a marketing send |

**Gap:** CRM `leads.json.unsubscribed` is **not proven webhook-synced** from CIO one-click unsubs; `cio_person_id` empty on all 22 leads weakens CRM-side enforcement for non-trigger sends.

### 6.5 GA4 event names (exact) — post Cookie Accept

Fired only after Accept via `blrTrack` / `cookie-consent.js` (`G-KCMPHP783M`). **LIVE-READ storefront JS** unless noted Marketing-only.

**Custom / product events:**

| Event | When |
|-------|------|
| `inquiry` | Add-to-cart / inquire (`cart-vial.js`, `catalog-pack.js`) |
| `card_sim` | Listed by **Marketing** as GA4 event; **no `card_sim` string in current storefront tree** (may be legacy/removed — treat as Marketing-observed historical) |
| `crypto_select` | Checkout crypto path |
| `checkout_start` | `/checkout` load (also quote mode) |
| `checkout_complete` | Paid complete only — checkout.html comment: **do NOT fire while `PAYMENTS_ENABLED=false`** (local `PAYMENTS_ENABLED=false` mirrors CRM) |
| `generate_lead` | Quote OK (`method: checkout_quote`); Marketing digest label “Quote Request Submitted” |
| `compare_view` | Compare pages |
| `selector_match` / `selector_inquire` | Tools compare selector |
| `view_item` | PDP (`pdp-view-item.js`) |

**Also in GA4 UI (auto / enhanced):** `page_view`, `user_engagement`, `scroll`, `session_start`, `first_visit`, `view_search_results`, `file_download`, `click`, `form_start`.

**`purchase`:** expected **0** until go-live after $10+ tip / payments on (**LIVE-READ · Marketing** + code).

**CIO track events (separate from GA4):** `subscribed`, `cart_updated`, `checkout_started` only.

### 6.6 GA4 snapshot — LIVE-READ · Marketing (property 552249403)

**Sep 15–21:**

| Event / metric | Count |
|----------------|------:|
| page_view | 2235 |
| user_engagement | 2065 |
| inquiry | 207 |
| scroll | 202 |
| checkout_start | 160 |
| session_start | 141 |
| first_visit | 38 |
| view_item | 19 |
| revenue | **$0** |

**Sep 22 digest (Marketing):** ~**132 sessions / 7d**; GSC **1 click / 115 impressions**; CRM leads **Soft-QA-heavy** (aligns with this audit’s QA-named quotes/abandons).

### 6.7 Insider (Marketing + code)

- Code `INSIDER25` hardcoded in `email-capture.js`; signup sends `marketing_consent` + `consent_text`; coupon → `localStorage biolabs_coupon`.
- Redemption / discount validation = **CRM/products-api owns** (`COUPONS.INSIDER25 = 25` in products-api).
- Promo bar UI dead; capture path still live (see retention table).

## 7. Constraints / risks

### Marketing / analytics blockers (fold-in)

1. **Soft-QA noise vs real leads** — CRM quote/abandon books and Marketing digests are Soft-QA-heavy; GA4 `generate_lead` vs CRM quote counts diverge (consent gate + bots + QA). **LIVE-READ · Marketing + CRM.**
2. **GA4 silent until Cookie Accept** — all `blrTrack` / gtag custom events gated; pre-consent traffic invisible in GA4. **LIVE-READ · Marketing + storefront.**
3. **No purchase / LTV in GA4** — revenue $0 Sep 15–21; `purchase`/`checkout_complete` not meaningful while payments off. **LIVE-READ · Marketing.**
4. **`track_token` not in digest join** — token is browser-only; digests (when wired) key by Jerusalem day on quotes/abandons. **LIVE-READ code.**
5. **DMARC biolabsresearch.co still `p=none`** — **LIVE-READ dig.**
6. **`GET /api/checkout/leads-digest` currently 404** — library + docs + key present; route not mounted in `crm-umg` `index.js`. Blocks Marketing’s documented CRM-only digest pull until fixed. **LIVE-READ.**
7. **CIO segment auto-sync off / stale** — last sync ~2026-09-09/10; `MARKETING_SYNC_INTERVAL_MIN=0`. **LIVE-READ.**
8. **Attribution sparse** — `BLRAttribution` referenced but no `attribution.js` in live html tree; 1/21 quotes and 0/13 abandons carry attribution. **LIVE-READ.**

**Rate limits (nginx):** `crm_orders_post` 8r/m; `crm_catalog_write` 30r/m; shop_order / shop_track / shop_identify / bf_api zones on public forms (see `conf.d/*ratelimit*`).

**Secrets locations (names only — values not printed):**

| Name | Location |
|------|----------|
| `ADMIN_SECRET`, `CIO_*`, `CIO_TRACK_TOKEN_SECRET`, `TELEGRAM_TOKEN`, `ORDER_NOTIFY_TO`, `MARKETING_SYNC_INTERVAL_MIN`, … | `/opt/crm-api/.env` |
| `SHEETS_TOKEN` | `/opt/crm-api/sheets-token.env`, cron copies to `/root/sheets-token.env` |
| UMG processor secrets | `UMG_ENV_PATH` → `/root/secure-quarantine-20260917-audit/umg.env` |
| `MARKETING_DIGEST_KEY`, `PAYMENTS_ENABLED`, `STORE_PATH`, `PORT` | **plaintext Environment= lines in** `/etc/systemd/system/crm-umg.service` |
| Sheets OAuth | `sheets-oauth.env` |

**GDPR / PII / backups:**

- PII in leads, orders, abandons, messages, sessions, UMG store.
- Backups: in-process `/opt/crm-api/backups` + cron `/root/backups/crm-data` (14-day retention) + `/root/daily-backup.sh`.
- US processing disclosed (Customer.io) in site privacy HTML.
- DMARC `p=none` is weak for enforcement.
- **Risk:** UMG read/admin routes without app-level auth; digest key in systemd unit file.

**Half-built / duplicated:**

- Two order books (shop `orders.json` vs UMG `store.json`).
- Two segment systems (`segments.json` vs `marketing-segments.json`).
- Promo removed but INSIDER25 still issued.
- Inventory UI without stock data / lots.
- biofirst.co redirect stub on this droplet vs biolabsresearch live storefront.
- crm-api local git has no remote; GitHub `crm-app` exists separately.

**Blockers per retention feature:** summarized in the status table (payments off, digest off, sync off, no account, no BIS, CIO journey ownership, empty stock).

---

## Open questions for the owner

1. Should **PAYMENTS_ENABLED** stay false (quote-only) for the foreseeable future, or is card-on intentionally next?
2. Is the Customer.io **Shop Abandonment** journey started, and does its trigger filter require `cart_item_count > 0` (CRM readiness check exists but not re-verified live)?
3. Should **ABANDON_DIGEST_ENABLED** be turned on, and is `admin@biolabsresearch.co` still the right digest mailbox?
4. Why is **`cio_person_id` empty on all 22 leads** — is CIO identify using email as id only?
5. Should CRM `leads.unsubscribed` be **webhooks-synced** from CIO unsubscribes?
6. Is INSIDER25 still the intentional live coupon after promo-bar kill (17 leads already tagged)?
7. Who owns merging **shop orders.json** vs **UMG quotes/orders** into one customer timeline?
8. Is **stock_qty / lot** going to be populated in catalog, or is Inventory UI non-goals for RUO dropship?
9. Should UMG **GET abandon / store-orders / settings PUT** require CRM session or digest key?
10. Move **MARKETING_DIGEST_KEY** (and other secrets) out of the systemd unit file into a root-only env file?
11. Confirm **DKIM** publishing for CIO/Google on biolabsresearch.co (dig did not return selectors here).
12. Is **biofirst.co** fully cut over to 159.223.116.190 (this host only redirects), and should `/var/www/biofirst` naming be treated as biolabsresearch storefront only?
13. Newsletter subject lines have referenced specific research materials — confirm RUO/stealth naming policy for future sends (this report uses G1-S / G2-T / G3-R for stealth SKUs and avoids INN listing).
14. Target SLA for the **21 Not Contacted quotes** — manual CRM or automated post-quote sequence?

---

15. Who will mount **`GET /api/checkout/leads-digest`** in `crm-umg` `index.js` (docs + key already exist; live 404 today)?
16. Where should **`BLRAttribution` / attribution.js** live so quote/abandon rows carry utm/landing for Marketing digests?
17. Confirm whether GA4 event **`card_sim`** is still intentional (not present in current storefront JS tree).
18. Accept Soft-QA filtering rules (spam_score / disposable flags in leads-digest library) as the source of truth for “real lead” counts vs GA4 `generate_lead`?

---

## Appendix: Indian Soft-QA storefront deltas (READ-ONLY · 2026-09-22)

**Source:** Indian — `/workspace/biolabs-storefront-retention-audit-2026-09-22.md` (LIVE-READ storefront Soft-QA). Folded by CRM for consolidate. No code changes.

| Delta vs CRM main report | LIVE-READ note |
|--------------------------|----------------|
| **INSIDER25 still offered in chat** | promo bar dead + `#insiderClub` markup missing on audited pages; `email-capture.js` still loads; **chat-widget can still offer the code** |
| **notify-order after quote** | Still `POST /api/notify-order` after successful quote (M21 bridge so shop `orders.json` / reorder path may miss pure UMG quotes) |
| **/api/track** | Only after `localStorage.biolabs_track` from subscribe/identify |
| **auth.js** | localStorage stub + Google client ID placeholder; `/account` `/login` `/orders` remain **404** |
| **Cross-sell** | **Live** — cart “Add to this order” + PDP “Pairs well at the bench” (not “does not exist”) |
| **Stock** | Products API stockless; SSR `data-stock="in"` cosmetic only |

Storefront stamp at Indian audit: **v3.00k8c**. Full Indian markdown kept as sibling file on the shared box.

---

## Appendix: LIVE-READ process snapshot

- Host: `134.199.235.122` · audit window ~19:56–20:00 IDT 2026-09-22  
- `pm2`: blitz-api / products-api / shop-chat **online**  
- `crm-umg.service`: **active**, log line `mode=quote`  
- `curl :3001/api/health` → ok version 14.09  
- `curl :8787/api/psp/health` → `paymentsEnabled:false`, `mode:quote`  
- Storefront HEAD `/account|/login|/orders` → **404**  
- No files mutated except this report on the audit box under `/workspace/`.

