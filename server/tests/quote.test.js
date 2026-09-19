import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../lib/store.js";
import { isPaymentsEnabled, paymentsMode, paymentsDisabledBody } from "../lib/payments.js";
import { createQuote, QUOTE_OK_MESSAGE, validateQuoteRequest } from "../lib/quote.js";
import { formatQuoteEmail, QUOTE_NOTIFY_TO } from "../lib/mail.js";
import { startCrmServer } from "../index.js";

const SAMPLE = {
  idempotencyKey: "BL-QUOTE-TEST-1",
  amount: "158.00",
  currency: "USD",
  customer: {
    first_name: "Ada",
    last_name: "Nguyen",
    email: "ada@lab.example",
    phone: "4155550100",
    address: "1 Research Way",
    city: "San Francisco",
    state: "CA",
    zip: "94107",
    country: "USA",
  },
  items: [{ sku: "BL-PEP-001", name: "Research peptide A", qty: 2, amount: "79.00" }],
  notes: "RUO inquiry",
};

function withEnv(key, value, fn) {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    });
}

async function withServer(deps, fn) {
  const server = await startCrmServer(0, deps);
  const { port } = server.address();
  try {
    return await fn(port);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

test("PAYMENTS_ENABLED defaults to false / quote mode", () => {
  assert.equal(isPaymentsEnabled({}), false);
  assert.equal(isPaymentsEnabled({ PAYMENTS_ENABLED: "" }), false);
  assert.equal(isPaymentsEnabled({ PAYMENTS_ENABLED: "false" }), false);
  assert.equal(paymentsMode({}), "quote");
  assert.equal(isPaymentsEnabled({ PAYMENTS_ENABLED: "true" }), true);
  assert.equal(paymentsMode({ PAYMENTS_ENABLED: "1" }), "pay");
  assert.deepEqual(paymentsDisabledBody(), { ok: false, error: "payments_disabled", mode: "quote" });
});

test("quote validation requires contact, items, amount and rejects card/PAN", () => {
  assert.equal(validateQuoteRequest({ ...SAMPLE, customer: { ...SAMPLE.customer, email: "" } }).error, "email_required");
  assert.equal(validateQuoteRequest({ ...SAMPLE, items: [] }).error, "items_required");
  assert.equal(validateQuoteRequest({ ...SAMPLE, amount: "0" }).error, "invalid_amount");
  assert.equal(validateQuoteRequest({
    ...SAMPLE,
    card: { number: "4242424242424242", cvv: "123" },
  }).error, "card_not_accepted");
  assert.equal(validateQuoteRequest(SAMPLE).ok, true);
});

test("createQuote persists a Not Contacted lead and notifies admin (mocked mail)", async () => {
  const store = createStore({ memoryOnly: true });
  const sent = [];
  const result = await createQuote(SAMPLE, {
    store,
    sendQuoteEmail: async (quote) => {
      sent.push(quote);
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.message, QUOTE_OK_MESSAGE);
  assert.match(result.quoteId, /^QT-\d+$/);
  const saved = store.getQuote(result.quoteId);
  assert.equal(saved.status, "quote_requested");
  assert.equal(saved.crmStatus, "Not Contacted");
  assert.equal(saved.type, "lead");
  assert.equal(saved.amount, "158.00");
  assert.equal(saved.items[0].qty, 2);
  assert.equal(saved.customer.email, "ada@lab.example");
  assert.equal(saved.idempotencyKey, SAMPLE.idempotencyKey);
  assert.equal(saved.emailSent, true);
  assert.equal(sent.length, 1);
  const mail = formatQuoteEmail(saved);
  assert.equal(mail.to, QUOTE_NOTIFY_TO);
  assert.equal(mail.to, "admin@biolabsresearch.co");
  assert.match(mail.text, /Quote ID: QT-/);
  assert.equal(mail.text.includes("payment successful"), false);
  const dumped = JSON.stringify(store.snapshot());
  assert.equal(dumped.includes("4242"), false);
});

test("POST /api/checkout/charge is gated — 503 quote mode, UMG not called", async () => {
  await withEnv("PAYMENTS_ENABLED", undefined, async () => {
    const store = createStore({ memoryOnly: true });
    let umgCalled = 0;
    await withServer({
      store,
      adapters: {
        umg: {
          async createPayment() {
            umgCalled += 1;
            return { ok: true, processor: "umg", processorStatus: "APPROVED", cascadeAction: "success", raw: {} };
          },
        },
      },
    }, async (port) => {
      const health = await fetch(`http://127.0.0.1:${port}/api/psp/health`).then((r) => r.json());
      assert.equal(health.paymentsEnabled, false);
      assert.equal(health.mode, "quote");

      const res = await fetch(`http://127.0.0.1:${port}/api/checkout/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: "SHOULD-NOT-CHARGE",
          amount: "20.00",
          customer: SAMPLE.customer,
          card: { number: "4242424242424242", month: "12", year: "28", cvv: "123" },
        }),
      });
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.deepEqual(body, { ok: false, error: "payments_disabled", mode: "quote" });
      assert.equal(umgCalled, 0);
      assert.equal(store.listOrders().length, 0);
    });
  });
});

test("POST /api/checkout/quote happy path returns quoteId and mocks email", async () => {
  await withEnv("PAYMENTS_ENABLED", undefined, async () => {
    const store = createStore({ memoryOnly: true });
    const sent = [];
    await withServer({
      store,
      sendQuoteEmail: async (quote) => { sent.push(quote); },
    }, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/api/checkout/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(SAMPLE),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.ok, true);
      assert.equal(body.message, "We'll send your quote within one business day.");
      assert.match(body.quoteId, /^QT-\d+$/);
      assert.equal("payment" in body, false);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].id, body.quoteId);

      const again = await fetch(`http://127.0.0.1:${port}/api/checkout/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(SAMPLE),
      });
      const reused = await again.json();
      assert.equal(reused.quoteId, body.quoteId);
      assert.equal(sent.length, 1);
    });
  });
});

test("PAYMENTS_ENABLED=true lets charge reach UMG", async () => {
  await withEnv("PAYMENTS_ENABLED", "true", async () => {
    const store = createStore({ memoryOnly: true });
    let umgCalled = 0;
    store.saveSettings({
      processors: [
        { id: "umg", enabled: true, priority: 1, mode: "sandbox" },
        { id: "tagada", enabled: false, priority: 2, mode: "off" },
        { id: "centrobill", enabled: false, priority: 3, mode: "off" },
      ],
    });
    await withServer({
      store,
      adapters: {
        umg: {
          async createPayment() {
            umgCalled += 1;
            return {
              ok: true,
              processor: "umg",
              processorTxnId: "UMG-1",
              processorStatus: "APPROVED",
              cascadeAction: "success",
              raw: {},
            };
          },
        },
        tagada: {},
        centrobill: {},
      },
    }, async (port) => {
      const health = await fetch(`http://127.0.0.1:${port}/api/psp/health`).then((r) => r.json());
      assert.equal(health.paymentsEnabled, true);
      assert.equal(health.mode, "pay");
      const res = await fetch(`http://127.0.0.1:${port}/api/checkout/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: "CART-PAY-1",
          amount: "20.00",
          customer: SAMPLE.customer,
          items: SAMPLE.items,
          card: { name: "Ada Nguyen", number: "4242424242424242", month: "12", year: "28", cvv: "123" },
        }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.ok, true);
      assert.equal(umgCalled, 1);
    });
  });
});
