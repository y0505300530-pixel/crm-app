/**
 * Transactional mail hook for quote notifications.
 *
 * No in-repo SMTP/CIO credentials. Configure one of:
 *   MAIL_WEBHOOK_URL + optional MAIL_WEBHOOK_TOKEN
 *   CIO_TRANSACTIONAL_URL + CIO_API_KEY
 *
 * If neither is set, the send is recorded as queued/none and the quote still persists.
 * Never log tokens, Authorization headers, or card data.
 */

export const QUOTE_NOTIFY_TO = "admin@biolabsresearch.co";

export function formatQuoteEmail(quote) {
  const customer = quote.customer || {};
  const items = Array.isArray(quote.items) ? quote.items : [];
  const lines = items.map((it) => {
    const qty = it.qty ?? it.quantity ?? 1;
    const sku = it.sku || "—";
    const name = it.name || sku;
    return `  - ${qty}× ${name} (${sku}) @ ${it.amount ?? ""}`;
  });
  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "—";
  const text = [
    "New storefront quote request (RUO / inquiry — not a payment).",
    "",
    `Quote ID: ${quote.id}`,
    `Idempotency: ${quote.idempotencyKey}`,
    `Amount: ${quote.amount} ${quote.currency || "USD"}`,
    "",
    "Contact:",
    `  Name: ${name}`,
    `  Email: ${customer.email || ""}`,
    `  Phone: ${customer.phone || ""}`,
    `  Address: ${[customer.address, customer.city, customer.state, customer.zip, customer.country].filter(Boolean).join(", ")}`,
    "",
    "Line items:",
    ...(lines.length ? lines : ["  (none)"]),
    "",
    `Notes: ${quote.notes || "(none)"}`,
    "",
    "CRM status: quote_requested / Not Contacted.",
    "Reply to the requester within one business day.",
  ].join("\n");

  return {
    to: QUOTE_NOTIFY_TO,
    subject: `Quote request ${quote.id} — ${quote.amount} ${quote.currency || "USD"}`,
    text,
  };
}

async function defaultTransport(message) {
  const url = process.env.MAIL_WEBHOOK_URL || process.env.CIO_TRANSACTIONAL_URL || "";
  const token = process.env.MAIL_WEBHOOK_TOKEN || process.env.CIO_API_KEY || "";
  if (!url) {
    return { ok: true, queued: true, transport: "none" };
  }
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      to: message.to,
      subject: message.subject,
      text: message.text,
      transactional: true,
    }),
  });
  if (!res.ok) {
    const err = new Error("mail_webhook_failed");
    err.status = res.status;
    throw err;
  }
  return { ok: true, queued: false, transport: "webhook" };
}

export async function sendQuoteNotification(quote, transport = defaultTransport) {
  const message = formatQuoteEmail(quote);
  return transport(message);
}
