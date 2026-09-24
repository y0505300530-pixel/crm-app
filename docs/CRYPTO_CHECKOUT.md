# Crypto checkout (manual confirm)

Pending USDT orders on the CRM sidecar. v1 is **staff mark-paid** after an on-chain check. There is no chain watcher.

Card `/api/checkout/charge` is unchanged. Crypto works while `PAYMENTS_ENABLED` is off.

Storefront contract: [STOREFRONT_HOOK.md](./STOREFRONT_HOOK.md).

Legal: do not ship before the order is `crypto_paid`. Catalog stays RUO. Wallet private keys never go in git, chat, or API responses.

---

## Env (host only)

Set on `crm-umg.service` or the process environment. Do not commit values.

| Variable | Meaning |
|---|---|
| `CRYPTO_USDT_ERC` | USDT ERC-20 deposit address (`0x` + 40 hex). Returned to the storefront as `wallets.usdtErc20`. |
| `CRYPTO_USDT_TRC` | USDT TRC-20 deposit address (`T` + 33 base58). Returned as `wallets.usdtTrc20`. |
| `CRM_PUBLIC_URL` | Already used by the sidecar. Prefixes `statusUrl`. |

Anything that is not a deposit address (including a 32-byte hex key) is dropped. The API then returns `null` for that network and `walletsReady: false`. The shop must not invent an address.

`GET /api/psp/health` reports `cryptoWallets.erc20` and `cryptoWallets.trc20` as booleans only. It does not echo the addresses.

```ini
# Deposit addresses — set on the host, never in git.
# Environment=CRYPTO_USDT_ERC=
# Environment=CRYPTO_USDT_TRC=
```

---

## Staff

Live CRM page (drop-in, do not replace `store-orders.html`): `docs/live-crm/crypto-orders.html`.

Add one STORE nav row in live `crm.js` (already in this repo’s copy):

```js
{ key: 'crypto-orders', icon: '🪙', label: 'Crypto payments', m: 1 },
```

```bash
sudo cp /opt/crm-umg/docs/live-crm/crypto-orders.html /var/www/mastersol/html/CRM/crypto-orders.html
```

The Vite shell in this repo has the same queue under **Crypto payments**.

List: `GET /api/store-orders?paymentMethod=crypto&q=` (operator).  
Detail includes amount, order ref, customer, line items, created time, and who/when marked paid.

| Action | Effect |
|---|---|
| `POST /api/store-orders/:id/mark-paid` `{ "txHash": "optional" }` | `status` → `crypto_paid`, records `crypto.markedPaidBy` and `crypto.markedPaidAt`. Fulfillment becomes `ready`. **Does not ship.** |
| `POST /api/store-orders/:id/ship` | **409 `ship_blocked`** until `crypto_paid`. After that, sets fulfillment `shipped` with who/when. |

`:id` may be the internal `BLR-…` id or the public `CR-…` order ref. Mark-paid on a card order returns **409 `not_crypto_order`**.

---

## Soft-QA

1. **Create pending** (quote mode, card charge still 503):

```bash
curl -sS -X POST http://127.0.0.1:8787/api/checkout/crypto \
  -H 'Content-Type: application/json' \
  -d '{"idempotencyKey":"BL-CRYPTO-QA-1","amount":"158.00","currency":"USD","customer":{"first_name":"QA","last_name":"Probe","email":"qa+crypto@biolabsresearch.co"},"items":[{"sku":"BL-PEP-001","name":"Research peptide A","qty":1,"amount":"158.00"}]}'
```

Expect `status: "awaiting_crypto"`, an `orderRef` like `CR-XXXXXXXX`, `paymentConfirmed: false`, `analyticsEvent: null`, `fulfillment: "blocked"`. The body must not say payment successful.

2. **Ship blocked** (operator cookie or `X-Marketing-Key`):

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST \
  http://127.0.0.1:8787/api/store-orders/CR-XXXXXXXX/ship \
  -H "X-Marketing-Key: $MARKETING_DIGEST_KEY"
```

Expect `409` and `error: "ship_blocked"`.

3. **Mark paid** (still not shipped):

```bash
curl -sS -X POST http://127.0.0.1:8787/api/store-orders/CR-XXXXXXXX/mark-paid \
  -H "X-Marketing-Key: $MARKETING_DIGEST_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"txHash":""}'
```

Expect `paymentConfirmed: true`, `analyticsEvent: "purchase"`, `fulfillment: "ready"`, and `shippedAt: null`. `GET /api/checkout/crypto/CR-XXXXXXXX` is the storefront poll. Fire GA only when `paymentConfirmed` is true.

4. **Ship after paid** returns `fulfillment: "shipped"`. A second ship is `409 already_shipped`.

5. **Card path:** `POST /api/checkout/charge` with `PAYMENTS_ENABLED` unset still returns `503 payments_disabled` and does not write an order.
