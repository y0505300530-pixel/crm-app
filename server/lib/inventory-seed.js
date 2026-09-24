import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MOVEMENT_TYPE_PO_INTAKE,
  buildInventoryView,
  dollarsToCents,
} from "./inventory.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PVC_LINES_PATH = join(__dirname, "..", "..", "data", "pvc-092326-lines.json");

const SEED_ACTOR = "inventory-seed";

/** Internal COSMO SKUs. Display names stay on G3-R / catalog labels — never Retatrutide. */
export const COSMO_SKUS = [
  { code: "G3-R-10", name: "G3-R 10mg", qty: 100, unit_cost: "40.00" },
  { code: "G3-R-20", name: "G3-R 20mg", qty: 50, unit_cost: "70.00" },
  { code: "TES-10", name: "Tesamorelin 10mg", qty: 100, unit_cost: "35.00" },
  { code: "WOL-10", name: "Wolverine 10mg", qty: 100, unit_cost: "39.00" },
  { code: "GLOW", name: "GLOW", qty: 50, unit_cost: "82.00" },
];

export const COSMO_PO = {
  po_id: "071326",
  supplier: "COSMO VISIONS INC.",
  dated: "2026-07-13",
  status: "RECEIVED",
  created_at: "2026-07-13T00:00:00.000Z",
  goods_cents: 1900000,
  coa_cents: 50000,
  total_cents: 1950000,
};

export const PVC_ALIAS_MAP = {
  R3TA: "G3-R",
  Tirzepatide: "G2-T",
  Semaglutide: "G1-S",
};

export const PVC_PO = {
  po_id: "PVC-092326",
  supplier: "Pure Vision Consulting",
  dated: "2026-09-23",
  status: "PAID_IN_TRANSIT",
  ship_to: "PENDING",
  created_at: "2026-09-23T00:00:00.000Z",
  invoice_goods_target_cents: 664050,
  invoice_units_target: 460,
  invoice_line_target: 28,
};

function skuId(code) {
  return `sku:${code}`;
}

export function loadPvcLinesFile(filePath = PVC_LINES_PATH) {
  if (!filePath || !existsSync(filePath)) {
    return { ok: true, missing: true, lines: [], targets: null };
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    const lines = Array.isArray(parsed?.lines) ? parsed.lines : null;
    if (!lines) return { ok: false, error: "lines_not_array", lines: [] };
    return { ok: true, missing: false, lines, targets: parsed.targets || null };
  } catch {
    return { ok: false, error: "invalid_json", lines: [] };
  }
}

export function normalizePvcLine(raw, index) {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid_line" };
  const supplierName = String(raw.supplier_name || "").trim();
  const qty = Number(raw.qty);
  if (!supplierName) return { ok: false, error: "supplier_name_required" };
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: "invalid_qty" };
  let unitCost;
  let lineTotal;
  try {
    unitCost = dollarsToCents(raw.unit_cost);
    lineTotal = raw.line_total == null ? unitCost * qty : dollarsToCents(raw.line_total);
  } catch {
    return { ok: false, error: "invalid_money" };
  }
  return {
    ok: true,
    line: {
      line_no: Number(raw.line_no) || index + 1,
      supplier_name: supplierName,
      qty,
      unit_cost_cents: unitCost,
      line_total_cents: lineTotal,
      mapping_approved: raw.mapping_approved === true,
      sku_code: raw.sku_code ? String(raw.sku_code).trim() : "",
    },
  };
}

function resolveApprovedSkuId(store, line) {
  if (!line.mapping_approved || !line.sku_code) return null;
  const match = store.listSkus().find((sku) => sku.code === line.sku_code);
  return match ? match.id : null;
}

/**
 * Books PO header + lines only. Does not create SKUs and does not post movements.
 */
export function applyPvcPurchaseOrder(store, rawLines) {
  const existing = store.listPurchaseOrders().find((row) => row.po_id === PVC_PO.po_id);
  const status = existing?.status === "RECEIVED" ? "RECEIVED" : PVC_PO.status;
  const shipTo = existing?.ship_to || PVC_PO.ship_to;
  store.upsertPurchaseOrder({
    po_id: PVC_PO.po_id,
    po_number: PVC_PO.po_id,
    supplier: PVC_PO.supplier,
    dated: PVC_PO.dated,
    status,
    ship_to: shipTo,
    po_level_costs: [],
    alias_map: PVC_ALIAS_MAP,
    invoice_goods_target_cents: PVC_PO.invoice_goods_target_cents,
    invoice_units_target: PVC_PO.invoice_units_target,
    invoice_line_target: PVC_PO.invoice_line_target,
    notes: "Supplier invoice names are stored on PO lines only. sku_id stays null until Yehuda approves mapping. alias_map is metadata on this PO and does not create internal SKUs.",
    created_by: existing?.created_by || SEED_ACTOR,
    created_at: existing?.created_at || PVC_PO.created_at,
  });

  const errors = [];
  let booked = 0;
  rawLines.forEach((raw, index) => {
    const normalized = normalizePvcLine(raw, index);
    if (!normalized.ok) {
      errors.push({ index, error: normalized.error });
      return;
    }
    const line = normalized.line;
    const mappedSku = resolveApprovedSkuId(store, line);
    store.upsertLine({
      id: `ln:${PVC_PO.po_id}:${line.line_no}`,
      po_id: PVC_PO.po_id,
      line_no: line.line_no,
      sku_id: mappedSku,
      supplier_name: line.supplier_name,
      qty: line.qty,
      unit_cost_cents: line.unit_cost_cents,
      line_total_cents: line.line_total_cents,
    });
    booked += 1;
  });
  return { lines_booked: booked, line_errors: errors };
}

