import { classifyDecline, classifyHttpFailure } from "../decline.js";
import { countryCode, detectCardType, expiryMonth, expiryYear2, formatAmount, phoneDigits } from "../card.js";
import { cardFingerprint, last4, stripSecrets } from "../sanitize.js";
import { loadUmgSecret, umgAuthorizationValue, umgBasicHeader } from "../secrets.js";

export const id = "umg";
export const label = "UMG";
export const CREATE_URL = "https://pay.umg.inc/rest/v1/transactions";

const DEFAULT_TIMEOUT_MS = 15000;

export function buildCreatePayload({ customer = {}, card = {}, amount, currency, extOrderId, vendor, subscriptionStatus, secret }) {
  const type = card.type || detectCardType(card.number);
  return {
    Authorization: secret ? umgAuthorizationValue(secret) : "[dry-run]",
    vendor: vendor || "BioLabs Research",
    userData: {
      first_name: customer.first_name || customer.firstName || "",
      last_name: customer.last_name || customer.lastName || "",
      email: customer.email || "",
      address: customer.address || customer.address1 || "",
      country: countryCode(customer.country),
      state: customer.state || "",
      city: customer.city || "",
      zip: customer.zip || customer.postal || "",
      phone: phoneDigits(customer.phone),
      ip: customer.ip || "127.0.0.1",
      birthday: customer.birthday || customer.birtdday || "1983-01-01",
    },
    cardData: {
      name: card.name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim(),
      type: String(type),
      number: String(card.number || "").replace(/\s+/g, ""),
      month: expiryMonth(card.month),
      year: expiryYear2(card.year),
      cvv: String(card.cvv || card.cvc || ""),
    },
    subscription_status: subscriptionStatus == null ? 0 : Number(subscriptionStatus),
    amount: formatAmount(amount),
    currency: currency || "USD",
    ext_order_id: String(extOrderId || "").slice(0, 100),
  };
}

function normalizeStatus(status) {
  const raw = String(status || "").trim();
  if (/app?roved/i.test(raw)) return "APPROVED";
  return raw.toUpperCase();
}

export function mapUmgResponse(body, httpStatus) {
  const status = normalizeStatus(body?.status);
  const informationData = body?.information_data || body?.informationData || "";
  const informationCode = body?.information_code || body?.informationCode || "";
  const classified = classifyDecline({
    status,
    informationData,
    informationCode,
    httpStatus,
  });
  return {
    ok: ["APPROVED", "CAPTURED"].includes(status),
    processor: id,
    processorTxnId: body?.id != null ? String(body.id) : null,
    processorStatus: status || "UNKNOWN",
    date: body?.date || null,
    extOrderId: body?.ext_order_id || body?.extOrderId || null,
    informationData,
    informationCode,
    descriptor: body?.descriptor || null,
    gatewayId: body?.gateway_id ?? body?.gatewayId ?? null,
    txid: body?.txid ?? null,
    httpStatus,
    cardLast4: last4(body?.card?.number) || "",
    declineClass: classified.declineClass,
    cascadeAction: classified.cascadeAction,
    reason: classified.reason,
    raw: stripSecrets(body || {}),
  };
}

async function requestJson(url, { method = "GET", headers = {}, body, timeoutMs, fetchImpl } = {}) {
  const fetchFn = fetchImpl || globalThis.fetch;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs || DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      method,
      headers,
      body,
      signal: ac.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { rawText: text.slice(0, 500) }; }
    return { httpStatus: res.status, body: json };
  } catch (err) {
    const message = err?.name === "AbortError" ? "timeout" : (err?.message || "network_error");
    return { httpStatus: null, body: null, errorMessage: message };
  } finally {
    clearTimeout(timer);
  }
}

