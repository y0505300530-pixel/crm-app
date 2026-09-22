import { createHmac } from "node:crypto";

export const id = "cleffo";
export const label = "Cleffo";

/** Dev host only. Live Cleffo / Stripe hosts are refused. */
export const SANDBOX_HOST = "apis-dev.cleffo.com";
export const DEFAULT_BASE_URL = "https://apis-dev.cleffo.com";

/**
 * TODO(bryan-3ds): Public Cleffo docs do not separate 2D vs 3DS test cards.
 * Soft-QA screenshots must use the scenarios Bryan provides. Do not invent PANs.
 */
export const CARD_SCENARIO_TODO = "bryan_2d_3ds_scenarios_required";

export const DOCUMENTED_STATUSES = Object.freeze(["pending", "completed", "failed"]);

/** $10 RUO catalog line. Catalog code only — no INN. */
export const SANDBOX_PRODUCT = Object.freeze({
  product_id: "g3-r-10mg",
  name: "G3-R",
  qty: 1,
  price: 10,
  image_url: "https://biolabsresearch.co/media/vial-g3-r.png",
});

export const SANDBOX_PHONE = "12025550100";
const DEFAULT_TIMEOUT_MS = 15000;

export function digitsOnlyPhone(phone) {
  return String(phone ?? "").replace(/\D/g, "");
}

export function assertSandboxBaseUrl(baseUrl) {
  let url;
  try {
    url = new URL(String(baseUrl || ""));
  } catch {
    throw new Error("cleffo_sandbox_host_required");
  }
  if (url.protocol !== "https:" || url.hostname !== SANDBOX_HOST || url.username || url.password) {
    throw new Error("cleffo_sandbox_host_required");
  }
  return url.origin;
}

