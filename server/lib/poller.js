import { applyProcessorUpdate } from "./cascade.js";
import { ADAPTERS } from "./cascade.js";

export async function pollPending(store, deps = {}) {
  const adapters = deps.adapters || ADAPTERS;
  const processors = deps.processors || ["umg"];
  const results = [];
  for (const processor of processors) {
    const adapter = adapters[processor];
    if (!adapter || typeof adapter.getTransaction !== "function") continue;
    const pending = store.pendingAttempts(processor);
    for (const { attempt } of pending) {
      if (!attempt.processorTxnId) continue;
      try {
        const fresh = await adapter.getTransaction(attempt.processorTxnId, deps.processorDeps?.[processor] || {});
        const order = applyProcessorUpdate(store, {
          processor,
          processorTxnId: attempt.processorTxnId,
          status: fresh.processorStatus,
          body: fresh.raw || fresh,
        });
        results.push({
          processor,
          processorTxnId: attempt.processorTxnId,
          status: fresh.processorStatus,
          orderId: order?.id || null,
        });
      } catch (err) {
        results.push({
          processor,
          processorTxnId: attempt.processorTxnId,
          error: err?.message || "poll_failed",
        });
      }
    }
  }
  return results;
}

export function startPoller(store, { intervalMs = 30000, adapters } = {}) {
  const timer = setInterval(() => {
    pollPending(store, { adapters }).catch(() => {});
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  return () => clearInterval(timer);
}
