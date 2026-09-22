# BioLabs Research — Storefront CRM & Retention Inventory (READ-ONLY)

**Site:** https://biolabsresearch.co  
**Audit date:** 2026-09-22 (Asia/Jerusalem / IDT)  
**Storefront version (LIVE-read):** `version.json` → **3.00k8c** (`cart-badge-always-visible`)  
**Method:** Live HTTPS GET/HEAD/OPTIONS + public HTML/JS review. **No lead/order POSTs. No CRM writes. No Soft-QA form submits.**  
**Count labels:** **LIVE-read** = observed on wire/source; **estimate** = inferred.  
**SKU policy:** G-series only as **G1-S / G2-T / G3-R** (live API: slugs `g1-s`/`g2-t`/`g3-r`, names `G1-S`/`G2-T`/`G3-R`).

---

## 1. One-page storefront summary

| Area | Status | LIVE-read notes |
|------|--------|-----------------|
| Quote checkout | **LIVE** | `/checkout` **200**; `PAYMENTS_ENABLED = false`; CTA **Continue request** / **Request a Quote** |
| Card/crypto charge | **DEAD (retained JS)** | `checkout-charge.js` present; not invoked while payments off |
| CRM quote | **LIVE (client)** | `POST https://crm.biolabsresearch.co/api/checkout/quote` (OPTIONS **204**) |
| CRM abandon | **LIVE (client)** | `POST …/abandon`; **email required**; blur / shipping focus / pagehide |
| CRM charge | **UNUSED path** | `POST …/charge` coded; dormant |
| Insider + INSIDER25 | **PARTIAL** | Subscribe JS + chat offer exist; **promo bar removed (2026-09-15)**; `#insiderClub` markup **missing** → form UI dead on audited pages; chat can still offer |
| Cart → `/api/track` | **PARTIAL** | Fires only after `localStorage.biolabs_track` from subscribe/identify |
| Notify mirror | **LIVE (client)** | `POST /api/notify-order` after quote (bridge comment: CRM order list / reorder may miss quotes until M21) |
| Account / login / orders / reorder | **MISSING** | All **404**; `auth.js` localStorage stub + placeholder Google client ID |
| Stock / BIS / notify-me | **MISSING** | `/api/products` has **no stock fields**; SSR `data-stock="in"` only |
| VIP / loyalty | **MISSING** | No UI; probe scripts 404 |
| Cross-sell | **EXISTS** | Cart “Add to this order” (incl. AOD-9604); PDP “Pairs well at the bench”; qty pack upsell |
| Promo bar | **DEAD** | `promo-bar.js` removes `#promoStack` |
| Client segment tags | **MISSING** | Not in products JSON |
| Analytics | **EXISTS** | GA4 `G-KCMPHP783M` (consent); checkout custom events; PDP `view_item` |

**CRM merge takeaway:** Quote-primary storefront. Still-firing retention/CRM hooks: **abandon + quote + notify-order + optional subscribe/track**. Insider **code remains** but **top-of-funnel insider UI is mostly dismantled**. Account/reorder/loyalty/stock-notify are **not live**.

---

## 2. Retention feature table

| # | Feature | Status | Where | Blocks / gaps |
|---|---------|--------|-------|---------------|
| 1 | Insider email + INSIDER25 | **partial** | `email-capture.js` (`CODE="INSIDER25"`); `chat-widget.js`; checkout coupon + `/api/coupon-quote`; `promo-bar.js` kills ticker | No `#insiderClub` markup on home/checkout/PDP/science (script only on PDP/science). Promo removed. Server still honors INSIDER25? **unverified** (no POST) |
| 2 | Abandoned checkout | **exists** | `/checkout` + `checkout-abandon.js` → CRM `/api/checkout/abandon` | Email-gated; 25s throttle; stages contact→shipping; never sends card fields |
| 3 | Post-quote follow-up (client) | **partial** | Quote OK → `generate_lead` + `recordQuoteInCrm` → `/api/notify-order`; abandon `stop()` | Comment 2026-09-22: quote may not hit CRM orders/reorder until module forwards. **No** client post-success drip/upsell |
| 4 | Reorder / buy again | **missing** | — | No orders UI; `reorder.js` 404 |
| 5 | Cross-sell | **exists** (pre-checkout) | `cart-vial.js` CART_SUGGEST; `product-marquee.js`; `qty-upsell.js` | Not on success page; BAC solvent gift **killed** (`__blrKillBacGift239`) |
| 6 | Promo / offers bar | **dead** | `promo-bar.js` | Stub kept for cache safety |
| 7 | VIP / loyalty | **missing** | — | — |
| 8 | `/account` `/login` `/orders` | **missing (404)** | LIVE HEAD/GET 404 | No CRM account deep links |
| 9 | Stock / low / BIS / notify-me | **missing** | products API stockless; search looks for absent `stock_status` | Marquee refuses invented stock |
| 10 | Segmentation tags (client) | **missing** | category/tagline only | — |

---

## 3. Endpoint inventory (what the SITE calls)

