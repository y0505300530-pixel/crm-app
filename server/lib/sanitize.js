const CARD_KEYS = new Set([
  "number", "cardnumber", "card_number", "pan", "cvv", "cvc", "cvv2",
  "security_code", "authorization", "api_key", "key", "secret",
]);

export function last4(number) {
  const digits = String(number || "").replace(/\D/g, "");
  return digits ? digits.slice(-4) : "";
}

export function maskPan(number) {
  const digits = String(number || "").replace(/\D/g, "");
  if (digits.length < 8) return digits ? "****" : "";
  return `${digits.slice(0, 6)}${"*".repeat(Math.max(4, digits.length - 10))}${digits.slice(-4)}`;
}

export function stripSecrets(value, depth = 0) {
  if (value == null || depth > 8) return value;
  if (Array.isArray(value)) return value.map((v) => stripSecrets(v, depth + 1));
  if (typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const key = k.toLowerCase();
    if (CARD_KEYS.has(key) || key.includes("secret") || key.includes("api_key")) {
      if (key === "number" || key === "cardnumber" || key === "card_number" || key === "pan") {
        out[k] = maskPan(v);
      } else {
        out[k] = "[redacted]";
      }
      continue;
    }
    out[k] = stripSecrets(v, depth + 1);
  }
  return out;
}

export function cardFingerprint(card = {}) {
  return {
    name: card.name || "",
    last4: last4(card.number),
    brand: card.brand || "",
    type: card.type || "",
    month: card.month ? String(card.month) : "",
    year: card.year ? String(card.year).slice(-2) : "",
  };
}
