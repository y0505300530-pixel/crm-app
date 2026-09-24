# Daily Operations — 2026-09-24

## 1. Reporting window
- Start (UTC): 2026-09-23 20:00:00
- End (UTC): 2026-09-24 20:00:00
- Generated (UTC): 2026-09-24 ~20:05
- Timezone: UTC
- Jerusalem equivalents: 2026-09-23 23:00 IDT → 2026-09-24 23:00 IDT (generation ~23:05 IDT)

Read-only audit. No production behavior changed to prepare this document.

## 2. Executive summary
Within the window BioLabs shipped CRM Inventory Intake to production (movement ledger, three POs, on-hand 400), merged crypto pending-checkout into `crm-app`, answered Rapid Fulfillment (ASH) onboarding, and launched Laura’s 99-site RUO directory wave. Storefront customer stamp remained **3.00k8i** (no new tip in-window). Live payments flag verified `PAYMENTS_ENABLED=true` (not quote-only).

## 3. Website work
| Item | Status | Notes |
|------|--------|-------|
| Live stamp `3.00k8i` | LIVE (prior window) | `version.json` verified 2026-09-24; tip commit `e879791b` / PR #61 merged 2026-09-23 09:03 UTC — **outside** this window |
| Infra QA_TASKS note (Tagada/P26) | COMPLETED | `0fa55038` 2026-09-24 16:41 UTC — docs/tasks only, not a customer tip |
| BAC not gift/catalog | LIVE (intentional) | Confirmed by storefront owner; no change this window |
| New customer-facing tip | — | None in window |

