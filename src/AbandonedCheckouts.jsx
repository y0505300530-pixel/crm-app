import { useEffect, useState } from "react";
import { fetchAbandonedCheckouts } from "./pspApi.js";

const STATUS_COLORS = {
  open: { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B" },
  converted: { bg: "#D1FAE5", text: "#065F46", border: "#10B981" },
};

function Badge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.open;
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>{status || "open"}</span>
  );
}

function money(amount) {
  const n = parseFloat(amount) || 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function itemsSummary(items) {
  if (!Array.isArray(items) || items.length === 0) return "—";
  return items.map((it) => {
    const qty = it.qty ?? it.quantity ?? 1;
    const name = it.name || it.title || it.sku || "item";
    return `${qty}× ${name}`;
  }).join(", ");
}

function customerName(c = {}) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
}

export default function AbandonedCheckouts() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  const reload = () => fetchAbandonedCheckouts()
    .then((d) => setRows(d.abandoned_checkouts || []))
    .catch(() => setErr("CRM sidecar is not running. Start with npm run server."));

  useEffect(() => { reload(); }, []);

  const openCount = rows.filter((r) => r.status !== "converted").length;
  const openValue = rows
    .filter((r) => r.status !== "converted")
    .reduce((s, r) => s + (parseFloat(r.subtotal) || 0), 0);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Abandoned checkout</h2>
        <p style={{ margin: 0, color: "#94A3B8", fontSize: 14, maxWidth: 760 }}>
          First-party RUO / Quote leads from the storefront beacon. Inquiry capture only — no card data, no last4, no payment method.
          Matching <code style={{ color: "#38BDF8" }}>session_id</code> on quote (or charge when payments are on) marks the row converted.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Open leads</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#F59E0B", fontFamily: "'Space Mono',monospace" }}>{openCount}</div>
        </div>
        <div style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Open value</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#38BDF8", fontFamily: "'Space Mono',monospace" }}>{money(openValue)}</div>
        </div>
      </div>

      {err && <div style={{ color: "#F87171", fontSize: 13, marginBottom: 12 }}>{err}</div>}

      <div style={{ background: "rgba(30,41,59,0.55)", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 14, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center", color: "#64748B" }}>
            No first-party abandoned-checkout leads yet. Soft-QA: POST /api/checkout/abandon with a qa+…@biolabsresearch.co email.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.15)" }}>
                {["Name", "Email", "Phone", "Items", "Value", "Stage", "Last seen", "Status"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#64748B", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.session_id} style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600 }}>{customerName(r.customer)}</td>
                  <td style={{ padding: "12px 14px" }}>{r.customer?.email || "—"}</td>
                  <td style={{ padding: "12px 14px", color: "#94A3B8" }}>{r.customer?.phone || "—"}</td>
                  <td style={{ padding: "12px 14px", color: "#CBD5E1", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemsSummary(r.items)}</td>
                  <td style={{ padding: "12px 14px", color: "#38BDF8", fontWeight: 700, fontFamily: "'Space Mono',monospace" }}>{money(r.subtotal)}</td>
                  <td style={{ padding: "12px 14px" }}>{r.stage || "—"}</td>
                  <td style={{ padding: "12px 14px", color: "#94A3B8", fontSize: 12 }}>{r.last_seen ? new Date(r.last_seen).toLocaleString() : "—"}</td>
                  <td style={{ padding: "12px 14px" }}><Badge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
