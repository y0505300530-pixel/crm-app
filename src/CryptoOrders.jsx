import { Fragment, useEffect, useState } from "react";
import { fetchCryptoOrders, markCryptoOrderPaid, shipStoreOrder } from "./pspApi.js";

const STATUS_COLORS = {
  awaiting_crypto: { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B" },
  crypto_paid: { bg: "#DBEAFE", text: "#1E3A8A", border: "#60A5FA" },
};

function Badge({ status }) {
  const c = STATUS_COLORS[status] || { bg: "#F1F5F9", text: "#475569", border: "#94A3B8" };
  return (
    <span style={{
      display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>{status || "—"}</span>
  );
}

function money(amount, currency = "USD") {
  const n = parseFloat(amount) || 0;
  if (currency === "USDT") return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
  return n.toLocaleString("en-US", { style: "currency", currency, minimumFractionDigits: 2 });
}

function customerName(c = {}) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
}

function when(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function CryptoOrders() {
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [txById, setTxById] = useState({});

  const reload = (q = query) => fetchCryptoOrders(q).then((d) => {
    if (d.error === "unauthorized") {
      setErr("Operator session required. Sign in on the live CRM (Bearer) or set a marketing key the sidecar accepts.");
      setOrders([]);
      return;
    }
    setOrders(d.orders || []);
  }).catch(() => setErr("CRM payment API is not running. Start with npm run server."));

  useEffect(() => { reload(""); }, []);

  const markPaid = async (order) => {
    setBusy(order.id);
    setErr("");
    try {
      const out = await markCryptoOrderPaid(order.id, txById[order.id] || "");
      if (!out.ok) {
        setErr(out.error || "Mark paid failed.");
        return;
      }
      await reload();
      setOpenId(order.id);
    } catch {
      setErr("Mark paid failed.");
    } finally {
      setBusy("");
    }
  };

  const ship = async (order) => {
    setBusy(`ship-${order.id}`);
    setErr("");
    try {
      const out = await shipStoreOrder(order.id);
      if (!out.ok) {
        setErr(out.error === "ship_blocked"
          ? "Shipping is blocked until this crypto order is marked paid."
          : (out.error || "Ship failed."));
        return;
      }
      await reload();
      setOpenId(order.id);
    } catch {
      setErr("Ship failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Crypto payments</h2>
          <p style={{ margin: 0, color: "#94A3B8", fontSize: 14, maxWidth: 720 }}>
            Pending USDT checkouts from the storefront. Status stays awaiting crypto until a staff member confirms the transfer.
            Mark paid does not ship. Fulfillment stays blocked until then. RUO catalog only — no card data on this path.
          </p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); reload(query); }} style={{ display: "flex", gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order ref, email, tx"
            style={{
              padding: "8px 12px", borderRadius: 8, border: "1px solid #334155",
              background: "rgba(15,23,42,0.8)", color: "#E2E8F0", minWidth: 240,
            }}
          />
          <button type="submit" style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#0EA5E9,#38BDF8)", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            Search
          </button>
        </form>
      </div>
      {err && <div style={{ color: "#F87171", fontSize: 13, marginBottom: 12 }}>{err}</div>}
      <div style={{ background: "rgba(30,41,59,0.55)", border: "1px solid rgba(148,163,184,0.12)", borderRadius: 14, overflow: "hidden" }}>
        {orders.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center", color: "#64748B" }}>
            No crypto orders yet. Storefront posts to /api/checkout/crypto. Soft-QA can POST the same payload with a qa+ email.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.15)" }}>
                {["Order ref", "Status", "Amount due", "Customer", "Fulfillment", "Created"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#64748B", fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <Fragment key={o.id}>
                  <tr onClick={() => setOpenId(openId === o.id ? null : o.id)} style={{ borderBottom: "1px solid rgba(148,163,184,0.06)", cursor: "pointer" }}>
                    <td style={{ padding: "12px 14px", fontFamily: "'Space Mono',monospace", fontWeight: 700 }}>{o.orderRef || o.id}</td>
                    <td style={{ padding: "12px 14px" }}><Badge status={o.status} /></td>
                    <td style={{ padding: "12px 14px", color: "#38BDF8", fontWeight: 700 }}>{money(o.amountDue || o.amount, o.currency)} → USDT</td>
                    <td style={{ padding: "12px 14px" }}>{o.customer?.email || "—"}</td>
                    <td style={{ padding: "12px 14px", color: o.fulfillment?.status === "blocked" ? "#F59E0B" : "#94A3B8" }}>{o.fulfillment?.status || "blocked"}</td>
                    <td style={{ padding: "12px 14px", color: "#94A3B8", fontSize: 12 }}>{when(o.createdAt)}</td>
                  </tr>
                  {openId === o.id && (
                    <tr>
                      <td colSpan={6} style={{ background: "rgba(15,23,42,0.45)", padding: 16 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
                          {[
                            ["Order", o.id],
                            ["Memo ref", o.orderRef],
                            ["Created", when(o.createdAt)],
                            ["Marked paid", o.crypto?.markedPaidAt ? `${when(o.crypto.markedPaidAt)} · ${o.crypto.markedPaidBy || ""}` : "—"],
                          ].map(([k, v]) => (
                            <div key={k} style={{ background: "rgba(15,23,42,0.6)", borderRadius: 10, padding: "10px 12px" }}>
                              <div style={{ fontSize: 10, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.7 }}>{k}</div>
                              <div style={{ fontSize: 13, color: "#E2E8F0", marginTop: 4, wordBreak: "break-all" }}>{v}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 13, color: "#E2E8F0", marginBottom: 8 }}>
                          {customerName(o.customer)} · {o.customer?.email} · {o.customer?.phone || "no phone"} · {[o.customer?.city, o.customer?.country].filter(Boolean).join(", ") || "no address"}
                        </div>
                        <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 12 }}>
                          {(o.items || []).map((it) => `${it.qty}× ${it.name || it.sku}`).join(", ") || "No lines"}
                        </div>
                        {o.status === "awaiting_crypto" && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <input
                              value={txById[o.id] || ""}
                              onChange={(e) => setTxById((prev) => ({ ...prev, [o.id]: e.target.value }))}
                              placeholder="Tx hash (optional, after you check the chain)"
                              style={{
                                flex: 1, minWidth: 280, padding: "8px 12px", borderRadius: 8,
                                border: "1px solid #334155", background: "#0F172A", color: "#E2E8F0",
                              }}
                            />
                            <button type="button" disabled={Boolean(busy)} onClick={() => markPaid(o)} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#10B981", color: "#042f1c", fontWeight: 700, cursor: "pointer" }}>
                              {busy === o.id ? "Saving…" : "Mark paid"}
                            </button>
                            <button type="button" disabled style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#64748B", cursor: "not-allowed" }}>
                              Shipping blocked until paid
                            </button>
                          </div>
                        )}
                        {o.status === "crypto_paid" && o.fulfillment?.status !== "shipped" && (
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ color: "#94A3B8", fontSize: 13 }}>Paid by {o.crypto?.markedPaidBy || "staff"}. Tx {o.crypto?.txHash || "—"}.</span>
                            <button type="button" disabled={Boolean(busy)} onClick={() => ship(o)} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #334155", background: "rgba(15,23,42,0.8)", color: "#E2E8F0", cursor: "pointer" }}>
                              {busy === `ship-${o.id}` ? "Shipping…" : "Mark shipped"}
                            </button>
                          </div>
                        )}
                        {o.fulfillment?.status === "shipped" && (
                          <div style={{ color: "#94A3B8", fontSize: 13 }}>
                            Shipped {when(o.fulfillment.shippedAt)} by {o.fulfillment.shippedBy || "staff"}. Tx {o.crypto?.txHash || "—"}.
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
