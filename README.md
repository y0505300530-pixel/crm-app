# crm-app

BioLabs Research CRM. Card checkout stays on UMG. Cleffo is a separate **sandbox** payment-link adapter for Soft-QA only.

## Cleffo Soft-QA (2D / 3DS screenshots)

Do not put keys in git. Source a gitignored env file with:

- `CLEFFO_BASE_URL` = `https://apis-dev.cleffo.com`
- `CLEFFO_CLIENT_KEY`
- `CLEFFO_SIGNATURE_KEY`
- `CLEFFO_API_KEY`

```bash
set -a && source /path/to/cleffo.env && set +a
npm run cleffo:soft-qa
```

The script prints `payment_link` and `transaction_reference_number` only (plus merchant order id and `payment_source`). It does not print secrets. The signed body matches the live 400 shape: `data.merchant_order_id`, `data.customer_detail.phone_no` (digits), `data.products`, `data.price.sub_total` / `tax` / `total` / `currency`, and `metadata.redirect_url` with `metadata.source=api`. `cleffo_client_key` is in metadata and at the top level. Each product sends `image_url` and `image` until Cleffo confirms the image field.

1. Open `payment_link` and complete **Bryan's 2D** Stripe sandbox scenario. Screenshot the success page.
2. Poll. Redirect is not success.

```bash
npm run cleffo:soft-qa -- --status <transaction_reference_number>
```

`completed` is success. Documented statuses: `pending` | `completed` | `failed`.

3. Run `npm run cleffo:soft-qa` again and repeat with **Bryan's 3DS** scenario. Screenshot that success page and poll the new reference until `completed`.

Public docs do not separate 2D vs 3DS test cards. Use Bryan's scenarios. Catalog line is G3-R (`g3-r-10mg`), $10. Cleffo is not storefront checkout and does not charge UMG.

Full notes: [docs/CLEFFO_SOFT_QA.md](docs/CLEFFO_SOFT_QA.md).
