/**
 * Storefront CORS allowlist for public checkout APIs.
 *
 * Never emit Access-Control-Allow-Origin: *. Reflect the request Origin only
 * when it is an exact match in the allowlist. Staff/admin paths get no browser CORS.
 *
 * Override via CORS_STOREFRONT_ORIGINS (comma-separated). Empty/unset → defaults.
 */

export const DEFAULT_STOREFRONT_ORIGINS = Object.freeze([
  "https://biolabsresearch.co",
  "https://www.biolabsresearch.co",
  "https://blrcommerce.io",
  "https://www.blrcommerce.io",
]);

export function storefrontOrigins(env = process.env) {
  const raw = env.CORS_STOREFRONT_ORIGINS;
  if (raw == null || String(raw).trim() === "") {
    return [...DEFAULT_STOREFRONT_ORIGINS];
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Public storefront-facing checkout routes only (charge, quote, abandon, …). */
export function isStorefrontApiPath(path) {
  return path === "/api/checkout" || path.startsWith("/api/checkout/");
}

/**
 * CORS response headers for a request. Empty object when:
 * - path is not a storefront checkout API, or
 * - Origin is missing / not on the allowlist.
 * Never returns "*".
 */
export function corsHeadersForRequest(req, path, env = process.env) {
  if (!isStorefrontApiPath(path)) return {};

  const origin = req?.headers?.origin;
  if (!origin || typeof origin !== "string") return {};

  const allowed = storefrontOrigins(env);
  if (!allowed.includes(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}
