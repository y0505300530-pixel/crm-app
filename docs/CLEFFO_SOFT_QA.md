# Cleffo sandbox Soft-QA (2D + 3DS)

Cleffo is a **parallel sandbox PSP** for Soft-QA screenshots. It does not replace UMG.

- UMG remains the live card processor (`POST /api/checkout/charge` when `PAYMENTS_ENABLED=true`).
- Cleffo is **not** on the storefront checkout cascade, even if someone toggles it in Processors.
- A browser redirect back from Cleffo is **not** payment success. Success is only `completed` from the status poll.
- Catalog copy on the sandbox order is **G3-R** (`g3-r-10mg`) only. No INN names.

Host is locked to `https://apis-dev.cleffo.com`. Any other `CLEFFO_BASE_URL` is refused before a request is sent.

## Env vars (not in git)

Put these in a gitignored env file and source it. Do not commit values.

| Name | Purpose |
| --- | --- |
| `CLEFFO_BASE_URL` | `https://apis-dev.cleffo.com` |
| `CLEFFO_CLIENT_KEY` | Body field `cleffo_client_key` |
| `CLEFFO_SIGNATURE_KEY` | HMAC-SHA256 key over the exact JSON body bytes |
| `CLEFFO_API_KEY` | Header `x-api-key` |
| `CLEFFO_REDIRECT_URL` | Optional https landing URL. Not a success signal. |

```bash
set -a
source /path/to/cleffo.env
set +a
```

## Create the $10 sandbox link

```bash
npm run cleffo:soft-qa
```

Stdout prints only:

- `payment_link`
- `transaction_reference_number`
- `merchant_order_id`
- `payment_source` (`api` on a confirmed 200)

It does not print `CLEFFO_CLIENT_KEY`, `CLEFFO_SIGNATURE_KEY`, or `CLEFFO_API_KEY`.

The signed body is the live validation shape. `$10` G3-R (`product_id` `g3-r-10mg`) sits on `data.products`. Phone is digits-only `data.customer_detail.phone_no` (`12025550100`). Amounts are `data.price.sub_total` / `tax` / `total` / `currency` (`10.00` + `0.00` = `10.00`, `USD`). `redirect_url` is inside `metadata` (with `source: "api"`). `cleffo_client_key` is sent in `metadata` and at the top level. Product image field is not fully confirmed, so each line sends both `image_url` and `image` as the same public HTTPS URL.

Operator HTTP (same $10 order, same host lock), with the CRM session or `X-Marketing-Key`:

```bash
curl -sS -X POST https://crm.biolabsresearch.co/api/psp/cleffo/sandbox/payment-link \
  -H "Authorization: Bearer <crm-session>" \
  -H "Content-Type: application/json" \
  -d '{"merchant_order_id":"CLEFFO-QA-2D"}'
```

Card fields are rejected. This route does not call UMG.

## Screenshots for Bryan

Public Cleffo docs do **not** separate 2D and 3DS test cards. Use the scenarios Bryan sends. Do not guess PANs.

1. Run `npm run cleffo:soft-qa` and open `payment_link`.
2. Complete **Bryan's 2D** Stripe sandbox scenario. Screenshot the successful Stripe sandbox page.
3. Poll status. `completed` is the success signal. The redirect page is not.

```bash
npm run cleffo:soft-qa -- --status <transaction_reference_number>
```

Documented statuses: `pending` | `completed` | `failed`.

4. Run `npm run cleffo:soft-qa` again (new order id). Complete **Bryan's 3DS** scenario. Screenshot that successful Stripe sandbox page.
5. Poll that new reference until `completed`.
6. Send Bryan both screenshots plus the two transaction references. Do not send API keys.

`--poll` repeats the status call after create (about every 5s, up to 6 times). Prefer `--status` after you finish the card step so the reference you screenshot matches the poll.

`GET /api/psp/cleffo/sandbox/return` always returns `success: false`, including when the query string says `status=completed`.

## Request / response (dev)

`POST /api/payment-link`

- Headers: `Content-Type: application/json`, `x-api-key`, `x-signature`
- `x-signature` is HMAC-SHA256 **hex** of the exact JSON body bytes, using `CLEFFO_SIGNATURE_KEY`
- Live 400 required shape:

```json
{
  "data": {
    "merchant_order_id": "CLEFFO-QA-1",
    "customer_detail": { "name": "Soft QA", "email": "soft-qa@biolabsresearch.co", "phone_no": "12025550100" },
    "products": [{
      "product_id": "g3-r-10mg",
      "name": "G3-R",
      "qty": 1,
      "price": 10.00,
      "image_url": "https://biolabsresearch.co/media/vial-g3-r.png",
      "image": "https://biolabsresearch.co/media/vial-g3-r.png"
    }],
    "price": { "sub_total": 10.00, "tax": 0.00, "total": 10.00, "currency": "USD" }
  },
  "metadata": {
    "redirect_url": "https://crm.biolabsresearch.co/api/psp/cleffo/sandbox/return",
    "source": "api",
    "cleffo_client_key": "<CLEFFO_CLIENT_KEY>"
  },
  "cleffo_client_key": "<CLEFFO_CLIENT_KEY>"
}
```

`redirect_url` is only under `metadata`. `image_url` and `image` are both sent until Cleffo confirms the image field name. The value `<CLEFFO_CLIENT_KEY>` is the env var, not a key.

- Confirmed 200 `data`: `payment_link`, `transaction_reference_number`, `merchant_order_id`, `payment_source=api`

`GET /api/payment-link/{transaction_reference_number}/status`

- Header: `x-api-key` only
- Status: `pending` | `completed` | `failed`
