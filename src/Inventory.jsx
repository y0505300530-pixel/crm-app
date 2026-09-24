import { Fragment, useEffect, useState } from "react";
import { fetchInventory, markPurchaseOrderReceived, rerunIntake } from "./inventoryApi.js";

const card = {
  background: "rgba(30,41,59,0.8)",
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: 14,
  padding: 18,
};

const th = {
  padding: "10px 12px",
  textAlign: "left",
  color: "#64748B",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  whiteSpace: "nowrap",
};

const td = { padding: "10px 12px", fontSize: 14, verticalAlign: "top" };

function money(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function StatusPill({ status }) {
  const received = status === "RECEIVED";
  const color = received ? "#10B981" : "#F59E0B";
  const bg = received ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)";
  return (
    <span style={{
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      color,
      background: bg,
      border: `1px solid ${color}`,
    }}>{status}</span>
  );
}

export default function Inventory() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [openPo, setOpenPo] = useState("071326");

  const applyPayload = (body) => {
    if (body?.inventory) setData(body.inventory);
    else if (body?.skus) setData(body);
  };

  const reload = () => {
    setErr("");
    return fetchInventory().then(({ status, body }) => {
      if (status === 401) {
        setErr("CRM session required. Inventory uses the same operator auth as Store orders.");
        return;
      }
      if (status !== 200) {
        setErr(body?.error || "Inventory API failed.");
        return;
      }
      applyPayload(body);
    }).catch(() => setErr("CRM API is not running. Start it with npm run server."));
  };

  useEffect(() => { reload(); }, []);

  const onRerun = async () => {
    setBusy("intake");
    setNote("");
    setErr("");
    try {
      const { status, body } = await rerunIntake();
      if (status === 401) {
        setErr("CRM session required. Inventory uses the same operator auth as Store orders.");
        return;
      }
      if (status !== 200 || !body.ok) {
        setErr(body?.error || "Intake failed.");
        return;
      }
      applyPayload(body);
      const report = body.report || {};
      setNote(`Intake re-run: created ${report.movements_created} movement(s), ${report.movements_existing} already posted. on_hand ${report.on_hand_units}. PVC movements ${report.pvc?.movements ?? 0}. Mark Received was not called.`);
    } catch {
      setErr("Intake failed.");
    } finally {
      setBusy("");
    }
  };

  const onReceive = async (po) => {
    const ok = window.confirm(`Mark PO #${po.po_number} received? Movements are posted only for lines that already have an internal SKU.`);
    if (!ok) return;
    setBusy(po.po_id);
    setNote("");
    setErr("");
    try {
      const { status, body } = await markPurchaseOrderReceived(po.po_id);
      if (status === 401) {
        setErr("CRM session required. Inventory uses the same operator auth as Store orders.");
        return;
      }
      if (body?.inventory) applyPayload(body);
      if (!body?.ok) {
        setErr(body?.message || body?.error || "Mark Received did not post movements.");
        return;
      }
      setNote(body.reused
        ? `PO #${po.po_number} was already received. No duplicate movements.`
        : `PO #${po.po_number} received. Movements posted: ${body.movements_created}.`);
    } catch {
      setErr("Mark Received failed.");
    } finally {
      setBusy("");
    }
  };

  const legacyRows = (data?.skus || []).filter((sku) => sku.legacy_stock_qty != null);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Inventory</h2>
          <p style={{ margin: 0, color: "#94A3B8", fontSize: 14, maxWidth: 760 }}>
            On-hand is the sum of inventory movements. PO #071326 is already received. PO #PVC-092326 stays in transit until you press Mark Received, and only after each line has an approved internal SKU.
          </p>
        </div>
        <button
          type="button"
          onClick={onRerun}
          disabled={busy === "intake"}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid rgba(56,189,248,0.35)",
            background: "rgba(56,189,248,0.12)",
            color: "#38BDF8",
            fontWeight: 700,
            cursor: busy === "intake" ? "wait" : "pointer",
            whiteSpace: "nowrap",
          }}
        >{busy === "intake" ? "Re-running…" : "Re-run intake"}</button>
      </div>

      <div style={{ ...card, marginBottom: 16, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: "#94A3B8", fontWeight: 700, letterSpacing: 0.4 }}>Legacy stock_qty</div>
          <div style={{ marginTop: 4, color: "#CBD5E1", fontSize: 14 }}>
            Read-only. This screen does not write stock_qty, and it does not publish quantities to the storefront catalog.
          </div>
        </div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="stock_qty is read-only. on_hand is the sum of inventory movements."
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #334155",
            background: "#0F172A",
            color: "#64748B",
            fontWeight: 700,
            cursor: "not-allowed",
          }}
        >Overwrite stock (locked)</button>
      </div>

      {err && <div style={{ marginBottom: 14, color: "#FCA5A5", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 10, padding: "10px 12px" }}>{err}</div>}
      {note && <div style={{ marginBottom: 14, color: "#A7F3D0", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 10, padding: "10px 12px" }}>{note}</div>}

      {!data && !err && <div style={{ color: "#94A3B8" }}>Loading inventory…</div>}

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
            {[
              ["On-hand units", String(data.on_hand_units)],
              ["Value at cost", money(data.value_at_cost)],
              ["Purchase orders", String(data.purchase_orders.length)],
              ["Quantity source", "Movement sum"],
            ].map(([label, value]) => (
              <div key={label} style={card}>
                <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</div>
                <div style={{ marginTop: 8, fontSize: 22, fontWeight: 700, fontFamily: "'Space Mono', monospace", color: "#F8FAFC" }}>{value}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: "0 0 18px", color: "#64748B", fontSize: 13 }}>
            Value at cost uses the weighted average of intake unit costs. The $500 COA on PO #071326 is a PO-level cost and is not spread into the unit cost.
          </p>

          <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 18 }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(148,163,184,0.12)", fontWeight: 700 }}>SKUs</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Code", "Name", "On hand", "Avg unit cost", "Value at cost", "Linked POs", ...(legacyRows.length ? ["Legacy stock_qty"] : [])].map((label) => (
                      <th key={label} style={th}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.skus.map((sku) => (
                    <tr key={sku.id} style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
                      <td style={{ ...td, fontFamily: "'Space Mono', monospace" }}>{sku.code}</td>
                      <td style={td}>{sku.name}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{sku.on_hand}</td>
                      <td style={td}>{money(sku.weighted_avg_unit_cost)}</td>
                      <td style={td}>{money(sku.value_at_cost)}</td>
                      <td style={td}>{(sku.linked_pos || []).join(", ") || "—"}</td>
                      {legacyRows.length > 0 && (
                        <td style={{ ...td, color: "#94A3B8" }}>{sku.legacy_stock_qty == null ? "—" : `${sku.legacy_stock_qty} (read-only)`}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(148,163,184,0.12)", fontWeight: 700 }}>Purchase orders</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["PO", "Supplier", "Dated", "Status", "Ship to", "Goods", "Total", "Movements", ""].map((label) => (
                      <th key={label || "action"} style={th}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.purchase_orders.map((po) => (
                    <Fragment key={po.po_id}>
                      <tr style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
                        <td style={{ ...td, fontFamily: "'Space Mono', monospace" }}>#{po.po_number}</td>
                        <td style={td}>{po.supplier}</td>
                        <td style={td}>{po.dated}</td>
                        <td style={td}><StatusPill status={po.status} /></td>
                        <td style={td}>{po.ship_to || "—"}</td>
                        <td style={td}>{money(po.goods_total)}</td>
                        <td style={td}>{money(po.total)}</td>
                        <td style={td}>{po.movement_count}</td>
                        <td style={td}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" onClick={() => setOpenPo(openPo === po.po_id ? "" : po.po_id)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#CBD5E1", cursor: "pointer" }}>
                              {openPo === po.po_id ? "Hide" : "Lines"}
                            </button>
                            {po.can_mark_received && (
                              <button
                                type="button"
                                onClick={() => onReceive(po)}
                                disabled={busy === po.po_id}
                                style={{ padding: "6px 10px", borderRadius: 8, border: "none", background: "#0EA5E9", color: "#fff", fontWeight: 700, cursor: busy === po.po_id ? "wait" : "pointer" }}
                              >{busy === po.po_id ? "Posting…" : "Mark Received"}</button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {openPo === po.po_id && (
                        <tr>
                          <td colSpan={9} style={{ padding: "0 16px 16px" }}>
                            {po.invoice_goods_target && (
                              <div style={{ color: "#94A3B8", fontSize: 13, margin: "8px 0" }}>
                                Invoice target (not booked until lines are loaded): {money(po.invoice_goods_target)} goods, {po.invoice_units_target} units, {po.invoice_line_target} lines. Booked lines: {po.lines.length}.
                              </div>
                            )}
                            {po.alias_map && (
                              <div style={{ color: "#94A3B8", fontSize: 13, margin: "8px 0" }}>
                                Alias notes on this PO only (not SKUs): {Object.entries(po.alias_map).map(([from, to]) => `${from} → ${to}`).join(" · ")}
                              </div>
                            )}
                            {po.po_level_costs.length > 0 && (
                              <div style={{ color: "#94A3B8", fontSize: 13, margin: "8px 0" }}>
                                {po.po_level_costs.map((cost) => `${cost.label} ${money(cost.amount)} (${cost.note})`).join(" · ")}
                              </div>
                            )}
                            {po.lines.length === 0 && <div style={{ color: "#64748B", fontSize: 13 }}>No PO lines booked.</div>}
                            {po.lines.length > 0 && (
                              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                                <thead>
                                  <tr>
                                    {["Line", "SKU", "Supplier invoice name", "Qty", "Unit cost", "Line total"].map((label) => (
                                      <th key={label} style={th}>{label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {po.lines.map((line) => (
                                    <tr key={line.id} style={{ borderTop: "1px solid rgba(148,163,184,0.08)" }}>
                                      <td style={td}>{line.line_no || "—"}</td>
                                      <td style={td}>{line.sku_code || "Unmapped"}</td>
                                      <td style={td}>{line.supplier_name || "—"}</td>
                                      <td style={td}>{line.qty}</td>
                                      <td style={td}>{money(line.unit_cost)}</td>
                                      <td style={td}>{money(line.line_total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
