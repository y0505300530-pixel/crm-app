# Marketing leads digest (UMG)

Read-only pull for Marketing. No email is sent. Nurture sequences are out of scope.

`GET /api/checkout/leads-digest` was designed against `server/lib/leads-digest.js` and was **not registered** in `server/index.js` (live probe returned 404). This route is the mount.

The library file was present on the host at `/opt/crm-umg/server/lib/leads-digest.js` and was **not in git**. This commit is the canonical copy. Soft-QA flags are computed here and kept on each row (rows are not deleted).

## Auth

Header `X-Marketing-Key` must equal the server env `MARKETING_DIGEST_KEY` (timing-safe compare).

| Case | Status |
|---|---|
| Header missing or wrong, or env unset | **401** `{ "error": "unauthorized" }` |
| Header matches | **200** digest JSON |
| `day` is not `YYYY-MM-DD` | **400** `{ "error": "invalid_day" }` |

A CRM session token does **not** open this route. Operator list/settings routes accept the marketing key **or** a CRM bearer; this digest accepts the marketing key only.

No `Access-Control-Allow-Origin` is emitted. The path is not a storefront beacon.

## Query

`GET /api/checkout/leads-digest?day=YYYY-MM-DD`

- `day` is a calendar day in `Asia/Jerusalem`.
- Omit `day` to use today in Jerusalem.
- Quotes match on `createdAt` (else `updatedAt`).
- Abandons match on `last_seen` (else `seen_at`, else `first_seen`).
- Join key is the day. There is no `track_token` field on the response. Click ids (`gclid`, `fbclid`, `ttclid`, `msclkid`, and the other ids listed in `leads-digest.js`) are replaced with `"[present]"`.

## Row

`email`, `form_page`, `attribution`, `cart_contents`, `quote_number`, `amount`, `crm_status`, `session_id`, `consent_text`, `spam_score`, `disposable`, `gibberish`, `soft_qa`.

| `form_page` | Source |
|---|---|
| `checkout_quote` | quote |
| `checkout_abandon:<stage>` | abandoned checkout |

`counts.real` is rows with `soft_qa: false`. `counts.soft_qa` is the rest. Both are returned; nothing is dropped.

### Soft-QA score

| Signal | Points | `soft_qa` |
|---|---|---|
| Disposable or example domain (`mailinator.com`, `yopmail.com`, `example.com`, `*.test`, and the list in `server/lib/leads-digest.js`) | +50 | yes |
| Local-part `qa` / `test` / `probe` / `soft-qa` / `bot` / `noreply` (including `qa+…`) | +40 | yes |
| Gibberish email local-part (length ≥ 6, vowel ratio &lt; 0.15, or 4+ repeated characters) | +30 | yes |
| Gibberish first+last name, same rule | +20 | only if score ≥ 30 |

## Verification

```bash
# 401 without the key
curl -sS -o /dev/null -w "%{http_code}\n" \
  "http://127.0.0.1:8787/api/checkout/leads-digest?day=2026-09-22"

# 200 with the key (do not print the key)
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "X-Marketing-Key: $MARKETING_DIGEST_KEY" \
  "http://127.0.0.1:8787/api/checkout/leads-digest?day=2026-09-22"
```

## Deploy when `/opt/crm-umg` is not a git checkout

Copy these files, then `sudo systemctl restart crm-umg`. Do not set `PAYMENTS_ENABLED=true`. Do not set `ABANDON_DIGEST_ENABLED`. `MARKETING_DIGEST_KEY` is already on `crm-umg.service` — leave the value in place and do not echo it.

| Copy to `/opt/crm-umg/…` | Why |
|---|---|
| `server/index.js` | mounts the route and the operator gate |
| `server/lib/cors.js` | storefront allowlist (never `*`); digest path excluded |
| `server/lib/operator-auth.js` | marketing key + CRM session check |
| `server/lib/leads-digest.js` | digest + Soft-QA flags |
| `docs/MARKETING-LEADS-DIGEST.md` | this contract |

Before replacing a pre-existing `/opt/crm-umg/server/lib/leads-digest.js`, diff it. The process imports a named ESM export `buildLeadsDigest`. If the live file has extra spam rules, fold those rules into this copy, then copy the merged file. A live file that does not export `buildLeadsDigest` will crash `crm-umg` on boot.
