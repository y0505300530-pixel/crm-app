# Quote mode (storefront checkout)

Locked SoT for **biolabsresearch.co** while card capture is off.  
UMG `/api/checkout/charge` stays in the sidecar. It is **not** deleted. It is gated.

Production sidecar: `/opt/crm-umg` on `:8787`. Nginx already proxies `/api/checkout/` — no nginx change for `/api/checkout/quote`.

| Mode | `PAYMENTS_ENABLED` | Public checkout |
|---|---|---|
| **quote** (default) | unset / `false` / `0` | `POST /api/checkout/quote` — inquiry only |
| **pay** | `true` / `1` / `yes` | `POST /api/checkout/charge` — UMG cascade |

Health: `GET /api/psp/health` includes `paymentsEnabled: boolean` and `mode: "quote"|"pay"`.

Copy must stay RUO / inquiry-safe. Never return “payment successful” from quote mode.

---

## Storefront payload (Indian) — SoT

`POST https://crm.biolabsresearch.co/api/checkout/quote`  
`Content-Type: application/json`

Do **not** send card / PAN / CVV. Quote rejects a `card` object with HTTP 400 `card_not_accepted`.

```json
{
  "idempotencyKey": "BL-QUOTE-<cart-or-session-id>",
  "amount": "158.00",
  "currency": "USD",
  "customer": {
    "first_name": "Ada",
    "last_name": "Nguyen",
    "email": "ada@lab.example",
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
  "notes": "optional",
  "session_id": "bl-sess-<same-id-as-abandon-beacon>"
}
```

Aliases accepted: `firstName` / `lastName`, `quantity` on items, `extOrderId` as idempotency key.  
Optional `session_id` links a prior abandoned-checkout beacon (CRM conversion only — see [ABANDONED_CHECKOUT.md](./ABANDONED_CHECKOUT.md)). Quote UX is unchanged.

**Success (200)**

```json
{
  "ok": true,
  "quoteId": "QT-5001",
  "message": "We'll send your quote within one business day."
}
```

CRM persists a lead/quote (`status: quote_requested`, `crmStatus: Not Contacted`) with contact, line items, qty, amount, and `idempotencyKey`. Same key returns the same `quoteId` (no second email).

**Charge while quote mode is on (503)** — UMG is not called:

```json
{ "ok": false, "error": "payments_disabled", "mode": "quote" }
```

---

## Flip back to pay later

On the live host, edit `/etc/systemd/system/crm-umg.service` and add or change:

```ini
Environment=PAYMENTS_ENABLED=true
```

Default is **false** if the variable is missing. After the flip:

```bash
sudo systemctl daemon-reload
sudo systemctl restart crm-umg
curl -sS http://127.0.0.1:8787/api/psp/health
# paymentsEnabled: true, mode: "pay"
```

Until that env is `true`, storefront must call **`/api/checkout/quote`**, not charge.

---

## Admin email hook

There is no SMTP library in this repo and **no secrets in git**.

On a successful new quote the sidecar calls `sendQuoteNotification` → `admin@biolabsresearch.co` with a text summary (quote id, contact, items, amount). Configure **one** of:

| Env | Purpose |
|---|---|
| `MAIL_WEBHOOK_URL` | POST JSON `{to,subject,text,transactional}` |
| `MAIL_WEBHOOK_TOKEN` | Optional `Authorization: Bearer …` |
| `CIO_TRANSACTIONAL_URL` | Customer.io / CIO transactional endpoint (same POST body) |
| `CIO_API_KEY` | Optional bearer for CIO |

If none are set, the quote **still persists**; email is recorded as `transport: "none"` / `emailSent: false`. Do not log tokens, `Authorization`, or PAN.
