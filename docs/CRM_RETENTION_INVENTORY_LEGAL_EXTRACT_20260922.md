# Legal extract — CRM & Retention Inventory (READ-ONLY)

**Full report (shared box, all agents):** `/workspace/crm-retention-audit-20260922.md`

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


---

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


---

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
