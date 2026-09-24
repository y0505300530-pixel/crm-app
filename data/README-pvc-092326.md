# PO #PVC-092326 lines

Pure Vision Consulting, dated 23 Sep 2026. Status on the PO header is `PAID_IN_TRANSIT`, ship-to `PENDING`.

`pvc-092326-lines.json` is the intake source for this PO. The 28 invoice lines are **not in this repo** (no CSV under `uploads/`). The file is a placeholder: `lines` is empty on purpose.

Do not invent product rows or internal SKUs from supplier invoice names. When the CSV is available, add each line as:

```json
{ "line_no": 1, "supplier_name": "name on the invoice", "qty": 1, "unit_cost": "0.00", "line_total": "0.00" }
```

Leave `sku_id` unset. Mapping is approved only when Yehuda says so (`mapping_approved: true` plus an existing `sku_code`). Alias notes already live on the PO record (`R3TA` → `G3-R`, `Tirzepatide` → `G2-T`, `Semaglutide` → `G1-S`) and are not SKUs.

Invoice targets, not booked until lines are loaded: goods `$6,640.50`, `460` units, `28` lines.

Re-run `node server/scripts/inventory-intake.js`. That posts no movements. Movements are created only by the admin **Mark Received** action after mapping.
