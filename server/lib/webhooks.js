import { applyProcessorUpdate } from "./cascade.js";

export function readWebhookIds(body = {}) {
  const id = body.ID ?? body.id ?? body.Id ?? body.transaction_id ?? body.transactionId;
  const status = body.Status ?? body.status ?? body.STATUS;
  return {
    processorTxnId: id != null ? String(id) : null,
    status: status != null ? String(status) : null,
  };
}

export function handleProcessorWebhook(store, processor, body) {
  const { processorTxnId, status } = readWebhookIds(body);
  if (!processorTxnId) {
    return { ok: false, error: "missing_transaction_id" };
  }
  const order = applyProcessorUpdate(store, { processor, processorTxnId, status, body });
  if (!order) {
    return { ok: false, error: "unknown_transaction", processorTxnId };
  }
  return { ok: true, orderId: order.id, status: order.status, processorStatus: status };
}
