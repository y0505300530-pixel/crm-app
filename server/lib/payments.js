export function isPaymentsEnabled(env = process.env) {
  const v = String(env.PAYMENTS_ENABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function paymentsMode(env = process.env) {
  return isPaymentsEnabled(env) ? "pay" : "quote";
}

export function paymentsDisabledBody() {
  return { ok: false, error: "payments_disabled", mode: "quote" };
}
