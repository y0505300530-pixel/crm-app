# Storefront hook — crypto checkout (Indian)

CRM sidecar only. Do **not** change `biolabsresearch-co` in the CRM pull request. Hook the shop to this contract when STEP 3 crypto is ready.

Production base: `https://crm.biolabsresearch.co`  
Nginx already proxies `^~ /api/checkout/` to the sidecar (`:8787`). No new location block.

Card `/api/checkout/charge` is unchanged and stays gated by `PAYMENTS_ENABLED` (default off → HTTP 503). Crypto does **not** use that flag.

RUO catalog only. Never send card / PAN / CVV. A `card` object returns **400** `card_not_accepted`.

---

## Create a pending order

`POST /api/checkout/crypto`  
`Content-Type: application/json`

```json
{
  "idempotencyKey": "BL-CRYPTO-<cart-or-session-id>",
  "amount": "158.00",
  "currency": "USD",
  "network": "trc20",
  "session_id": "bl-sess-<same-id-as-abandon-beacon>",
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
  ]
}
```

`currency` is `USD` or `USDT`. The CRM does **not** convert FX. `amount` / `amountDue` is the exact figure the shop already quoted. The customer sends that many **USDT**. `network` is optional: `erc20` or `trc20`.

Same `idempotencyKey` returns the same `orderRef` (`reused: true`).

### 200 response

```json
{
  "ok": true,
  "reused": false,
  "orderId": "BLR-1001",
  "orderRef": "CR-AB12CD34",
  "status": "awaiting_crypto",
  "amount": "158.00",
  "currency": "USD",
  "amountDue": "158.00",
  "payAsset": "USDT",
  "network": "trc20",
  "paymentConfirmed": false,
  "analyticsEvent": null,
  "fulfillment": "blocked",
  "shippable": false,
  "wallets": {
    "usdtErc20": null,
    "usdtTrc20": null
  },
  "walletsReady": false,
  "statusUrl": "https://crm.biolabsresearch.co/api/checkout/crypto/CR-AB12CD34",
  "createdAt": "2026-09-24T06:00:00.000Z",
  "paidAt": null,
  "message": "Awaiting crypto confirmation. Send the exact USDT amount and put the order reference in the transfer memo. This is not a completed payment. Do not record a purchase."
}
```

`wallets.usdtErc20` / `wallets.usdtTrc20` are filled only from host env `CRYPTO_USDT_ERC` and `CRYPTO_USDT_TRC`. If a value is missing or is not a deposit address, the field is `null`. **Do not fall back to an address baked into the shop.** If `walletsReady` is false, show a staff-contact state instead of a pay screen.

Show Copy/QR for the network the customer picked. Tell them to put **`orderRef`** in the transfer memo. Amount on the wire is **`amountDue` USDT**, exact.

### Do not fire GA

While `paymentConfirmed` is `false` and `analyticsEvent` is `null`, this is **not** a purchase. Do not show “payment successful”. Do not send a GA `purchase` event.

---

## Poll

`GET /api/checkout/crypto/{orderRef}`

Same public shape as the create body (`reused` omitted). Poll until:

| Field | Meaning |
|---|---|
| `status: "awaiting_crypto"` | Still unpaid. Keep the pay screen. |
| `status: "crypto_paid"` and `paymentConfirmed: true` and `analyticsEvent: "purchase"` | Staff confirmed the transfer. **Only then** show paid and fire GA `purchase`. |
| `fulfillment` | `blocked` until paid, then `ready` (not shipped), then `shipped` after a separate staff action. |
| `shippable` | `true` only when paid and not yet shipped. The shop must not create a shipment. |

Unknown ref → **404** `{ "ok": false, "error": "not_found" }`.

The poll body does not include the customer record.

---

## Errors

| HTTP | `error` | When |
|---|---|---|
| 400 | `card_not_accepted` | Any card / PAN / CVV field |
| 400 | `idempotency_key_required` / `invalid_amount` / `invalid_currency` / `invalid_email` / `email_required` / `name_required` / `items_required` | Bad checkout body |
| 429 | `rate_limited` | Too many creates from one IP |
| 503 | — | Not used for crypto. Charge still returns `payments_disabled` when card capture is off. |
