import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createStore } from "./lib/store.js";
import { secretHealth } from "./lib/secrets.js";
import { chargeCart, ADAPTERS } from "./lib/cascade.js";
import { handleProcessorWebhook } from "./lib/webhooks.js";
import { pollPending, startPoller } from "./lib/poller.js";
import { createMockUmg } from "./lib/processors/umg.js";
import * as tagada from "./lib/processors/tagada.js";
import * as centrobill from "./lib/processors/centrobill.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const STORE_PATH = process.env.STORE_PATH || join(__dirname, "data", "store.json");
const DRY_RUN = process.env.UMG_DRY_RUN === "1" || process.env.UMG_DRY_RUN === "true";
const PUBLIC_URL = (process.env.CRM_PUBLIC_URL || "").replace(/\/$/, "");

const store = createStore({ filePath: STORE_PATH });

function liveAdapters() {
  if (DRY_RUN) {
    return { umg: createMockUmg({ scenario: "soft" }), tagada, centrobill };
  }
  return ADAPTERS;
}

startPoller(store, { intervalMs: Number(process.env.UMG_POLL_MS || 30000), adapters: liveAdapters() });

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-CRM-Role",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error("invalid_json")); }
    });
    req.on("error", reject);
  });
}

function callbackUrl() {
  const path = "/api/webhooks/umg";
  return PUBLIC_URL ? `${PUBLIC_URL}${path}` : path;
}

async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, X-CRM-Role",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    });
    return res.end();
  }

  try {
    if (path === "/api/health" && req.method === "GET") {
      return json(res, 200, {
        ok: true,
        dryRun: DRY_RUN,
        callbackUrl: callbackUrl(),
        ...secretHealth(),
      });
    }

    if (path === "/api/psp/health" && req.method === "GET") {
      return json(res, 200, {
        ok: true,
        service: "crm-umg",
        dryRun: DRY_RUN,
        callbackUrl: callbackUrl(),
        ...secretHealth(),
      });
    }

    if (path === "/api/psp/settings" && req.method === "GET") {
      return json(res, 200, {
        settings: store.getSettings(),
        health: { ...secretHealth(), dryRun: DRY_RUN, callbackUrl: callbackUrl() },
      });
    }

    if (path === "/api/psp/settings" && req.method === "PUT") {
      const body = await readBody(req);
      const settings = store.saveSettings(body.settings || body);
      return json(res, 200, { settings });
    }

    if (path === "/api/store-orders" && req.method === "GET") {
      return json(res, 200, { orders: store.listOrders() });
    }

    if (path.startsWith("/api/store-orders/") && req.method === "GET") {
      const id = decodeURIComponent(path.slice("/api/store-orders/".length));
      const order = store.getOrder(id);
      if (!order) return json(res, 404, { error: "not_found" });
      return json(res, 200, { order });
    }

    if (path === "/api/store-orders/poll" && req.method === "POST") {
      const results = await pollPending(store, { adapters: liveAdapters() });
      return json(res, 200, { results, orders: store.listOrders() });
    }

    if (path === "/api/checkout/charge" && req.method === "POST") {
      const body = await readBody(req);
      const result = await chargeCart(body, { store, adapters: liveAdapters() });
      return json(res, result.ok ? 200 : 402, result);
    }

    if (path === "/api/psp/dry-run" && req.method === "POST") {
      const body = await readBody(req);
      const scenario = body.scenario || "soft";
      const cards = {
        approved: "4242424242424242",
        soft: "4242424242420002",
        hard: "4111111111110003",
        timeout: "4242424242420005",
        pending: "4242424242420006",
      };
      const adapters = {
        umg: createMockUmg({ scenario }),
        tagada: {
          id: "tagada",
          async createPayment() {
            if (scenario === "soft" || scenario === "timeout") {
              return {
                ok: true,
                processor: "tagada",
                processorTxnId: "TG-MOCK-1",
                processorStatus: "APPROVED",
                httpStatus: 200,
                informationData: "",
                descriptor: "TAGADA-STUB",
                declineClass: null,
                cascadeAction: "success",
                reason: "approved",
                raw: { stub: true, note: "dry-run Tagada success after UMG soft/timeout" },
              };
            }
            return tagada.createPayment();
          },
        },
        centrobill,
      };
      const result = await chargeCart({
        idempotencyKey: body.idempotencyKey || `DRY-${Date.now()}`,
        amount: body.amount || "20.00",
        currency: "USD",
        customer: body.customer || {
          first_name: "Beverly",
          last_name: "Brower",
          email: "dry-run@biolabsresearch.co",
          address: "123 Coffee Berry Lane",
          country: "USA",
          state: "CA",
          city: "Anaheim",
          zip: "92803",
          phone: "8881234567",
          ip: "192.168.0.1",
          birthday: "1983-02-22",
        },
        items: body.items || [{ sku: "DRY-RUN", name: "CRM dry-run", qty: 1, amount: "20.00" }],
        card: { name: "Beverly Brower", number: cards[scenario] || cards.soft, month: "12", year: "28", cvv: "123" },
        notes: `CRM dry-run scenario=${scenario}`,
      }, {
        store,
        adapters,
        settings: {
          killSwitchPsp: null,
          processors: [
            { id: "umg", label: "UMG", enabled: true, priority: 1, mode: "sandbox" },
            { id: "tagada", label: "Tagada", enabled: true, priority: 2, mode: "sandbox" },
            { id: "centrobill", label: "Centrobill", enabled: true, priority: 3, mode: "sandbox" },
          ],
        },
      });
      return json(res, 200, result);
    }

    if (path === "/api/webhooks/umg" && req.method === "POST") {
      const body = await readBody(req);
      return json(res, 200, handleProcessorWebhook(store, "umg", body));
    }
    if (path === "/api/webhooks/tagada" && req.method === "POST") {
      const body = await readBody(req);
      return json(res, 200, handleProcessorWebhook(store, "tagada", body));
    }
    if (path === "/api/webhooks/centrobill" && req.method === "POST") {
      const body = await readBody(req);
      return json(res, 200, handleProcessorWebhook(store, "centrobill", body));
    }

    if (path === "/" || path === "/api") {
      return json(res, 200, { service: "biolabs-crm-psp", health: "/api/health" });
    }

    return json(res, 404, { error: "not_found" });
  } catch (err) {
    const message = err?.message === "invalid_json" ? "invalid_json" : "server_error";
    return json(res, message === "invalid_json" ? 400 : 500, { error: message });
  }
}

export function startCrmServer(port = PORT) {
  const server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const server = createServer(handler);
  server.listen(PORT, "0.0.0.0", () => {
    process.stdout.write(`crm-psp listening on :${PORT}\n`);
  });
}
