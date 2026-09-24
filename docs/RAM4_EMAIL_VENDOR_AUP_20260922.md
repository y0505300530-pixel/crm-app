# RAM-4 — Email vendor AUP brief (Marketing)

**Date:** 2026-09-22 (IL)  
**Scope:** Marketing ESP selection for BioLabs Research B2B RUO catalog email only. Order-status / transactional (RAM-1) stays on CRM’s own send path. **No signup performed.**

## Recommendation (rank)

1. **MailerLite** — best conditional fit. Public policy does not specifically ban peptides / pharmaceuticals / research chemicals; non-listed content may be sent to properly opted-in subscribers. **Require written approval** for B2B laboratory RUO catalog before any account. Strict RUO lab copy only (no human-use, dosing, therapeutic, weight-loss, anti-aging, performance claims). Catalog names: G1-S / G2-T / G3-R only (never INN / RETA).
2. **GoHighLevel (GHL)** — gray / second. Email ToS less specific; SMS channel bans Rx/controlled — **never enable SMS/phone**. Broader suspension discretion.
3. **Brevo** — least suitable / Legal: **no**. Explicitly bans peptide products for human therapeutic / weight-loss / performance use **including those labeled RUO**.

## Legal lock (ALL BIOLAB 2026-09-22)

- Brevo — rejected.  
- MailerLite — only after written vendor approval for B2B RUO.  
- Digests remain internal until G2–G4 (consent + unsub sync).  

## Guardrails before any marketing send

- Written vendor approval describing B2B laboratory RUO catalog marketing only.  
- `marketing_consent=true` + Soft-QA exclusion + reliable unsub sync (G2–G4).  
- SPF / DKIM / DMARC on sending domain; rotate `MARKETING_DIGEST_KEY` on maintenance.  
- Centralized suppression; one-click unsubscribe.  
- Transactional RAM-1 never on these marketing vendors.

## Sources (public)

- MailerLite Terms / prohibited content / Anti-Spam / Subscriber API + webhooks  
- HighLevel Terms / Forbidden SMS categories / Preference Management / Email Marketing V2 APIs  
- Brevo Anti-Spam Policy (peptide clause) / List-Unsubscribe / contact API  

Full quote pull: Marketing BIOLAB box notes 2026-09-22.

## Status

- Research: **done**  
- Yehuda pick + MailerLite written approval: **pending**  
- Signup: **blocked until both**  
