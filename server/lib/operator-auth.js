import { timingSafeEqual } from "node:crypto";

/**
 * Operator gate for UMG read/admin routes.
 *
 * Accept either:
 *   - X-Marketing-Key equal to MARKETING_DIGEST_KEY (timing-safe), or
 *   - Authorization: Bearer <CRM session> checked against blitz-api
 *     (GET ${CRM_AUTH_URL||http://127.0.0.1:3001}${CRM_SESSION_PATH||/api/session}).
 *
 * Leads-digest uses the marketing key only — see marketingDigestKeyOk.
 * X-CRM-Role is not a secret and is never accepted.
 * Missing key, wrong key, or an unreachable session authority → not authorized.
 */

export function headerValue(req, name) {
  const want = String(name || "").toLowerCase();
  const headers = req?.headers || {};
  const raw = headers[want];
  if (Array.isArray(raw)) return String(raw[0] || "");
  return raw == null ? "" : String(raw);
}

export function bearerToken(req) {
  const h = headerValue(req, "authorization").trim();
  const m = /^Bearer\s+(\S+)/i.exec(h);
  return m ? m[1] : "";
}

export function secretsEqual(a, b) {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  if (left.length === 0 || right.length === 0) return false;
  const max = Math.max(left.length, right.length);
  const padL = Buffer.alloc(max);
  const padR = Buffer.alloc(max);
  left.copy(padL);
  right.copy(padR);
  return timingSafeEqual(padL, padR) && left.length === right.length;
}

export function marketingDigestKeyOk(req, env = process.env) {
  const expected = String(env.MARKETING_DIGEST_KEY || "");
  if (!expected) return false;
  return secretsEqual(headerValue(req, "x-marketing-key").trim(), expected);
}

export function sessionBodyOk(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (data.user && typeof data.user === "object") {
    const user = data.user;
    return Boolean(user.email || user.role || user.id || user.name);
  }
  if (typeof data.email === "string" && data.email.includes("@")) return true;
  if (data.role === "admin" || data.role === "staff") return true;
  return false;
}

export async function defaultCrmSessionCheck(token, opts = {}) {
  const env = opts.env || process.env;
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const base = String(env.CRM_AUTH_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
  const path = String(env.CRM_SESSION_PATH || "/api/session");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const timeoutMs = Number(env.CRM_AUTH_TIMEOUT_MS || 800);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 800);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });
    if (!res || !res.ok) return false;
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return sessionBodyOk(data);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function operatorAuthorized(req, opts = {}) {
  const env = opts.env || process.env;
  if (marketingDigestKeyOk(req, env)) return true;
  const token = bearerToken(req);
  if (!token) return false;
  if (typeof opts.checkCrmSession === "function") {
    try {
      return Boolean(await opts.checkCrmSession(token));
    } catch {
      return false;
    }
  }
  return defaultCrmSessionCheck(token, opts);
}
