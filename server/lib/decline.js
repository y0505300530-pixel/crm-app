const HARD_PATTERNS = [
  /fraud/i,
  /do[- ]?not[- ]?honor/i,
  /invalid card/i,
  /no such card/i,
  /stolen/i,
  /lost card/i,
  /pick.?up/i,
  /expired card/i,
  /invalid account/i,
  /invalid cvv/i,
  /invalid cvc/i,
  /security violation/i,
  /restricted card/i,
  /closed account/i,
  /pickup card/i,
  /card not supported/i,
  /declined.*invalid/i,
];

const SOFT_PATTERNS = [
  /timeout/i,
  /timed? out/i,
  /activity limit/i,
  /mid limits/i,
  /lowest ticket/i,
  /code:\s*203/i,
  /try again/i,
  /issuer unavailable/i,
  /system error/i,
  /processor[- ]?down/i,
  /unavailable/i,
  /insufficient/i,
  /do not try again/i, // keep after hard check — not used if hard already matched
  /network/i,
  /temporarily/i,
  /rate limit/i,
  /over limit/i,
];

const HARD_CODES = new Set([
  "04", "07", "14", "15", "41", "43", "54", "57", "62", "83", "R0", "R1", "R3",
  "N7", "14", "46",
]);

export function classifyHttpFailure(httpStatus, errorMessage = "") {
  const msg = String(errorMessage || "");
  if (/timeout|aborted|econnreset|enotfound|econnrefused|network/i.test(msg)) {
    return { declineClass: "soft", reason: "timeout_or_network" };
  }
  if (httpStatus == null) {
    return { declineClass: "soft", reason: "processor_down" };
  }
  if (httpStatus >= 500 || httpStatus === 429) {
    return { declineClass: "soft", reason: "http_5xx_or_429" };
  }
  if (httpStatus === 408) {
    return { declineClass: "soft", reason: "http_timeout" };
  }
  return { declineClass: "soft", reason: "http_error" };
}

export function classifyDecline({ status, informationData, informationCode, httpStatus, errorMessage } = {}) {
  const st = String(status || "").toUpperCase();
  if (["APPROVED", "CAPTURED", "SUCCESS"].includes(st)) {
    return { declineClass: null, reason: "approved", cascadeAction: "success" };
  }
  if (st.includes("3DS") || st === "PENDING" || st === "AWAITING FOR 3DS VERIFICATION") {
    return { declineClass: null, reason: "pending_or_3ds", cascadeAction: "wait" };
  }
  if (["CANCELED", "CANCELLED", "REFUNDED", "CHARGEBACK"].includes(st)) {
    return { declineClass: "hard", reason: "terminal_negative", cascadeAction: "stop" };
  }

  const blob = `${informationData || ""} ${informationCode || ""} ${errorMessage || ""}`;
  const code = String(informationCode || "").replace(/^0+/, "") || String(informationCode || "");

  if (HARD_PATTERNS.some((re) => re.test(blob)) || HARD_CODES.has(String(informationCode || "")) || HARD_CODES.has(code)) {
    return { declineClass: "hard", reason: "hard_decline", cascadeAction: "stop" };
  }
  if (SOFT_PATTERNS.some((re) => re.test(blob))) {
    return { declineClass: "soft", reason: "soft_decline", cascadeAction: "next" };
  }
  if (httpStatus && (httpStatus >= 500 || httpStatus === 408 || httpStatus === 429)) {
    return { declineClass: "soft", reason: "http_5xx_or_timeout", cascadeAction: "next" };
  }
  if (errorMessage) {
    const http = classifyHttpFailure(httpStatus, errorMessage);
    return { ...http, cascadeAction: "next" };
  }
  if (st === "DECLINED") {
    return { declineClass: "soft", reason: "generic_decline", cascadeAction: "next" };
  }
  return { declineClass: "soft", reason: "unknown", cascadeAction: "next" };
}