/**
 * Idempotent intake. PO #071326 gets five PO_INTAKE rows.
 * PO #PVC-092326 gets a header and lines only — mark-received is not called.
 */
export function seedInventory(store, opts = {}) {
  let movementsCreated = 0;
  let movementsExisting = 0;

  for (const row of COSMO_SKUS) {
    const unit = dollarsToCents(row.unit_cost);
    const saved = store.upsertSku({
      id: skuId(row.code),
      code: row.code,
      name: row.name,
      created_at: COSMO_PO.created_at,
      updated_at: COSMO_PO.created_at,
    });
    if (!saved.ok) {
      throw new Error(`sku_rejected:${row.code}:${saved.error}`);
    }
  }

  const units = COSMO_SKUS.reduce((sum, row) => sum + row.qty, 0);
  const goods = COSMO_SKUS.reduce((sum, row) => sum + row.qty * dollarsToCents(row.unit_cost), 0);
  if (units !== 400) throw new Error("cosmo_units_mismatch");
  if (goods !== COSMO_PO.goods_cents) throw new Error("cosmo_goods_mismatch");

  store.upsertPurchaseOrder({
    po_id: COSMO_PO.po_id,
    po_number: COSMO_PO.po_id,
    supplier: COSMO_PO.supplier,
    dated: COSMO_PO.dated,
    status: COSMO_PO.status,
    ship_to: null,
    po_level_costs: [{
      label: "COA",
      amount_cents: COSMO_PO.coa_cents,
      note: "PO-level cost, not per-unit",
    }],
    alias_map: null,
    notes: "Goods received. COA is a PO-level cost and is not in the weighted average unit cost.",
    created_by: SEED_ACTOR,
    created_at: COSMO_PO.created_at,
  });

  for (const row of COSMO_SKUS) {
    const unit = dollarsToCents(row.unit_cost);
    const id = skuId(row.code);
    store.upsertLine({
      id: `ln:${COSMO_PO.po_id}:${id}`,
      po_id: COSMO_PO.po_id,
      line_no: null,
      sku_id: id,
      supplier_name: null,
      qty: row.qty,
      unit_cost_cents: unit,
      line_total_cents: row.qty * unit,
    });
    const posted = store.insertMovement({
      id: `mv:${COSMO_PO.po_id}:${id}:${MOVEMENT_TYPE_PO_INTAKE}`,
      sku_id: id,
      po_id: COSMO_PO.po_id,
      type: MOVEMENT_TYPE_PO_INTAKE,
      qty: row.qty,
      unit_cost_cents: unit,
      created_by: SEED_ACTOR,
      created_at: COSMO_PO.created_at,
    });
    if (!posted.ok) throw new Error(posted.error);
    if (posted.created) movementsCreated += 1;
    else movementsExisting += 1;
  }

  const pvcFile = loadPvcLinesFile(opts.pvcLinesPath || PVC_LINES_PATH);
  const pvc = applyPvcPurchaseOrder(store, pvcFile.lines || []);
  const pvcMovements = store.listMovements().filter((row) => row.po_id === PVC_PO.po_id).length;
  const view = buildInventoryView(store);
  const cosmo = view.purchase_orders.find((row) => row.po_id === COSMO_PO.po_id);
  const pvcPo = view.purchase_orders.find((row) => row.po_id === PVC_PO.po_id);

  return {
    ok: true,
    mark_received_invoked: false,
    movements_created: movementsCreated,
    movements_existing: movementsExisting,
    on_hand_units: view.on_hand_units,
    on_hand_by_sku: Object.fromEntries(view.skus.map((sku) => [sku.code, sku.on_hand])),
    cosmo: {
      po_id: COSMO_PO.po_id,
      status: cosmo?.status || null,
      movements: cosmo?.movement_count || 0,
      goods_total: cosmo?.goods_total || null,
      total: cosmo?.total || null,
    },
    pvc: {
      po_id: PVC_PO.po_id,
      status: pvcPo?.status || null,
      ship_to: pvcPo?.ship_to || null,
      movements: pvcMovements,
      lines_booked: pvc.lines_booked,
      line_errors: pvc.line_errors,
      file_error: pvcFile.ok ? null : pvcFile.error,
      alias_map: pvcPo?.alias_map || null,
    },
  };
}
