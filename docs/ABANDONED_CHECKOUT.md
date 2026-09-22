# Abandoned checkout capture (Indian storefront contract)

First-party RUO / Quote lead capture on the CRM sidecar (`/opt/crm-umg` :8787).  
Nginx already proxies `^~ /api/checkout/` — no new location block.

This is **not** a payment. Never send card / PAN / CVV / CVC / expiry / last4 / `paymentMethod` card data.

| Call | When |
|---|---|
| `POST /api/checkout/abandon` | After the shopper email is known; throttle **20–30s**; prefer `navigator.sendBeacon` on hide/unload |
| `GET /api/checkout/abandon` | CRM list (operators). Requires `X-Marketing-Key` or a CRM session bearer. Unauthenticated calls return **401**. |
| `POST /api/checkout/quote` | Final submit in quote mode — include the **same** `session_id` |
| `POST /api/checkout/charge` | Final submit only when `PAYMENTS_ENABLED=true` — include the same `session_id` |

---

## URL

```
POST https://crm.biolabsresearch.co/api/checkout/abandon
Content-Type: application/json
```

CORS is open (`Access-Control-Allow-Origin: *`). `sendBeacon` is supported.

---

## Payload

```json
{
  "session_id": "bl-sess-<stable-browser-id>",
  "stage": "contact",
  "customer": {
    "email": "ada@lab.example",
    "first_name": "Ada",
    "last_name": "Nguyen",
    "phone": "4155550100",
    "address": "1 Research Way",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94107",
    "country": "USA"
  },
  "items": [
    { "sku": "BL-PEP-001", "name": "Research peptide A", "qty": 2, "amount": "79.00" }
  ],
  "subtotal": "158.00",
  "coupon": "RUO10",
  "timestamp": "2026-09-19T12:00:00.000Z"
}
```

Tolerant extras (utm, cart id, money/title/quantity aliases) are ignored if harmless.

**Required to persist:** non-empty `session_id` **and** a sensible email (`customer.email` or top-level `email`).  
Anything else missing → **204 No Content** (silent drop). Bad JSON → **204**. Never throw to the storefront.

**Card fields present** (`card`, `pan`, `cvv`, `cvc`, `expiry`, `last4`, PAN-like `number`, `paymentMethod` with card data) → **400** `{ error: "card_fields_not_accepted" }`. Nothing is written to `store.json`.

---

## Throttle + rate limit

| Layer | Rule |
|---|---|
| Storefront | Send at most once every **20–30 seconds** per session, plus one `sendBeacon` on page hide |
| Sidecar | Soft cap **~30 POST / IP / minute**. Over the cap the sidecar returns **204** (not 429) so beacons stay silent and the UI does not break |

Choice: **204 over 429** for throttle/validation misses. 400 is reserved for card-field rejection.

---

## `session_id` on final submit (conversion link)

Keep one stable id for the browser checkout session. Pass it again on:

```json
{ "session_id": "bl-sess-…", "idempotencyKey": "BL-QUOTE-…", "…": "quote or charge body" }
```

When quote succeeds, or charge/order succeeds (payments on), the matching abandoned row is marked `converted` (not deleted). Quote conversion **UX** on the storefront is out of scope — CRM link only.

---

## Retention + CRM

- Upsert keyed by `session_id` in sidecar `store.json` → `abandoned_checkouts`
- Status: `open` on first persist; later beacons update stage / customer / items / subtotal / `last_seen`
- Max **500** rows; oldest by `last_seen` are dropped
- CRM: React tab **Abandoned checkout**, and drop-in `docs/live-crm/abandoned-checkout.html` for the live HTML CRM

---

## Optional daily digest

Stubbed. Set `ABANDON_DIGEST_ENABLED=true` on `crm-umg` to allow a digest email to `admin@biolabsresearch.co` (same `MAIL_WEBHOOK_URL` / CIO hook as quote mail). Off by default — quote + abandon still persist. Manual trigger: `POST /api/psp/abandoned-digest` (no-ops unless the env flag is on).

---

## Soft-QA probes

Use `qa+<tag>@biolabsresearch.co` so rows are obvious in the CRM tab:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://crm.biolabsresearch.co/api/checkout/abandon \
  -H 'Content-Type: application/json' \
  -d '{
    "session_id":"qa-abandon-001",
    "stage":"contact",
    "customer":{"email":"qa+abandon001@biolabsresearch.co","first_name":"QA","last_name":"Abandon","phone":"4155550199"},
    "items":[{"sku":"BL-QA-001","name":"RUO probe vial","qty":1,"amount":"49.00"}],
    "subtotal":"49.00"
  }'
# expect 204

# list is operator-only (401 without a key or CRM session)
curl -sS -o /dev/null -w "%{http_code}\n" https://crm.biolabsresearch.co/api/checkout/abandon
# expect 401

curl -sS https://crm.biolabsresearch.co/api/checkout/abandon \
  -H "X-Marketing-Key: $MARKETING_DIGEST_KEY" | head
# row visible: QA Abandon / qa+abandon001@…

# then convert via quote (same session_id)
curl -sS -X POST https://crm.biolabsresearch.co/api/checkout/quote \
  -H 'Content-Type: application/json' \
  -d '{
    "session_id":"qa-abandon-001",
    "idempotencyKey":"BL-QUOTE-QA-ABANDON-001",
    "amount":"49.00",
    "customer":{"first_name":"QA","last_name":"Abandon","email":"qa+abandon001@biolabsresearch.co"},
    "items":[{"sku":"BL-QA-001","name":"RUO probe vial","qty":1,"amount":"49.00"}]
  }'
# CRM status → converted
```
