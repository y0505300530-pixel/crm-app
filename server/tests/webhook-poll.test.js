import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../lib/store.js";
import { chargeCart } from "../lib/cascade.js";
import { handleProcessorWebhook } from "../lib/webhooks.js";
import { pollPending } from "../lib/poller.js";
import { createMockUmg } from "../lib/processors/umg.js";

test("UMG webhook updates clearing beside the order", async () => {
  const store = createStore({ memoryOnly: true });
  store.saveSettings({
    processors: [
      { id: "umg", enabled: true, priority: 1, mode: "sandbox" },
      { id: "tagada", enabled: false, priority: 2, mode: "off" },
      { id: "centrobill", enabled: false, priority: 3, mode: "off" },
    ],
  });
  const charged = await chargeCart({
    idempotencyKey: "CART-WH-1",
    amount: "20.00",
    customer: { first_name: "A", last_name: "B", email: "a@b.co", phone: "12345", country: "USA" },
    card: { number: "4242424242420006", month: "12", year: "28", cvv: "123" },
  }, { store, adapters: { umg: createMockUmg({ scenario: "pending" }), tagada: {}, centrobill: {} } });
  assert.equal(charged.pending, true);
  const txnId = charged.order.attempts[0].processorTxnId;
  const wh = handleProcessorWebhook(store, "umg", { ID: txnId, Status: "APPROVED", descriptor: "PEPTIDESS SHOP" });
  assert.equal(wh.ok, true);
  const order = store.getOrder(charged.order.id);
  assert.equal(order.status, "approved");
  assert.equal(order.winningProcessor, "umg");
  assert.equal(order.attempts[0].processorStatus, "APPROVED");
});

test("poll fallback flips PENDING to APPROVED without a webhook", async () => {
  const store = createStore({ memoryOnly: true });
  store.saveSettings({
    processors: [
      { id: "umg", enabled: true, priority: 1, mode: "sandbox" },
      { id: "tagada", enabled: false, priority: 2, mode: "off" },
      { id: "centrobill", enabled: false, priority: 3, mode: "off" },
    ],
  });
  const charged = await chargeCart({
    idempotencyKey: "CART-POLL-1",
    amount: "20.00",
    customer: { first_name: "A", last_name: "B", email: "a@b.co", phone: "12345", country: "USA" },
    card: { number: "4242424242420006", month: "12", year: "28", cvv: "123" },
  }, { store, adapters: { umg: createMockUmg({ scenario: "pending" }), tagada: {}, centrobill: {} } });
  assert.equal(charged.order.status, "pending");
  const results = await pollPending(store, { adapters: { umg: createMockUmg() } });
  assert.equal(results[0].status, "APPROVED");
  assert.equal(store.getOrder(charged.order.id).status, "approved");
});
