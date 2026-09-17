import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const PROCESSOR_IDS = ["umg", "tagada", "centrobill"];

export function defaultSettings() {
  return {
    killSwitchPsp: null,
    processors: [
      { id: "umg", label: "UMG", enabled: true, priority: 1, mode: "sandbox" },
      { id: "tagada", label: "Tagada", enabled: false, priority: 2, mode: "off" },
      { id: "centrobill", label: "Centrobill", enabled: false, priority: 3, mode: "off" },
    ],
  };
}

function emptyData() {
  return { settings: defaultSettings(), orders: [], seq: 1000 };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createStore(opts = {}) {
  const memoryOnly = opts.memoryOnly === true;
  const filePath = opts.filePath || null;
  let data = emptyData();

  if (!memoryOnly && filePath && existsSync(filePath)) {
    try {
      const parsed = JSON.parse(readFileSync(filePath, "utf8"));
      data = {
        settings: { ...defaultSettings(), ...(parsed.settings || {}) },
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        seq: Number(parsed.seq) || 1000,
      };
      if (!Array.isArray(data.settings.processors) || data.settings.processors.length === 0) {
        data.settings.processors = defaultSettings().processors;
      }
    } catch {
      data = emptyData();
    }
  }

  function persist() {
    if (memoryOnly || !filePath) return;
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  return {
    getSettings() {
      return clone(data.settings);
    },
    saveSettings(next) {
      const incoming = next && typeof next === "object" ? next : {};
      const processors = Array.isArray(incoming.processors)
        ? incoming.processors
        : data.settings.processors;
      const normalized = processors
        .filter((p) => PROCESSOR_IDS.includes(p.id))
        .map((p, i) => ({
          id: p.id,
          label: p.label || p.id,
          enabled: Boolean(p.enabled),
          priority: Number(p.priority) || i + 1,
          mode: ["live", "sandbox", "off"].includes(p.mode) ? p.mode : "off",
        }));
      for (const id of PROCESSOR_IDS) {
        if (!normalized.some((p) => p.id === id)) {
          const fallback = defaultSettings().processors.find((p) => p.id === id);
          normalized.push(fallback);
        }
      }
      let kill = incoming.killSwitchPsp ?? data.settings.killSwitchPsp;
      if (kill === "" || kill === "none") kill = null;
      if (kill && !PROCESSOR_IDS.includes(kill)) kill = null;
      data.settings = { killSwitchPsp: kill, processors: normalized };
      persist();
      return clone(data.settings);
    },
    listOrders() {
      return clone(data.orders).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    },
    getOrder(id) {
      const order = data.orders.find((o) => o.id === id);
      return order ? clone(order) : null;
    },
    getOrderByIdempotency(key) {
      if (!key) return null;
      const order = data.orders.find((o) => o.idempotencyKey === key);
      return order ? clone(order) : null;
    },
    nextOrderId() {
      data.seq += 1;
      persist();
      return `BLR-${data.seq}`;
    },
    upsertOrder(order) {
      const idx = data.orders.findIndex((o) => o.id === order.id);
      const copy = clone(order);
      if (idx === -1) data.orders.push(copy);
      else data.orders[idx] = copy;
      persist();
      return clone(copy);
    },
    findAttempt(processor, processorTxnId) {
      if (processorTxnId == null || processorTxnId === "") return null;
      const want = String(processorTxnId);
      for (const order of data.orders) {
        const attempt = (order.attempts || []).find(
          (a) => a.processor === processor && String(a.processorTxnId) === want,
        );
        if (attempt) return { order: clone(order), attempt: clone(attempt) };
      }
      return null;
    },
    pendingAttempts(processor) {
      const out = [];
      for (const order of data.orders) {
        for (const attempt of order.attempts || []) {
          const st = String(attempt.processorStatus || "").toUpperCase();
          if (attempt.processor === processor && (st === "PENDING" || st.includes("3DS"))) {
            out.push({ orderId: order.id, attempt: clone(attempt) });
          }
        }
      }
      return out;
    },
    snapshot() {
      return clone(data);
    },
  };
}
