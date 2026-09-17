export const id = "tagada";
export const label = "Tagada";

function stubResult(action, extra = {}) {
  return {
    ok: false,
    processor: id,
    processorTxnId: null,
    processorStatus: "PROCESSOR_DOWN",
    httpStatus: 503,
    informationData: "Tagada adapter is a stub — not wired yet",
    informationCode: "",
    declineClass: "soft",
    cascadeAction: action,
    reason: "processor_down",
    raw: { stub: true },
    ...extra,
  };
}

export async function createPayment() {
  return stubResult("next");
}

export async function getTransaction() {
  return stubResult("wait");
}