## 4. CRM work
| Item | Status | Evidence |
|------|--------|----------|
| Inventory Intake schema + seed + admin API | LIVE | `crm-app` `073ed985` (PR #12) 2026-09-24 17:14 UTC; sidecar `/opt/crm-umg`; CRM Soft-QA PASS (not formal ELITE) |
| Legacy admin page Store → Inventory Intake | LIVE | HTML/nginx live in window (mtime 17:23 UTC); mastersol git `a9464d0` committer **2026-09-24 20:01:24Z** (~84s after window end — document as edge / next-window git stamp); URL `/crm/inventory-intake.html`; nginx `^~ /api/inventory` → `:8787` |
| Crypto awaiting_crypto + mark-paid + ship gate | MERGED → deploy present | PR #11 `254a22f9` 2026-09-24 06:56 UTC; `crypto-checkout.js` on `/opt/crm-umg`; storefront STEP 3 tip still waiting wallets env |
| Catalog Products `stock_qty` | LIVE unchanged | Soft-QA: Products In Stock 0; movement on-hand separate |

## 5. Inventory and purchase orders
| PO | Status | Movements | Notes |
|----|--------|-----------|-------|
| #071326 | RECEIVED (LIVE) | 5 PO_INTAKE | On-hand: G3-R-10 100, G3-R-20 50, TES-10 100, WOL-10 100, GLOW 50 = **400** |
| #PVC-092326 | PAID_IN_TRANSIT | 0 | 28 lines booked; aliases on PO only; no new SKUs; BAC Water line quarantined (no sale SKU) |
| #081226 | PAID_IN_TRANSIT | 0 | NAD+ 500mg ×30 lines only; internal SKU pending mapping |
| Mark Received UI | LIVE (unused) | — | Visible for in-transit POs; Soft-QA did not click |
| Storefront qty reflection | — | — | Intentionally none |

## 6. Payment work
| Item | Status | Verification |
|------|--------|--------------|
| `PAYMENTS_ENABLED=true` | LIVE | systemd Environment + `GET /api/psp/health` → `paymentsEnabled:true`, `mode:"pay"`, `dryRun:false` |
| UMG card path | LIVE (ops flag on) | Service active; historical descriptor issue **PEPTIDESS SHOP** still referenced in adapter mocks/notes — Rhina change still open |
| Crypto wallets env | BLOCKED | Storefront tip waits CRM LIVE + wallet env (owner: CRM / Yehuda) |
| Cleffo / PSP2 | IN PROGRESS | Sandbox Soft-QA prior window; in-window: setup-fee negotiation with Bryan (USDT vs bank/Wise). Open CRM PR #10. Live keys server copy still needs Yehuda approval |
| Quote-only claim | INVALID | Must not be used; live flag is payments enabled |

## 7. ASH / Rapid Fulfillment
| Item | Status | Evidence |
|------|--------|----------|
| Denise questionnaire answered | COMPLETED | Gmail 2026-09-24 17:48 UTC `Re: Leed Marketing Group - Integration GNT` from admin@ → denise@rapidfulfillment.com |
| Packing slip RUO line + support email | COMPLETED | In reply (no phone on slip) |
| API docs request (orders/stock/tracking/returns/webhooks) | IN PROGRESS | Requested; awaiting Rapid docs |
| Return-to-sender address | BLOCKED | Explicitly “to be confirmed” |
| Go-live target | PLANNED | November 2026 (firm date after API review) |
| Catalog SKU list for packing slips | COMPLETED | Sent display catalog; injection mapping deferred |

## 8. Retention / customer ops
| Item | Status |
|------|--------|
| Abandoned-checkout CRM API/UI | LIVE (prior; no new tip this window) |
| INSIDER25 / Part G stock alerts / digests | LOCKED / intentional hold |
| New retention ship this window | None verified |

## 9. SEO / external growth
| Item | Status | Evidence |
|------|--------|----------|
| Laura 99-site directory CSV + RUO paste | COMPLETED | Email 2026-09-24 07:17 UTC payments@ → noreply@ (cc admin@) |
| Legal correction (skip Reddit/forums/competitors) | COMPLETED | Same thread follow-up 07:17 UTC |
| Public live verified directory links | 0 | Soft-QA earlier: submitted ≠ live |
| Prior weak daily digest (site-only) | COMPLETED | Marketing sent 2026-09-24 16:17 UTC — superseded by this ops audit |

## 10. Legal and Soft-QA
| Item | Status |
|------|--------|
| Legal PASS Inventory Intake as CRM-internal only | COMPLETED (ALL BIOLAB) |
| Gates: supplier/INN names PO-only; BAC quarantine; mapping before new SKUs | LOCKED |
| CRM Soft-QA Inventory Intake numbers | PASS (CRM BIOLAB) — on-hand 400 / 3 POs / Mark Received not clicked |
| ELITE formal Soft-QA lock | IN PROGRESS — waiting CRM login from 1:1 |

## 11. Deployments and production checks
- crm-app inventory + crypto code present under `/opt/crm-umg`; `crm-umg` **active**
- nginx inventory API proxy inserted
- Soft-QA screenshots: `/workspace/inventory-intake-qa.png`, `/workspace/inventory-products-banner-qa.png`
- Storefront `https://biolabsresearch.co/version.json` → 3.00k8i

## 12. Open blockers
1. PVC + NAD-500 internal SKU mapping — owner Yehuda / Marketing
2. Crypto wallet env + Indian STEP 3 tip — owner CRM / Yehuda
3. UMG statement descriptor PEPTIDESS → BioLabs Research — owner Rhina / Yehuda
4. Rapid return-to-sender address + API docs — owner Yehuda / Rapid
5. Cleffo live keys server copy — owner Yehuda
6. ELITE formal Soft-QA lock — owner ELITE (CRM login)

## 13. Decisions required from management
1. Approve PVC / NAD-500 internal SKU mapping list (or revise).
2. Provide crypto wallet addresses via secure channel (not chat).
3. Confirm return-to-sender address for Rapid.
4. Approve Cleffo live-key placement in secure quarantine.
5. Push Rhina on descriptor rename.

## 14. Evidence table

| Area | Work completed | Status | Repository | Commit/PR | File or screen | Verification |
|------|----------------|--------|------------|-----------|----------------|--------------|
| CRM Inventory | Movement ledger + 3 POs + on-hand 400 | LIVE | crm-app | `073ed985` / PR #12 | `/api/inventory`, Soft-QA UI | Soft-QA PASS; inventory.json 5 movements |
| CRM HTML admin | Inventory Intake page + nav | LIVE | mastersol (local) | `a9464d0` | `/crm/inventory-intake.html` | Soft-QA PASS |
| CRM nginx | Proxy `/api/inventory` → 8787 | LIVE | server config | — | nginx site crm-biolabsresearch | curl 401 (auth required) |
| CRM Crypto | awaiting_crypto + mark-paid + ship gate | MERGED / deployed code | crm-app | `254a22f9` / PR #11 | `server/lib/crypto-checkout.js` | File present; wallets still BLOCKED |
| Storefront | Live stamp unchanged | LIVE (prior) | biolabsresearch-co | `e879791b` / PR #61 | version.json 3.00k8i | Public fetch 2026-09-24 |
| Storefront | QA_TASKS infra note | COMPLETED | biolabsresearch-co | `0fa55038` | QA_TASKS | Commit in window |
| Payments | PAYMENTS_ENABLED | LIVE | crm-umg service | — | systemd Environment | Read true |
| ASH | Onboarding answers + API ask | COMPLETED | Gmail | — | thread 1a0d48901b3d1ba9 | Sent 2026-09-24 17:48 UTC |
| SEO | Laura 99-site wave + Legal skip list | COMPLETED | Gmail | — | Laura thread | Sent 2026-09-24 07:17 UTC |
| Legal | Inventory CRM-only PASS | COMPLETED | ALL BIOLAB | — | room | 2026-09-24 |



## Audit source
Independent READ-ONLY executor pack completed ~2026-09-24 20:05 UTC; facts above reconciled to that pack (no production changes).
