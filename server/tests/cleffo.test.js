import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { chargeCart, resolveQueue } from "../lib/cascade.js";
import { createStore, defaultSettings } from "../lib/store.js";
import { createMockUmg } from "../lib/processors/umg.js";
import { startCrmServer } from "../index.js";
import {
  buildPaymentLinkBody,
  createPayment,
  createPaymentLink,
  getPaymentStatus,
  mapCleffoStatus,
  resolveCleffoConfig,
  sandboxTenDollarInput,
  serializePaymentLinkBody,
  signBody,
} from "../lib/processors/cleffo.js";
import { formatSoftQaOutput, outputLeaksSecrets, runSoftQa } from "../scripts/cleffo-soft-qa.js";

const KEYS = {
  baseUrl: "https://apis-dev.cleffo.com",
  clientKey: "client-key-sandbox",
  signatureKey: "signature-key-sandbox",
  apiKey: "api-key-sandbox",
};

function deps(fetchImpl, extra = {}) {
  return { ...KEYS, fetchImpl, ...extra };
}

test("HMAC covers the exact JSON bytes, phone is digits, product_id is present, amounts match", () => {
  const body = buildPaymentLinkBody({
    ...sandboxTenDollarInput({ merchantOrderId: "CLEFFO-QA-1" }),
    customer: { name: "Soft QA", email: "soft-qa@biolabsresearch.co", phone: "+1 (202) 555-0100" },
  }, KEYS);
  const raw = serializePaymentLinkBody(body);
  const sig = signBody(raw, KEYS.signatureKey);
  assert.equal(sig, createHmac("sha256", KEYS.signatureKey).update(Buffer.from(raw, "utf8")).digest("hex"));
  assert.notEqual(signBody(`${raw} `, KEYS.signatureKey), sig);
  assert.equal(raw.includes("+"), false);
  assert.match(raw, /"customer_phone":"12025550100"/);
  assert.match(raw, /"product_id":"g3-r-10mg"/);
  assert.match(raw, /"name":"G3-R"/);
  assert.match(raw, /"price":10\.00/);
  assert.match(raw, /"product_sum":10\.00/);
  assert.match(raw, /"tax":0\.00/);
  assert.match(raw, /"total":10\.00/);
  assert.match(raw, /"metadata":\{"source":"api"\}/);
  assert.match(raw, /"cleffo_client_key":"client-key-sandbox"/);
  assert.equal(raw.includes("reta"), false);
  assert.throws(() => buildPaymentLinkBody({
    ...sandboxTenDollarInput(),
    products: [{ name: "G3-R", qty: 1, price: 10, image_url: "https://biolabsresearch.co/media/vial-g3-r.png" }],
  }, KEYS), /product_id_required/);
});

test("createPaymentLink signs the bytes it sends and reads the confirmed data fields", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return {
      status: 200,
      async text() {
        return JSON.stringify({
          status: true,
          data: {
            payment_link: "https://pay.sandbox.example/link/abc",
            transaction_reference_number: "TXN-REF-1",
            merchant_order_id: "CLEFFO-QA-9",
            payment_source: "api",
          },
        });
      },
    };
  };
  const result = await createPaymentLink(sandboxTenDollarInput({ merchantOrderId: "CLEFFO-QA-9" }), deps(fetchImpl));
  assert.equal(result.ok, true);
  assert.equal(result.payment_link, "https://pay.sandbox.example/link/abc");
  assert.equal(result.transaction_reference_number, "TXN-REF-1");
  assert.equal(result.merchant_order_id, "CLEFFO-QA-9");
  assert.equal(result.payment_source, "api");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://apis-dev.cleffo.com/api/payment-link");
  assert.equal(calls[0].opts.headers["x-api-key"], KEYS.apiKey);
  assert.equal(calls[0].opts.headers["Content-Type"], "application/json");
  assert.equal(
    calls[0].opts.headers["x-signature"],
    createHmac("sha256", KEYS.signatureKey).update(Buffer.from(calls[0].opts.body, "utf8")).digest("hex"),
  );
  assert.equal(calls[0].opts.body, serializePaymentLinkBody(buildPaymentLinkBody(
    sandboxTenDollarInput({ merchantOrderId: "CLEFFO-QA-9" }),
    KEYS,
  )));
});