| Path | Method | Auth | Writes? | Body fields (from JS) | Source |
|------|--------|------|---------|----------------------|--------|
| `https://crm.biolabsresearch.co/api/checkout/abandon` | POST / beacon | none; `credentials:'omit'` | **YES** | `session_id`, `stage`, `customer{first_name,last_name,email,phone,address,city,state,zip,country}`, `items[{sku,name,qty,amount}]`, `subtotal`, `timestamp`, optional `coupon`, `attribution` | `checkout-abandon.js` |
| `https://crm.biolabsresearch.co/api/checkout/quote` | POST | none; omit creds | **YES** | `idempotencyKey` (`BL-QUOTE-…`), `amount`, `currency:'USD'`, `customer{…}`, `items[]`, optional `notes`, `session_id`, `attribution` | `checkout-quote.js` |
| `https://crm.biolabsresearch.co/api/checkout/charge` | POST | none | **YES (dormant)** | `idempotencyKey`, card block, customer, items, `session_id`, … | `checkout-charge.js` — unused while payments off |
| `/api/subscribe` | POST | none | **YES** | `email`, `firstName`, `coupon:"INSIDER25"`, `page`, `marketing_consent`, `consent_text` → may return `track_token` | `email-capture.js`, `chat-widget.js` |
| `/api/track` | POST | token in JSON | **YES** | `{ token, event, data }` events: `cart_updated`, `checkout_started` | `cart-vial.js` |
| `/api/checkout-identify` | POST | none | **YES** | `{ email, page, firstName? }` → `track_token` | `cart-vial.js` |
| `/api/coupon-quote` | POST | none | pricing read | `{ coupon, items[], shippingCost }` | `cart-vial.js` |
| `/api/notify-order` | POST | none; attribution inject | **YES** | `{ subject, body, orderData, paymentMethod }` (`quote` on quote path) | `checkout.html` + `attribution.js` |
| `/api/products` | GET | none (GET 200) | no | 20 SKUs; **no stock keys** | catalog/cart/search/marquee/upsell |
| `/api/chat/` | * | `X-Chat-Preview` / `X-Chat-Token` | chat | Separate from subscribe | `chat-widget.js` |
| `/api/site-copy` | GET | none | no | Copy blocks | `site-copy.js` |

**No storefront Bearer/API keys for CRM (LIVE-read).**

---

## 4. Exact event names

### GA4 via `blrTrack` / `blrTrackCheckout` (after cookie Accept)

| Event | Trigger |
|-------|---------|
| `checkout_start` | Checkout page load |
| `crypto_select` | Crypto UI (retained; payments off) |
| `generate_lead` | Quote success (`method: 'checkout_quote'`) |
| `checkout_complete` | Payment success path only — **not expected** while payments off |
| `view_item` | PDP (`pdp-view-item.js`) |

**GA ID:** `G-KCMPHP783M` (`cookie-consent.js`).

### `/api/track` (needs `localStorage.biolabs_track`)

| Event | Trigger |
|-------|---------|
| `cart_updated` | Cart hash change (5s debounce); empty cart edge case |
| `checkout_started` | On `/checkout` with token; ≤1 / 30 min |

### `track_token`

- Written by `/api/subscribe` and `/api/checkout-identify` → `biolabs_track`  
- Related: `biolabs_track_h`, `biolabs_track_co`, `biolabs_track_ce`  
- Coupon: `biolabs_coupon=INSIDER25` after subscribe  
- Attribution: `blr_attribution` on abandon/quote/notify-order  

---

## 5. Quote-only state (LIVE-read)

- `PAYMENTS_ENABLED = false`  
- Submit → quote module; success: “We'll send your quote within one business day.”  
- CTAs: **Continue request** (cart), **Request a Quote** (checkout submit)  
- Card/crypto UI retained but not used by primary submit path  

---

## 6. Dead / half-built

- Promo ticker (actively removed)  
- Insider form markup missing while `email-capture.js` still loads on PDP/science  
- Charge module loaded, unused  
- `auth.js` placeholder Google ID; localStorage “users/orders”  
- `/account` `/login` `/orders` 404  
- Probe scripts `insider.js` `loyalty.js` `vip.js` `reorder.js` `account.js` → 404  
- BAC gift logic present but force-stripped  
- Search stock labels unused (no `stock_status` in API)  
- robots.txt internal comments (Yehuda/Marketing lock, IndexNow script name) — **public ops disclosure**  

---

## 7. Live curl spot-checks

| Check | Result |
|-------|--------|
| GET `/version.json` | 200 / **3.00k8c** |
| `/account` `/login` `/orders` | **404** |
| `/checkout` | **200** |
| GET `/api/products` | **200**, 20 items, stockless |
| CRM abandon/quote/charge OPTIONS | **204** |
| robots.txt | AI bots allowed; `/api/` disallowed except `/api/products`; Host `biolabsresearch.co` |
| CSP | `'self'` + GTM; `connect-src 'self' https:`; `frame-src` + `base44.app`; HSTS preload |

---

## 8. Open questions (CRM / owner)

1. Is **INSIDER25** still valid server-side in `/api/coupon-quote` / CRM coupon table?  
2. Has CRM **quote→orders/email/reorder** forwarding (M21) shipped, or is `/api/notify-order` still required?  
3. Insider: restore HTML club, chat-only, or kill subscribe paths?  
4. Confirm Customer.io (or peer) still consumes `cart_updated` / `checkout_started` via `track_token`.  
5. Real stock on `/api/products` planned, or permanent SSR `data-stock="in"`?  
6. Remove or finish `auth.js` / account routes?  
7. Keep dormant **charge** client for reactivation vs delete for PCI surface?  
8. Sanitize **robots.txt** comments / IndexNow hints?

---

## 9. Evidence

Assets mirrored under `/workspace/blr-storefront-audit-200308` (home/checkout HTML, cart-vial.js v321, abandon/quote/charge, email-capture, chat-widget, promo-bar, cookie-consent, products.json, version.json, robots.txt).  

**Out of scope:** Soft-QA writes; POST subscribe/abandon/quote/charge; CRM admin UI verification.

---

*Storefront-side inventory for paste into ALL BIOLAB CRM merge.*