export function resolveCleffoConfig(deps = {}) {
  const env = deps.env || process.env;
  return {
    baseUrl: String(deps.baseUrl ?? env.CLEFFO_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    clientKey: String(deps.clientKey ?? env.CLEFFO_CLIENT_KEY ?? ""),
    signatureKey: String(deps.signatureKey ?? env.CLEFFO_SIGNATURE_KEY ?? ""),
    apiKey: String(deps.apiKey ?? env.CLEFFO_API_KEY ?? ""),
  };
}

export function defaultRedirectUrl(env = process.env) {
  const explicit = String(env.CLEFFO_REDIRECT_URL || "").trim();
  if (/^https:\/\//.test(explicit)) return explicit;
  const pub = String(env.CRM_PUBLIC_URL || "https://crm.biolabsresearch.co").replace(/\/$/, "");
  return `${pub}/api/psp/cleffo/sandbox/return`;
}

export function sandboxTenDollarInput(overrides = {}, env = process.env) {
  const merchant_order_id = String(
    overrides.merchantOrderId || overrides.merchant_order_id || `CLEFFO-QA-${Date.now()}`,
  ).trim().slice(0, 64);
  const redirect = String(overrides.redirectUrl || overrides.redirect_url || "").trim();
  return {
    merchant_order_id,
    customer: {
      name: "Soft QA",
      email: "soft-qa@biolabsresearch.co",
      phone: SANDBOX_PHONE,
    },
    products: [{ ...SANDBOX_PRODUCT }],
    currency: "USD",
    tax: 0,
    redirect_url: /^https:\/\//.test(redirect) ? redirect : defaultRedirectUrl(env),
  };
}

function moneyCents(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`invalid_${label}`);
  return Math.round(n * 100);
}

function moneyJson(cents) {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/**
 * Live 400 on POST /api/payment-link (apis-dev.cleffo.com):
 * data.merchant_order_id
 * data.customer_detail.name / email / phone_no (digits only)
 * data.products[] with product_id
 * data.price.sub_total / tax / total / currency  (sub_total + tax = total)
 * metadata.redirect_url (not top-level), metadata.source = "api"
 * cleffo_client_key in metadata and at the top level
 * Product image field is not fully confirmed — send image_url and image.
 * Key order is part of the HMAC (exact body bytes).
 */
export function buildPaymentLinkBody(input, config) {
  if (!input || typeof input !== "object") throw new Error("invalid_payment_link");
  if (input.card || input.pan || input.cvv || input.cvc) throw new Error("card_not_accepted");
  const productsIn = Array.isArray(input.products) ? input.products : (input.data?.products || []);
  if (productsIn.length === 0) throw new Error("products_required");
  const products = productsIn.map((p) => {
    const product_id = String(p.product_id || "").trim();
    if (!product_id) throw new Error("product_id_required");
    const name = String(p.name || "").trim();
    if (!name) throw new Error("product_name_required");
    const qty = Number(p.qty);
    if (!Number.isInteger(qty) || qty < 1) throw new Error("product_qty_required");
    const priceCents = moneyCents(p.price, "price");
    if (priceCents < 0) throw new Error("invalid_price");
    const image_url = String(p.image_url || p.image || "").trim();
    const image = String(p.image || p.image_url || "").trim();
    if (!/^https:\/\//.test(image_url) || !/^https:\/\//.test(image)) throw new Error("product_image_url_required");
    return { product_id, name, qty, priceCents, image_url, image };
  });
  const subTotalCents = products.reduce((sum, p) => sum + p.qty * p.priceCents, 0);
  const taxSource = input.tax ?? input.data?.price?.tax ?? 0;
  const taxCents = moneyCents(taxSource, "tax");
  if (taxCents < 0) throw new Error("invalid_tax");
  const expectedTotal = subTotalCents + taxCents;
  const totalSource = input.total ?? input.data?.price?.total;
  const totalCents = totalSource == null ? expectedTotal : moneyCents(totalSource, "total");
  if (totalCents !== expectedTotal) throw new Error("amount_mismatch");
  const detail = input.customer || input.customer_detail || input.data?.customer_detail || {};
  const phone = digitsOnlyPhone(detail.phone_no ?? detail.phone ?? input.phone);
  if (phone.length < 10 || phone.length > 15) throw new Error("phone_digits_required");
  const merchant_order_id = String(
    input.merchant_order_id || input.data?.merchant_order_id || input.orderId || "",
  ).trim();
  if (!merchant_order_id) throw new Error("merchant_order_id_required");
  const customer_name = String(
    detail.name
    || [detail.first_name, detail.last_name].filter(Boolean).join(" ")
    || "",
  ).trim();
  const customer_email = String(detail.email || "").trim();
  if (!customer_name) throw new Error("customer_name_required");
  if (!customer_email.includes("@")) throw new Error("customer_email_required");
  const currency = String(input.currency || input.data?.price?.currency || "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency_required");
  const redirect_url = String(
    input.redirect_url || input.metadata?.redirect_url || "",
  ).trim();
  if (!/^https:\/\//.test(redirect_url)) throw new Error("redirect_url_required");
  if (!config?.clientKey) throw new Error("cleffo_client_key_missing");
  return {
    merchant_order_id,
    customer_name,
    customer_email,
    phone_no: phone,
    products,
    subTotalCents,
    taxCents,
    totalCents,
    currency,
    redirect_url,
    cleffo_client_key: config.clientKey,
  };
}

/** Exact JSON bytes that are signed and sent. Money is a JSON number with 2 decimals. */
export function serializePaymentLinkBody(body) {
  const products = body.products.map((p) => (
    "{"
    + `"product_id":${JSON.stringify(p.product_id)},`
    + `"name":${JSON.stringify(p.name)},`
    + `"qty":${p.qty},`
    + `"price":${moneyJson(p.priceCents)},`
    + `"image_url":${JSON.stringify(p.image_url)},`
    + `"image":${JSON.stringify(p.image)}`
    + "}"
  )).join(",");
  const key = JSON.stringify(body.cleffo_client_key);
  return "{"
    + `"data":{`
    + `"merchant_order_id":${JSON.stringify(body.merchant_order_id)},`
    + `"customer_detail":{`
    + `"name":${JSON.stringify(body.customer_name)},`
    + `"email":${JSON.stringify(body.customer_email)},`
    + `"phone_no":${JSON.stringify(body.phone_no)}`
    + `},`
    + `"products":[${products}],`
    + `"price":{`
    + `"sub_total":${moneyJson(body.subTotalCents)},`
    + `"tax":${moneyJson(body.taxCents)},`
    + `"total":${moneyJson(body.totalCents)},`
    + `"currency":${JSON.stringify(body.currency)}`
    + `}`
    + `},`
    + `"metadata":{`
    + `"redirect_url":${JSON.stringify(body.redirect_url)},`
    + `"source":"api",`
    + `"cleffo_client_key":${key}`
    + `},`
    + `"cleffo_client_key":${key}`
    + "}";
}

/** HMAC-SHA256 hex of the exact body bytes (PHP hash_hmac sha256 default). */
export function signBody(rawBody, signatureKey) {
  return createHmac("sha256", String(signatureKey)).update(Buffer.from(String(rawBody), "utf8")).digest("hex");
}

export function redactSecrets(value, secrets) {
  let text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  for (const secret of secrets || []) {
    if (secret && String(secret).length >= 4) text = text.split(String(secret)).join("[redacted]");
  }
  return text;
}

function redactValue(value, secrets) {
  if (typeof value === "string") return redactSecrets(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, secrets));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = redactValue(item, secrets);
    return out;
  }
  return value;
}

function failure(error, httpStatus, extra = {}) {
  return {
    ok: false,
    sandbox: true,
    checkout: false,
    processor: id,
    error,
    httpStatus: httpStatus ?? null,
    payment_link: null,
    transaction_reference_number: null,
    merchant_order_id: null,
    payment_source: null,
    ...extra,
  };
}

async function readJsonResponse(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { rawText: text.slice(0, 300) };
  }
}

function parseCreateData(httpStatus, body) {
  const data = body?.data && typeof body.data === "object" ? body.data : {};
  const payment_link = typeof data.payment_link === "string" ? data.payment_link : null;
  const transaction_reference_number = typeof data.transaction_reference_number === "string"
    ? data.transaction_reference_number
    : null;
  const merchant_order_id = typeof data.merchant_order_id === "string" ? data.merchant_order_id : null;
  const payment_source = typeof data.payment_source === "string" ? data.payment_source : null;
  const envelopeOk = body?.status !== false && httpStatus === 200;
  const ok = envelopeOk
    && Boolean(payment_link)
    && Boolean(transaction_reference_number)
    && Boolean(merchant_order_id)
    && payment_source === "api";
  return {
    ok,
    sandbox: true,
    checkout: false,
    processor: id,
    httpStatus,
    payment_link,
    transaction_reference_number,
    merchant_order_id,
    payment_source,
    error: ok ? null : "cleffo_create_rejected",
    errors: body?.errors || null,
  };
}

export function mapCleffoStatus(body, httpStatus) {
  const data = body?.data && typeof body.data === "object" ? body.data : {};
  const candidate = typeof data.status === "string"
    ? data.status
    : (typeof data.payment_status === "string" ? data.payment_status : "");
  const status = String(candidate || "").trim().toLowerCase();
  const known = DOCUMENTED_STATUSES.includes(status);
  return {
    ok: httpStatus === 200 && known && body?.status !== false,
    sandbox: true,
    checkout: false,
    processor: id,
    httpStatus,
    status: known ? status : "unknown",
    // Redirect query strings are never consulted. Only this status poll can be success.
    success: status === "completed",
    pending: status === "pending",
    failed: status === "failed",
    transaction_reference_number: typeof data.transaction_reference_number === "string"
      ? data.transaction_reference_number
      : null,
    payment_link: typeof data.payment_link === "string" ? data.payment_link : null,
    error: httpStatus === 200 && known ? null : "cleffo_status_rejected",
  };
}

async function request(url, { method, headers, body, timeoutMs, fetchImpl }) {
  const fetchFn = fetchImpl || globalThis.fetch;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs || DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, { method, headers, body, signal: ac.signal });
    const json = await readJsonResponse(res);
    return { httpStatus: res.status, body: json };
  } catch (err) {
    const message = err?.name === "AbortError" ? "timeout" : "network_error";
    return { httpStatus: null, body: null, errorMessage: message };
  } finally {
    clearTimeout(timer);
  }
}