export async function createPayment(input, deps = {}) {
  const secret = deps.secret !== undefined ? deps.secret : loadUmgSecret();
  if (!secret) {
    return {
      ok: false,
      processor: id,
      processorTxnId: null,
      processorStatus: "PROCESSOR_DOWN",
      httpStatus: null,
      informationData: "UMG_API_SECRET not loaded",
      informationCode: "",
      declineClass: "soft",
      cascadeAction: "next",
      reason: "processor_down",
      raw: {},
      cardLast4: last4(input?.card?.number),
    };
  }

  const payload = buildCreatePayload({ ...input, secret });
  const result = await requestJson(CREATE_URL, {
    method: "POST",
    headers: {
      Authorization: umgBasicHeader(secret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    timeoutMs: deps.timeoutMs,
    fetchImpl: deps.fetchImpl,
  });

  if (result.errorMessage || result.body == null) {
    const classified = classifyHttpFailure(result.httpStatus, result.errorMessage);
    return {
      ok: false,
      processor: id,
      processorTxnId: null,
      processorStatus: "PROCESSOR_DOWN",
      httpStatus: result.httpStatus,
      informationData: result.errorMessage || "empty_response",
      informationCode: "",
      declineClass: classified.declineClass,
      cascadeAction: "next",
      reason: classified.reason,
      raw: {},
      cardLast4: cardFingerprint(input.card).last4,
    };
  }

  return mapUmgResponse(result.body, result.httpStatus);
}

export function transactionUrl(txnId, secret) {
  const auth = umgAuthorizationValue(secret);
  return `${CREATE_URL}/${encodeURIComponent(String(txnId))}?Authorization=${encodeURIComponent(auth)}`;
}

export async function getTransaction(txnId, deps = {}) {
  const secret = deps.secret !== undefined ? deps.secret : loadUmgSecret();
  if (!secret || txnId == null) {
    return { ok: false, processor: id, processorStatus: "PROCESSOR_DOWN", reason: "missing_secret_or_id" };
  }
  const result = await requestJson(transactionUrl(txnId, secret), {
    method: "GET",
    timeoutMs: deps.timeoutMs,
    fetchImpl: deps.fetchImpl,
  });
  if (result.errorMessage || result.body == null) {
    const classified = classifyHttpFailure(result.httpStatus, result.errorMessage);
    return {
      ok: false,
      processor: id,
      processorTxnId: String(txnId),
      processorStatus: "PROCESSOR_DOWN",
      httpStatus: result.httpStatus,
      informationData: result.errorMessage || "empty_response",
      declineClass: classified.declineClass,
      cascadeAction: "wait",
      reason: classified.reason,
      raw: {},
    };
  }
  return mapUmgResponse(result.body, result.httpStatus);
}

export function createMockUmg({ scenario = "approved" } = {}) {
  return {
    id,
    label,
    async createPayment(input) {
      const last = last4(input?.card?.number);
      let chosen = scenario;
      if (last === "0002") chosen = "soft";
      if (last === "0003") chosen = "hard";
      if (last === "0005") chosen = "timeout";
      if (last === "0006") chosen = "pending";
      if (last === "4242" && scenario === "approved") chosen = "approved";

      if (chosen === "timeout") {
        return {
          ok: false,
          processor: id,
          processorTxnId: null,
          processorStatus: "PROCESSOR_DOWN",
          httpStatus: null,
          informationData: "timeout",
          informationCode: "",
          declineClass: "soft",
          cascadeAction: "next",
          reason: "timeout_or_network",
          raw: {},
          cardLast4: last,
        };
      }
      const bodies = {
        approved: { id: 9001, status: "APPROVED", date: "Sep 17, 2026 10:00:00 AM", information_data: "", descriptor: "PEPTIDESS SHOP", gateway_id: 7, txid: "TX-MOCK-OK", ext_order_id: input.extOrderId, card: { number: `424242****${last || "4242"}` } },
        soft: { id: 5136, status: "DECLINED", date: "Sep 17, 2026 10:48:13 AM", information_data: "Activity limit exceeded; Code:203", descriptor: "PEPTIDESS SHOP", gateway_id: 7, txid: null, ext_order_id: input.extOrderId, card: { number: `424242****${last || "4242"}` } },
        hard: { id: 5137, status: "DECLINED", date: "Sep 17, 2026 10:48:13 AM", information_data: "Do not honor / fraud", information_code: "05", descriptor: "PEPTIDESS SHOP", gateway_id: 7, txid: null, ext_order_id: input.extOrderId, card: { number: `411111****${last || "0003"}` } },
        pending: { id: 5138, status: "PENDING", date: "Sep 17, 2026 10:48:13 AM", information_data: "", descriptor: "PEPTIDESS SHOP", gateway_id: 7, txid: null, ext_order_id: input.extOrderId, card: { number: `424242****${last || "0006"}` } },
      };
      const http = chosen === "soft" || chosen === "hard" || chosen === "pending" || chosen === "approved" ? 201 : 201;
      return mapUmgResponse(bodies[chosen] || bodies.soft, http);
    },
    async getTransaction(txnId) {
      return mapUmgResponse({
        id: txnId,
        status: "APPROVED",
        date: "Sep 17, 2026 11:00:00 AM",
        information_data: "",
        descriptor: "PEPTIDESS SHOP",
        gateway_id: 7,
        txid: "TX-MOCK-POLL",
        ext_order_id: "poll",
      }, 200);
    },
  };
}