test("non-dev hosts and missing keys never call fetch", async () => {
  let called = 0;
  const fetchImpl = async () => { called += 1; throw new Error("should_not_fetch"); };
  const live = await createPaymentLink(sandboxTenDollarInput(), deps(fetchImpl, { baseUrl: "https://api.cleffo.com" }));
  assert.equal(live.ok, false);
  assert.equal(live.error, "cleffo_sandbox_host_required");
  const missing = await createPaymentLink(sandboxTenDollarInput(), { fetchImpl, baseUrl: KEYS.baseUrl, clientKey: "", signatureKey: "", apiKey: "" });
  assert.equal(missing.error, "cleffo_sandbox_not_configured");
  assert.equal(called, 0);
});

test("status poll uses x-api-key only and completed is the only success", async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return {
      status: 200,
      async text() {
        return JSON.stringify({ status: true, data: { status: "completed", transaction_reference_number: "TXN-REF-1" } });
      },
    };
  };
  const pending = mapCleffoStatus({ status: true, data: { status: "pending" } }, 200);
  assert.equal(pending.success, false);
  assert.equal(pending.status, "pending");
  const result = await getPaymentStatus("TXN-REF-1", deps(fetchImpl));
  assert.equal(result.success, true);
  assert.equal(result.status, "completed");
  assert.equal(calls[0].url, "https://apis-dev.cleffo.com/api/payment-link/TXN-REF-1/status");
  assert.equal(calls[0].opts.method, "GET");
  assert.equal(calls[0].opts.headers["x-api-key"], KEYS.apiKey);
  assert.equal("x-signature" in calls[0].opts.headers, false);
  assert.equal(calls[0].opts.body, undefined);
  const failed = mapCleffoStatus({ status: true, data: { status: "failed" } }, 200);
  assert.equal(failed.success, false);
  assert.equal(failed.status, "failed");
});

test("soft-qa stdout prints the link and reference and never the keys", async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/status")) {
      return { status: 200, async text() { return JSON.stringify({ status: true, data: { status: "completed" } }); } };
    }
    return {
      status: 200,
      async text() {
        return JSON.stringify({
          status: true,
          data: {
            payment_link: "https://pay.sandbox.example/link/abc",
            transaction_reference_number: "TXN-REF-1",
            merchant_order_id: "CLEFFO-QA-OUT",
            payment_source: "api",
          },
        });
      },
    };
  };
  const { config, view } = await runSoftQa(["--order", "CLEFFO-QA-OUT", "--poll"], {
    ...KEYS,
    fetchImpl,
    pollRounds: 1,
    pollIntervalMs: 0,
    wait: async () => {},
  });
  const text = formatSoftQaOutput(view);
  assert.match(text, /payment_link: https:\/\/pay\.sandbox\.example\/link\/abc/);
  assert.match(text, /transaction_reference_number: TXN-REF-1/);
  assert.match(text, /payment_source: api/);
  assert.match(text, /status: completed/);
  assert.equal(outputLeaksSecrets(text, config), false);
  assert.equal(text.includes(KEYS.clientKey), false);
  assert.equal(text.includes(KEYS.apiKey), false);
  assert.equal(text.includes(KEYS.signatureKey), false);
  assert.match(text, /redirect is not success/);
});

test("Cleffo stays out of checkout even if settings try to enable it", async () => {
  const store = createStore({ memoryOnly: true });
  const saved = store.saveSettings({
    killSwitchPsp: "cleffo",
    processors: [
      { id: "umg", enabled: true, priority: 1, mode: "live" },
      { id: "cleffo", enabled: true, priority: 0, mode: "live" },
    ],
  });
  assert.equal(saved.killSwitchPsp, null);
  const cleffo = saved.processors.find((p) => p.id === "cleffo");
  assert.equal(cleffo.enabled, false);
  assert.equal(cleffo.mode, "sandbox");
  assert.equal(cleffo.sandboxOnly, true);
  assert.deepEqual(resolveQueue(defaultSettings()).map((p) => p.id), ["umg"]);
  let cleffoCalls = 0;
  const result = await chargeCart({
    idempotencyKey: "CART-CLEFFO-SKIP",
    amount: "20.00",
    customer: { first_name: "A", last_name: "B", email: "a@b.co", phone: "12025550100" },
    card: { number: "4242424242424242", month: "12", year: "28", cvv: "123" },
  }, {
    store,
    settings: {
      killSwitchPsp: null,
      processors: [
        { id: "cleffo", enabled: true, priority: 1, mode: "sandbox" },
        { id: "umg", enabled: true, priority: 2, mode: "sandbox" },
      ],
    },
    adapters: {
      umg: createMockUmg({ scenario: "approved" }),
      cleffo: { createPayment: async () => { cleffoCalls += 1; return { ok: true, processorStatus: "APPROVED", cascadeAction: "success" }; } },
    },
  });
  assert.equal(cleffoCalls, 0);
  assert.equal(result.order.winningProcessor, "umg");
  const refused = await createPayment({ card: { number: "4242424242424242" } });
  assert.equal(refused.reason, "cleffo_not_checkout");
});

