import { useState } from "react";
import ProcessorSettings from "./ProcessorSettings.jsx";
import StoreOrders from "./StoreOrders.jsx";
import AbandonedCheckouts from "./AbandonedCheckouts.jsx";

const USERS = [
  { email: "sophia@blitz-affiliates.marketing", password: "Odessa2020", name: "Sophia" },
  { email: "office1092021@gmail.com", password: "Odessa2020", name: "Office" },
  { email: "y0505300530@gmail.com", password: "Odessa2020", name: "Y Admin" },
];

const STATUS_OPTIONS = ["Open", "On the way", "Approved to pay", "Paid"];
const OPEN_STATUSES = ["Open", "On the way", "Approved to pay"];
const STATUS_COLORS = {
  Open: { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B" },
  "On the way": { bg: "#E0E7FF", text: "#3730A3", border: "#818CF8" },
  "Approved to pay": { bg: "#D1FAE5", text: "#065F46", border: "#10B981" },
  Paid: { bg: "#D1FAE5", text: "#065F46", border: "#10B981" },
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const genId = () => Math.random().toString(36).substr(2, 9);
const INVOICE_START = 100000;

const INITIAL = [
  { id: genId(), invoice: "100000", paidDate: "", status: "Paid", amount: "2300", openBy: "Sophia", network: "Blitzz", instructions: "USDTerc20/ USDC erc20/ eth: 0xAE63A91758600339C8e5Ae58b6...", paymentHash: "", month: 1, year: 2026 },
  { id: genId(), invoice: "100001", paidDate: "", status: "Paid", amount: "3000", openBy: "Sophia", network: "Blitzz", instructions: "‼️ ONLY USDT ‼️ TRC-20: TYUWBpmzSqCcz9r5rRVGQvQzfb7qC1...", paymentHash: "", month: 1, year: 2026 },
  { id: genId(), invoice: "100002", paidDate: "", status: "Paid", amount: "26990", openBy: "Sophia", network: "Blitzz", instructions: "USDT ERC20 + FEE 0x6A8CC73BBFd9717489Ad89661aba0482d112...", paymentHash: "", month: 1, year: 2026 },
  { id: genId(), invoice: "100003", paidDate: "", status: "Paid", amount: "3200", openBy: "Sophia", network: "Blitzz", instructions: "Pls process the payment TRC20 - TAqtT5SP5rCqXVpF3mG9hjHD2rn...", paymentHash: "", month: 1, year: 2026 },
  { id: genId(), invoice: "100004", paidDate: "", status: "Paid", amount: "5000", openBy: "Sophia", network: "Blitzz", instructions: "Our wallets: 0xA061F8742Ea82a41c8f1cccd26868Cb9Ae5E9B79 Erc...", paymentHash: "", month: 1, year: 2026 },
  { id: genId(), invoice: "100005", paidDate: "", status: "Paid", amount: "2600", openBy: "Sophia", network: "Blitzz", instructions: "TRC TCJLAVWWPyosxq8WBGB1yYid5pRP94BAS6 +2%FEE ERC 0x...", paymentHash: "", month: 1, year: 2026 },
  { id: genId(), invoice: "100006", paidDate: "", status: "Paid", amount: "10000", openBy: "Sophia", network: "Blitzz", instructions: "‼️ UPDATED NEW Wallets: ONLY USDT ‼️  TRC20 - TKDR9q8...", paymentHash: "", month: 1, year: 2026 },
  { id: genId(), invoice: "100007", paidDate: "", status: "Paid", amount: "1450", openBy: "Sophia", network: "Blitzz", instructions: "FEE 2% USDT (ERC20) 0x564a0700D9C77c8811FEE19ECc137B3A9...", paymentHash: "", month: 1, year: 2026 },
  { id: genId(), invoice: "100008", paidDate: "", status: "Paid", amount: "16230", openBy: "Sophia", network: "Blitzz", instructions: "We only accept payments in USDT. Payment wallet addresses: USDT ...", paymentHash: "", month: 1, year: 2026 },
  { id: genId(), invoice: "100009", paidDate: "", status: "Paid", amount: "3000", openBy: "Sophia", network: "Blitzz", instructions: "🔗 ERC20 (Ethereum) - USDT/USDC: 0x9fb3889367FC8c0C32FD...", paymentHash: "", month: 1, year: 2026 },
  { id: genId(), invoice: "100010", paidDate: "", status: "Paid", amount: "4000", openBy: "Sophia", network: "Blitzz", instructions: "Hi guys! Our wallets 0x2d93167590B6951fD5A1b4aEaf984Ff155C8E...", paymentHash: "", month: 1, year: 2026 },
  { id: genId(), invoice: "100011", paidDate: "", status: "Paid", amount: "8000", openBy: "Sophia", network: "Blitzz", instructions: "🔗 ERC20 (Ethereum) - USDT/USDC: 0x9fb3889367FC8c0C32FD8...", paymentHash: "", month: 1, year: 2026 },
];

function getNextInvoice(payments) {
  const maxInv = payments.reduce((max, p) => {
    const n = parseInt(p.invoice, 10);
    return isNaN(n) ? max : Math.max(max, n);
  }, INVOICE_START - 1);
  return String(maxInv + 1);
}

/* ── Icons ── */
const I = {
  logo: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="8" fill="#0F172A"/><path d="M8 10h12M8 14h8M8 18h10" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round"/></svg>,
  plus: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 3v12M3 9h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  edit: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
  trash: <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3h4v1M5 4v9h6V4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>,
  logout: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 15H4a1 1 0 01-1-1V4a1 1 0 011-1h3M11 12l3-3-3-3M7 9h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chevL: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  chevR: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  search: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M12 12l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  close: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  openBox: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="6" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 10h14M7 3l-4 7M13 3l4 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 8h14M7 2v4M13 2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
};

/* ── Shared styles ── */
const inp = {
  width: "100%", padding: "10px 14px", background: "#0F172A",
  border: "1px solid rgba(148,163,184,0.2)", borderRadius: 8,
  color: "#F1F5F9", fontSize: 14, outline: "none", boxSizing: "border-box",
};

/* ── Components ── */
function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: "#F1F5F9", text: "#475569", border: "#94A3B8" };
  return <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: c.bg, color: c.text, border: `1px solid ${c.border}`, whiteSpace: "nowrap" }}>{status}</span>;
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#1E293B", borderRadius: 16, border: "1px solid rgba(56,189,248,0.15)", padding: 32, width: 540, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 25px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: "#F1F5F9", fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}>{I.close}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 18 }}><label style={{ display: "block", color: "#94A3B8", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</label>{children}</div>;
}

