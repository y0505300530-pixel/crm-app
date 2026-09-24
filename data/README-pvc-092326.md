# PO #PVC-092326 lines

Pure Vision Consulting, dated 23 Sep 2026. Status on the PO header is `PAID_IN_TRANSIT`, ship-to `PENDING`.

`data/pvc-092326-lines.csv` is the intake source. Columns: `supplier_name`, `qty`, `unit_cost`, `line_total`, `suggested_internal_code_note`.

The file has 28 lines, 460 units, and $6,640.50. Seed books those rows as purchase-order lines only. It does not post inventory movements, and it does not create internal SKUs from `suggested_internal_code_note`. Those notes are marketing proposals until Yehuda approves a mapping. `sku_id` stays null.

Alias notes live on the PO record only: `R3TA` → `G3-R`, `Tirzepatide` → `G2-T`, `Semaglutide` → `G1-S`.

Re-run `node server/scripts/inventory-intake.js`. That is idempotent and still posts no PVC movements. Movements are created only by the admin **Mark Received** action after each line has an approved `sku_id`. Do not run that action from seed.
