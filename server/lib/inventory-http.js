import { buildInventoryView, markPurchaseOrderReceived } from "./inventory.js";
import { seedInventory } from "./inventory-seed.js";

/**
 * CRM operator inventory routes. Not mounted on storefront CORS.
 * Does not write catalog products, stock_qty, or public on_hand.
 */
export async function handleInventoryHttp(ctx) {
  const { path, method, json, inventory, authorize } = ctx;
  const auth = await authorize();
  if (!auth?.ok) {
    json(401, { error: "unauthorized" });
    return;
  }

  if (path === "/api/inventory" && method === "GET") {
    json(200, buildInventoryView(inventory));
    return;
  }

  if (path === "/api/inventory/on-hand" && method === "GET") {
    const view = buildInventoryView(inventory);
    json(200, {
      source: view.source,
      on_hand_units: view.on_hand_units,
      on_hand_by_sku: Object.fromEntries(view.skus.map((sku) => [sku.code, sku.on_hand])),
      storefront_catalog_updated: false,
      public_quantity_exposed: false,
    });
    return;
  }

  if (path === "/api/inventory/intake" && method === "POST") {
    const report = seedInventory(inventory);
    json(200, { ok: true, report, inventory: buildInventoryView(inventory) });
    return;
  }

  const received = path.match(/^\/api\/inventory\/purchase-orders\/([^/]+)\/mark-received$/);
  if (received) {
    if (method !== "POST") {
      json(405, { error: "method_not_allowed" });
      return;
    }
    const poId = decodeURIComponent(received[1]);
    const result = markPurchaseOrderReceived(inventory, poId, auth.actor);
    const body = {
      ok: result.ok,
      error: result.error,
      message: result.message,
      movements_created: result.movements_created,
      movements_existing: result.movements_existing,
      reused: result.reused || false,
      po_id: result.po_id || poId,
      inventory: buildInventoryView(inventory),
    };
    json(result.status || (result.ok ? 200 : 400), body);
    return;
  }

  const stockWrite = path.match(/^\/api\/inventory\/skus\/([^/]+)\/stock$/);
  if (stockWrite) {
    if (method === "GET" || method === "HEAD") {
      json(405, { error: "method_not_allowed" });
      return;
    }
    json(409, {
      error: "legacy_stock_qty_readonly",
      message: "stock_qty cannot be overwritten. on_hand is SUM(inventory_movements.qty) only.",
      on_hand_source: "sum(inventory_movements.qty)",
    });
    return;
  }

  if (path.startsWith("/api/inventory/skus/") && (method === "PUT" || method === "POST")) {
    let body = {};
    if (typeof ctx.readBody === "function") {
      body = await ctx.readBody();
    }
    if (body && Object.prototype.hasOwnProperty.call(body, "stock_qty")) {
      json(409, {
        error: "legacy_stock_qty_readonly",
        message: "stock_qty cannot be overwritten. on_hand is SUM(inventory_movements.qty) only.",
        on_hand_source: "sum(inventory_movements.qty)",
      });
      return;
    }
    json(405, { error: "method_not_allowed" });
    return;
  }

  json(404, { error: "not_found" });
}