function getAvailableStatuses(userEmail) {
  // Everyone can set: Open, On the way
  // y0505300530@gmail.com can also set: Approved to pay, Paid
  // office1092021@gmail.com can also set: Paid
  const base = ["Open", "On the way"];
  if (userEmail === "y0505300530@gmail.com") {
    return ["Open", "On the way", "Approved to pay", "Paid"];
  }
  if (userEmail === "office1092021@gmail.com") {
    return ["Open", "On the way", "Paid"];
  }
  return base;
}

function PaymentForm({ payment, onSave, onClose, userEmail, nextInvoice, userName }) {
  const [f, setF] = useState(payment || { invoice: nextInvoice || "", paidDate: "", status: "Open", amount: "", openBy: userName || "", network: "", instructions: "", paymentHash: "" });
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  const availableStatuses = getAvailableStatuses(userEmail);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
        <Field label="Invoice #"><input style={{ ...inp, background: !payment ? "#0c1322" : "#0F172A", color: !payment ? "#64748B" : "#F1F5F9" }} value={f.invoice} onChange={e => payment && s("invoice", e.target.value)} readOnly={!payment} placeholder="Auto-generated" /></Field>
        <Field label="Amount ($)"><input style={inp} type="number" value={f.amount} onChange={e => s("amount", e.target.value)} placeholder="0.00" /></Field>
        <Field label="Status">
          <select style={{ ...inp, cursor: "pointer" }} value={f.status} onChange={e => {
            const ns = e.target.value;
            setF(prev => ({
              ...prev,
              status: ns,
              paidDate: ns === "Paid" ? (prev.paidDate || new Date().toISOString().split("T")[0]) : "",
            }));
          }}>
            {availableStatuses.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
          {!availableStatuses.includes(f.status) && f.status && (
            <div style={{ fontSize: 11, color: "#F59E0B", marginTop: 4 }}>Current status "{f.status}" — you don't have permission to change it to this value</div>
          )}
        </Field>
        <Field label="Paid Date">
          <div style={{ ...inp, background: "#0B1120", color: f.paidDate ? "#F1F5F9" : "#475569", cursor: "default", display: "flex", alignItems: "center" }}>
            {f.paidDate || "Auto-filled when marked as Paid"}
          </div>
        </Field>
        <Field label="Open By"><input style={inp} value={f.openBy} onChange={e => s("openBy", e.target.value)} placeholder="Name" /></Field>
      </div>
      <Field label="Instructions"><textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={f.instructions} onChange={e => s("instructions", e.target.value)} placeholder="Notes or instructions..." /></Field>
      <Field label="Payment Hash (Crypto Wallet)"><input style={inp} value={f.paymentHash} onChange={e => s("paymentHash", e.target.value)} placeholder="e.g. 0xabc123..." /></Field>
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, background: "transparent", border: "1px solid #334155", color: "#94A3B8", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Cancel</button>
        <button onClick={() => onSave(f)} style={{ padding: "10px 24px", borderRadius: 8, background: "linear-gradient(135deg,#0EA5E9,#38BDF8)", border: "none", color: "#FFF", cursor: "pointer", fontSize: 14, fontWeight: 600, boxShadow: "0 4px 15px rgba(14,165,233,0.3)" }}>{payment ? "Save Changes" : "Add Payment"}</button>
      </div>
    </>
  );
}