export async function createPaymentLink(input, deps = {}) {
  const config = resolveCleffoConfig(deps);
  let origin;
  try {
    origin = assertSandboxBaseUrl(config.baseUrl);
  } catch {
    return failure("cleffo_sandbox_host_required", 503);
  }
  if (!config.clientKey || !config.signatureKey || !config.apiKey) {
    return failure("cleffo_sandbox_not_configured", 503);
  }
  let raw;
  try {
    raw = serializePaymentLinkBody(buildPaymentLinkBody(input, config));
  } catch (err) {
    return failure(err?.message || "invalid_payment_link", 400);
  }
  const signature = signBody(raw, config.signatureKey);
  const result = await request(`${origin}/api/payment-link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": config.apiKey,
      "x-signature": signature,
    },
    body: raw,
    timeoutMs: deps.timeoutMs,
    fetchImpl: deps.fetchImpl,
  });
  if (result.errorMessage || result.body == null) {
    return failure(result.errorMessage || "cleffo_unreachable", 502);
  }
  const parsed = parseCreateData(result.httpStatus, result.body);
  const secrets = [config.clientKey, config.signatureKey, config.apiKey];
  if (parsed.errors) parsed.errors = redactValue(parsed.errors, secrets);
  return parsed;
}

export async function getPaymentStatus(transactionReferenceNumber, deps = {}) {
  const config = resolveCleffoConfig(deps);
  let origin;
  try {
    origin = assertSandboxBaseUrl(config.baseUrl);
  } catch {
    return failure("cleffo_sandbox_host_required", 503);
  }
  if (!config.apiKey) return failure("cleffo_sandbox_not_configured", 503);
  const ref = String(transactionReferenceNumber || "").trim();
  if (!ref || ref.includes("/") || ref.includes("..")) return failure("transaction_reference_required", 400);
  const result = await request(`${origin}/api/payment-link/${encodeURIComponent(ref)}/status`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "x-api-key": config.apiKey,
    },
    timeoutMs: deps.timeoutMs,
    fetchImpl: deps.fetchImpl,
  });
  if (result.errorMessage || result.body == null) {
    return failure(result.errorMessage || "cleffo_unreachable", 502);
  }
  const mapped = mapCleffoStatus(result.body, result.httpStatus);
  if (!mapped.transaction_reference_number) mapped.transaction_reference_number = ref;
  return mapped;
}

export function publicCleffoView(result) {
  const view = {
    ok: Boolean(result?.ok),
    sandbox: true,
    checkout: false,
    payment_link: result?.payment_link || null,
    transaction_reference_number: result?.transaction_reference_number || null,
    merchant_order_id: result?.merchant_order_id || null,
    payment_source: result?.payment_source || null,
    note: "Redirect is not payment success. Poll status: pending | completed | failed. 2D vs 3DS cards: use Bryan's scenarios.",
    cardScenarioTodo: CARD_SCENARIO_TODO,
  };
  if (result?.status) view.status = result.status;
  if (result && Object.prototype.hasOwnProperty.call(result, "success")) view.success = result.success === true;
  if (!view.ok && result?.error) view.error = result.error;
  if (!view.ok && result?.errors) view.errors = result.errors;
  return view;
}

/** Cascade entry. Refuses card charges so Cleffo cannot replace UMG checkout. */
export async function createPayment() {
  return {
    ok: false,
    processor: id,
    processorTxnId: null,
    processorStatus: "SANDBOX_ONLY",
    httpStatus: 403,
    informationData: "Cleffo sandbox payment links are not storefront checkout",
    informationCode: "",
    declineClass: "soft",
    cascadeAction: "next",
    reason: "cleffo_not_checkout",
    raw: { sandboxOnly: true },
  };
}

export async function getTransaction() {
  return {
    ok: false,
    processor: id,
    processorStatus: "SANDBOX_ONLY",
    cascadeAction: "wait",
    reason: "cleffo_not_checkout",
    raw: { sandboxOnly: true },
  };
}
