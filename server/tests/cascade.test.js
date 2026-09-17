import { test } from "node:test";
import assert from "node:assert/strict";
import { chargeCart, resolveQueue } from "../lib/cascade.js";
import { createStore, defaultSettings } from "../lib/store.js";
import { createMockUmg } from "../lib/processors/umg.js";

function adapters(umgScenario, tagadaFn) {
  return {
    umg: createMockUmg({ scenario: umgScenario }),
    tagada: {
      id: "tagada",
      createPayment: tagadaFn || (async () => ({
        ok: true,
        processor: "tagada",
        processorTxnId: "TG-1",
        processorStatus: "APPROVED",
        descriptor: "TAGADA",
        declineClass: null,
        cascadeAction: "success",
        raw: { stub: true },
      })),
    },
    centrobill: {
      id: "centrobill",
      createPayment: async () => ({
        ok: false,
        processor: "centrobill",
        processorStatus: "PROCESSOR_DOWN",
        declineClass: "soft",
        cascadeAction: "next",
        raw: { stub: true },
      }),
    },
  };
}

function enableAll(store) {
  store.saveSettings({
    killSwitchPsp: null,
    processors: [
      { id: "umg", label: "UMG", enabled: true, priority: 1, mode: "sandbox" },
      { id: "tagada", label: "Tagada", enabled: true, priority: 2, mode: "sandbox" },
      { id: "centrobill", label: "Centrobill", enabled: true, priority: 3, mode: "sandbox" },
    ],
  });
}

const customer = {
  first_name: "Beverly", last_name: "Brower", email: "t@t.com",
  address: "1 Main", country: "USA", state: "CA", city: "Anaheim", zip: "92803",
  phone: "8881234567", ip: "1.1.1.1", birthday: "1983-02-22",
};

test("default queue is UMG first", () => {
  const q = resolveQueue(defaultSettings());
  assert.deepEqual(q.map((p) => p.id), ["umg"]);
});

test("soft UMG decline (Code 203) cascades to Tagada with the same idempotency key", async () => {
  const store = createStore({ memoryOnly: true });
  enableAll(store);
  const result = await chargeCart({
    idempotencyKey: "CART-SOFT-1",
    amount: "20.00",
    customer,
    card: { name: "Beverly Brower", number: "4242424242420002", month: "12", year: "28", cvv: "123" },
  }, { store, adapters: adapters("soft") });
  assert.equal(result.ok, true);
  assert.equal(result.order.winningProcessor, "tagada");
  assert.equal(result.order.attempts.length, 2);
  assert.equal(result.order.attempts[0].processor, "umg");
  assert.equal(result.order.attempts[0].declineClass, "soft");
  assert.equal(result.order.attempts[0].informationData.includes("203"), true);
  assert.equal(result.order.attempts[1].processor, "tagada");
  assert.equal(result.order.idempotencyKey, "CART-SOFT-1");
});

test("hard decline stops cascade — Tagada is not called", async () => {
  const store = createStore({ memoryOnly: true });
  enableAll(store);
  let tagadaCalls = 0;
  const result = await chargeCart({
    idempotencyKey: "CART-HARD-1",
    amount: "20.00",
    customer,
    card: { name: "Beverly Brower", number: "4111111111110003", month: "12", year: "28", cvv: "123" },
  }, {
    store,
    adapters: adapters("hard", async () => {
      tagadaCalls += 1;
      return { ok: true, processor: "tagada", processorStatus: "APPROVED", cascadeAction: "success" };
    }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.hardDecline, true);
  assert.equal(tagadaCalls, 0);
  assert.equal(result.order.attempts.length, 1);
  assert.equal(result.order.attempts[0].declineClass, "hard");
});

test("same cart idempotency key does not charge twice after approval", async () => {
  const store = createStore({ memoryOnly: true });
  enableAll(store);
  let charges = 0;
  const ads = {
    umg: {
      async createPayment() {
        charges += 1;
        return {
          ok: true,
          processor: "umg",
          processorTxnId: "1",
          processorStatus: "APPROVED",
          cascadeAction: "success",
          raw: {},
        };
      },
    },
    tagada: { createPayment: async () => ({}) },
    centrobill: { createPayment: async () => ({}) },
  };
  const first = await chargeCart({
    idempotencyKey: "CART-IDEM-1",
    amount: "50.00",
    customer,
    card: { number: "4242424242424242", month: "12", year: "28", cvv: "123" },
  }, { store, adapters: ads });
  const second = await chargeCart({
    idempotencyKey: "CART-IDEM-1",
    amount: "50.00",
    customer,
    card: { number: "4242424242424242", month: "12", year: "28", cvv: "123" },
  }, { store, adapters: ads });
  assert.equal(first.ok, true);
  assert.equal(second.reused, true);
  assert.equal(charges, 1);
  assert.equal(second.order.id, first.order.id);
});

test("kill-switch force-single-PSP only hits that processor", async () => {
  const store = createStore({ memoryOnly: true });
  store.saveSettings({
    killSwitchPsp: "umg",
    processors: [
      { id: "umg", enabled: true, priority: 1, mode: "sandbox" },
      { id: "tagada", enabled: true, priority: 2, mode: "sandbox" },
      { id: "centrobill", enabled: true, priority: 3, mode: "sandbox" },
    ],
  });
  let tagadaCalls = 0;
  const result = await chargeCart({
    idempotencyKey: "CART-KILL-1",
    amount: "20.00",
    customer,
    card: { number: "4242424242420002", month: "12", year: "28", cvv: "123" },
  }, {
    store,
    adapters: adapters("soft", async () => {
      tagadaCalls += 1;
      return { ok: true, processor: "tagada", processorStatus: "APPROVED", cascadeAction: "success" };
    }),
  });
  assert.equal(tagadaCalls, 0);
  assert.equal(result.order.attempts.every((a) => a.processor === "umg"), true);
});

test("PAN/CVV are not stored on the order", async () => {
  const store = createStore({ memoryOnly: true });
  enableAll(store);
  const result = await chargeCart({
    idempotencyKey: "CART-PCI-1",
    amount: "20.00",
    customer,
    card: { name: "Beverly Brower", number: "4242424242424242", month: "12", year: "28", cvv: "999" },
  }, { store, adapters: adapters("approved") });
  const dumped = JSON.stringify(store.snapshot());
  assert.equal(dumped.includes("4242424242424242"), false);
  assert.equal(dumped.includes("999"), false);
  assert.equal(result.order.attempts[0].cardLast4, "4242");
});