/* ── Payment Table ── */
function PaymentTable({ payments, onEdit, onDelete, emptyMsg }) {
  const fmt = a => { const n = parseFloat(a) || 0; return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }); };
  if (payments.length === 0) return <div style={{ padding: "40px 16px", textAlign: "center", color: "#475569", fontSize: 14 }}>{emptyMsg}</div>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.15)" }}>
            {["Invoice","Status","Amount","Open By","Instructions","Payment Hash","Paid Date","Actions"].map(h =>
              <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#64748B", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {payments.map((p, i) => (
            <tr key={p.id}
              style={{ borderBottom: i < payments.length - 1 ? "1px solid rgba(148,163,184,0.06)" : "none", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(56,189,248,0.03)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <td style={{ padding: "12px 14px", fontWeight: 600, fontFamily: "'Space Mono',monospace" }}>#{p.invoice}</td>
              <td style={{ padding: "12px 14px" }}><StatusBadge status={p.status} /></td>
              <td style={{ padding: "12px 14px", fontWeight: 700, fontFamily: "'Space Mono',monospace", color: "#38BDF8" }}>{fmt(p.amount)}</td>
              <td style={{ padding: "12px 14px" }}>{p.openBy}</td>
              <td style={{ padding: "12px 14px", color: "#94A3B8", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.instructions || "—"}</td>
              <td style={{ padding: "12px 14px", fontFamily: "'Space Mono',monospace", fontSize: 12, color: "#475569", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.paymentHash || "—"}</td>
              <td style={{ padding: "12px 14px", color: p.paidDate ? "#CBD5E1" : "#334155", fontSize: 13 }}>{p.paidDate || "—"}</td>
              <td style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onEdit(p)} title="Edit" style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 8, padding: 7, cursor: "pointer", color: "#38BDF8", display: "flex" }}>{I.edit}</button>
                  <button onClick={() => onDelete(p.id)} title="Delete" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: 7, cursor: "pointer", color: "#F87171", display: "flex" }}>{I.trash}</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Group Header ── */
function GroupHeader({ icon, title, count, total, accentColor, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  const fmt = a => { const n = parseFloat(a) || 0; return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }); };

  return (
    <div style={{ marginBottom: 20 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "14px 20px", background: "rgba(30,41,59,0.8)",
        border: "1px solid rgba(148,163,184,0.12)", borderRadius: open ? "14px 14px 0 0" : 14,
        cursor: "pointer", color: "#F1F5F9", fontSize: 15, fontWeight: 700,
        transition: "all 0.2s",
      }}>
        <span style={{ color: accentColor, display: "flex" }}>{icon}</span>
        <span>{title}</span>
        <span style={{ background: accentColor, color: "#FFF", borderRadius: 12, padding: "2px 10px", fontSize: 12, fontWeight: 700, marginLeft: 4 }}>{count}</span>
        <span style={{ marginLeft: "auto", fontFamily: "'Space Mono',monospace", fontSize: 14, color: accentColor }}>{fmt(total)}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", marginLeft: 8 }}>
          <path d="M4 6l4 4 4-4" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div style={{
          background: "rgba(30,41,59,0.5)",
          border: "1px solid rgba(148,163,184,0.1)",
          borderTop: "none",
          borderRadius: "0 0 14px 14px",
          overflow: "hidden",
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Dashboard ── */
function Dashboard({ user, onLogout }) {
  const now = new Date();
  const [view, setView] = useState("paytrack");
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [payments, setPayments] = useState(INITIAL);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editPay, setEditPay] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const isAdmin = user.email === "y0505300530@gmail.com";

  const matchSearch = p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [p.invoice, p.openBy, p.status, p.instructions, p.paymentHash].some(v => (v || "").toLowerCase().includes(q));
  };

  // Open payments: any payment NOT "Paid"
  const openPayments = payments.filter(p => OPEN_STATUSES.includes(p.status) && matchSearch(p));
  // Paid payments: filtered by selected month
  const paidPayments = payments.filter(p => p.status === "Paid" && p.month === month && p.year === year && matchSearch(p));

  const openTotal = openPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const paidTotal = paidPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const handleSave = form => {
    if (editPay) {
      // If status changed to Paid, set the month/year to current selected month
      const updated = { ...editPay, ...form };
      if (form.status === "Paid" && editPay.status !== "Paid") {
        updated.month = month;
        updated.year = year;
        if (!updated.paidDate) {
          updated.paidDate = new Date().toISOString().split("T")[0];
        }
      }
      setPayments(prev => prev.map(p => p.id === editPay.id ? updated : p));
    } else {
      setPayments(prev => [...prev, { ...form, id: genId(), month, year }]);
    }
    setModalOpen(false);
    setEditPay(null);
  };

  const handleDelete = id => { setPayments(prev => prev.filter(p => p.id !== id)); setDelConfirm(null); };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(145deg,#0B1120 0%,#162032 50%,#0F172A 100%)", fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#F1F5F9" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 32px", borderBottom: "1px solid rgba(148,163,184,0.1)", background: "rgba(15,23,42,0.85)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {I.logo}
          <span style={{ fontFamily: "'Space Mono',monospace", fontWeight: 700, fontSize: 18, letterSpacing: -0.3 }}>BioLabs CRM</span>
          <div style={{ display: "flex", gap: 6, marginLeft: 18 }}>
            {[
              ["paytrack", "Affiliate PayTrack"],
              ["orders", "Store orders"],
              ["processors", "Processors"],
              ["abandoned", "Abandoned checkout"],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setView(id)} style={{
                padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600,
                border: view === id ? "1px solid rgba(56,189,248,0.35)" : "1px solid transparent",
                background: view === id ? "rgba(56,189,248,0.12)" : "transparent",
                color: view === id ? "#38BDF8" : "#94A3B8",
              }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ padding: "5px 14px", borderRadius: 20, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)", fontSize: 13, color: "#38BDF8", fontWeight: 500 }}>{user.name}</div>
          <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 13, fontWeight: 500, padding: "6px 8px", borderRadius: 8 }}
            onMouseEnter={e => e.currentTarget.style.color = "#F87171"}
            onMouseLeave={e => e.currentTarget.style.color = "#64748B"}
          >{I.logout}<span>Logout</span></button>
        </div>
      </header>

      {view === "orders" && (
        <main style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 32px" }}>
          <StoreOrders isAdmin={isAdmin} />
        </main>
      )}
      {view === "processors" && (
        <main style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 32px" }}>
          <ProcessorSettings isAdmin={isAdmin} />
        </main>
      )}
      {view === "abandoned" && (
        <main style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 32px" }}>
          <AbandonedCheckouts />
        </main>
      )}
      {view === "paytrack" && <main style={{ maxWidth: 1240, margin: "0 auto", padding: "28px 32px" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={prevMonth} style={{ background: "rgba(30,41,59,0.8)", border: "1px solid #334155", borderRadius: 10, padding: 8, cursor: "pointer", color: "#94A3B8", display: "flex" }}>{I.chevL}</button>
            <div style={{ minWidth: 200, textAlign: "center" }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{MONTHS[month]}</span>
              <span style={{ fontSize: 22, fontWeight: 300, color: "#64748B", marginLeft: 10 }}>{year}</span>
            </div>
            <button onClick={nextMonth} style={{ background: "rgba(30,41,59,0.8)", border: "1px solid #334155", borderRadius: 10, padding: 8, cursor: "pointer", color: "#94A3B8", display: "flex" }}>{I.chevR}</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, maxWidth: 500, marginLeft: 24 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }}>{I.search}</div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search payments..."
                style={{ ...inp, paddingLeft: 40, background: "rgba(30,41,59,0.8)", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 10, fontSize: 14 }} />
            </div>
            <button onClick={() => { setEditPay(null); setModalOpen(true); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "linear-gradient(135deg,#0EA5E9,#38BDF8)", border: "none", borderRadius: 10, color: "#FFF", cursor: "pointer", fontSize: 14, fontWeight: 600, boxShadow: "0 4px 20px rgba(14,165,233,0.3)", whiteSpace: "nowrap" }}
            >{I.plus} New Payment</button>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { label: "Open Payments", value: openPayments.length, accent: "#F59E0B", isMoney: false },
            { label: "Open Total", value: openTotal, accent: "#F59E0B", isMoney: true },
            { label: "Paid This Month", value: paidPayments.length, accent: "#10B981", isMoney: false },
            { label: "Paid Total", value: paidTotal, accent: "#10B981", isMoney: true },
          ].map((c, i) => (
            <div key={i} style={{ background: "linear-gradient(135deg,rgba(30,41,59,0.9),rgba(30,41,59,0.6))", border: "1px solid rgba(148,163,184,0.1)", borderRadius: 14, padding: "18px 22px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: c.accent, opacity: 0.7 }} />
              <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Space Mono',monospace", color: c.accent }}>
                {c.isMoney ? c.value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }) : c.value}
              </div>
            </div>
          ))}
        </div>

        {/* Open Payments Group */}
        <GroupHeader icon={I.openBox} title="Open Payments" count={openPayments.length} total={openTotal} accentColor="#F59E0B" defaultOpen={true}>
          <PaymentTable payments={openPayments} onEdit={p => { setEditPay(p); setModalOpen(true); }} onDelete={id => setDelConfirm(id)} emptyMsg="No open payments — all caught up!" />
        </GroupHeader>

        {/* Paid This Month Group */}
        <GroupHeader icon={I.calendar} title={`Paid — ${MONTHS[month]} ${year}`} count={paidPayments.length} total={paidTotal} accentColor="#10B981" defaultOpen={true}>
          <PaymentTable payments={paidPayments} onEdit={p => { setEditPay(p); setModalOpen(true); }} onDelete={id => setDelConfirm(id)} emptyMsg={`No paid payments for ${MONTHS[month]} ${year}`} />
        </GroupHeader>
      </main>}

      {/* Modals */}
      {modalOpen && (
        <Modal title={editPay ? "Edit Payment" : "New Payment"} onClose={() => { setModalOpen(false); setEditPay(null); }}>
          <PaymentForm payment={editPay} onSave={handleSave} onClose={() => { setModalOpen(false); setEditPay(null); }} userEmail={user.email} nextInvoice={!editPay ? getNextInvoice(payments) : undefined} userName={user.name} />
        </Modal>
      )}
      {delConfirm && (
        <Modal title="Delete Payment" onClose={() => setDelConfirm(null)}>
          <p style={{ color: "#94A3B8", marginBottom: 24, fontSize: 15 }}>Are you sure? This can't be undone.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button onClick={() => setDelConfirm(null)} style={{ padding: "10px 20px", borderRadius: 8, background: "transparent", border: "1px solid #334155", color: "#94A3B8", cursor: "pointer", fontSize: 14 }}>Cancel</button>
            <button onClick={() => handleDelete(delConfirm)} style={{ padding: "10px 24px", borderRadius: 8, background: "linear-gradient(135deg,#EF4444,#F87171)", border: "none", color: "#FFF", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Login ── */
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = e => {
    e.preventDefault(); setLoading(true); setError("");
    setTimeout(() => {
      const u = USERS.find(u => u.email === email && u.password === password);
      if (u) onLogin(u); else setError("Invalid email or password");
      setLoading(false);
    }, 500);
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(145deg,#0B1120 0%,#162032 50%,#0F172A 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <div style={{ width: 420, background: "linear-gradient(180deg,#1E293B,#172033)", borderRadius: 20, border: "1px solid rgba(56,189,248,0.15)", padding: "48px 40px", boxShadow: "0 25px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          {I.logo}
          <span style={{ fontFamily: "'Space Mono',monospace", fontWeight: 700, fontSize: 22, color: "#F1F5F9" }}>BioLabs CRM</span>
        </div>
        <p style={{ color: "#64748B", fontSize: 14, marginBottom: 36, marginTop: 4 }}>Affiliate PayTrack + store clearing</p>
        <form onSubmit={submit}>
          <label style={{ display: "block", color: "#94A3B8", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"
            style={{ ...inp, marginBottom: 20 }}
            onFocus={e => e.target.style.borderColor = "#38BDF8"}
            onBlur={e => e.target.style.borderColor = "rgba(148,163,184,0.2)"} />
          <label style={{ display: "block", color: "#94A3B8", fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
            style={{ ...inp, marginBottom: 28 }}
            onFocus={e => e.target.style.borderColor = "#38BDF8"}
            onBlur={e => e.target.style.borderColor = "rgba(148,163,184,0.2)"} />
          {error && <div style={{ color: "#F87171", fontSize: 13, marginBottom: 16, padding: "8px 12px", background: "rgba(248,113,113,0.1)", borderRadius: 8 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width: "100%", padding: 13, background: loading ? "#1E3A5F" : "linear-gradient(135deg,#0EA5E9,#38BDF8)", color: "#FFF", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 20px rgba(14,165,233,0.3)" }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── App ── */
export default function App() {
  const [user, setUser] = useState(null);
  return user ? <Dashboard user={user} onLogout={() => setUser(null)} /> : <LoginScreen onLogin={setUser} />;
}

