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

The signed body is a $10 G3-R line (`product_id` `g3-r-10mg`, qty 1, price 10.00), tax 0.00, total 10.00, phone digits `12025550100` (plus-formatted phones are stripped and never sent), `metadata.source` `api`.

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
- Confirmed 200 `data`: `payment_link`, `transaction_reference_number`, `merchant_order_id`, `payment_source=api`

`GET /api/payment-link/{transaction_reference_number}/status`

- Header: `x-api-key` only
- Status: `pending` | `completed` | `failed`