test("sandbox routes are operator-only, do not call UMG, and redirect is not success", async () => {
  const store = createStore({ memoryOnly: true });
  let umgCalled = 0;
  const cleffoFetch = async (url) => {
    if (String(url).includes("umg")) umgCalled += 1;
    if (String(url).endsWith("/status")) {
      return { status: 200, async text() { return JSON.stringify({ status: true, data: { status: "pending" } }); } };
    }
    return {
      status: 200,
      async text() {
        return JSON.stringify({
          status: true,
          data: {
            payment_link: "https://pay.sandbox.example/link/abc",
            transaction_reference_number: "TXN-REF-9",
            merchant_order_id: "CLEFFO-QA-HTTP",
            payment_source: "api",
          },
        });
      },
    };
  };
  const server = await startCrmServer(0, {
    store,
    cleffoFetch,
    cleffoEnv: { ...process.env, ...{
      CLEFFO_BASE_URL: KEYS.baseUrl,
      CLEFFO_CLIENT_KEY: KEYS.clientKey,
      CLEFFO_SIGNATURE_KEY: KEYS.signatureKey,
      CLEFFO_API_KEY: KEYS.apiKey,
    } },
    checkCrmSession: async (token) => token === "good-session",
    adapters: {
      umg: { createPayment: async () => { umgCalled += 1; return { ok: false }; } },
    },
  });
  const { port } = server.address();
  try {
    const denied = await fetch(`http://127.0.0.1:${port}/api/psp/cleffo/sandbox/payment-link`, { method: "POST" });
    assert.equal(denied.status, 401);
    const card = await fetch(`http://127.0.0.1:${port}/api/psp/cleffo/sandbox/payment-link`, {
      method: "POST",
      headers: { Authorization: "Bearer good-session", "Content-Type": "application/json" },
      body: JSON.stringify({ card: { number: "4242424242424242", cvv: "123" }, merchant_order_id: "CLEFFO-QA-HTTP" }),
    });
    assert.equal(card.status, 400);
    assert.equal((await card.json()).error, "card_not_accepted");
    const created = await fetch(`http://127.0.0.1:${port}/api/psp/cleffo/sandbox/payment-link`, {
      method: "POST",
      headers: { Authorization: "Bearer good-session", "Content-Type": "application/json" },
      body: JSON.stringify({ merchant_order_id: "CLEFFO-QA-HTTP" }),
    });
    assert.equal(created.status, 200);
    const body = await created.json();
    assert.equal(body.payment_link, "https://pay.sandbox.example/link/abc");
    assert.equal(body.transaction_reference_number, "TXN-REF-9");
    assert.equal(body.payment_source, "api");
    assert.equal(body.checkout, false);
    assert.equal(JSON.stringify(body).includes(KEYS.clientKey), false);
    const status = await fetch(`http://127.0.0.1:${port}/api/psp/cleffo/sandbox/status?ref=TXN-REF-9`, {
      headers: { Authorization: "Bearer good-session" },
    });
    const statusBody = await status.json();
    assert.equal(statusBody.status, "pending");
    assert.equal(statusBody.success, false);
    const back = await fetch(`http://127.0.0.1:${port}/api/psp/cleffo/sandbox/return?status=completed&success=true`);
    const backBody = await back.json();
    assert.equal(back.status, 200);
    assert.equal(backBody.success, false);
    assert.equal(backBody.ok, false);
    assert.equal(umgCalled, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("resolveCleffoConfig reads env names and does not invent keys", () => {
  const cfg = resolveCleffoConfig({ env: {} });
  assert.equal(cfg.baseUrl, "https://apis-dev.cleffo.com");
  assert.equal(cfg.clientKey, "");
  assert.equal(cfg.apiKey, "");
  assert.equal(cfg.signatureKey, "");
});
