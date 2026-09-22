import { test } from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../lib/store.js";
import {
  ABANDON_MAX,
  ABANDON_RATE_MAX,
  createRateLimiter,
  findForbiddenCardField,
  formatAbandonedDigest,
  isAbandonDigestEnabled,
  normalizeAbandonPayload,
} from "../lib/abandon.js";
import { startCrmServer } from "../index.js";

const LEAD = {
  session_id: "bl-sess-abandon-1",
  stage: "contact",
  customer: {
    first_name: "Ada",
    last_name: "Nguyen",
    email: "qa+abandon1@biolabsresearch.co",
    phone: "4155550100",
    address: "1 Research Way",
    city: "San Francisco",
    state: "CA",
    zip: "94107",
    country: "USA",
  },
  items: [{ sku: "BL-PEP-001", name: "Research peptide A", qty: 2, amount: "79.00" }],
  subtotal: "158.00",
  coupon: "RUO10",
  timestamp: "2026-09-19T12:00:00.000Z",
  utm_source: "soft-qa",
};

const QUOTE = {
  idempotencyKey: "BL-QUOTE-ABANDON-1",
  amount: "158.00",
  currency: "USD",
  session_id: LEAD.session_id,
  customer: LEAD.customer,
  items: LEAD.items,
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

function post(port, path, body, headers = {}) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("invalid email / missing session_id silently drop with 204", async () => {
  const store = createStore({ memoryOnly: true });
  await withServer({ store }, async (port) => {
    const missingSid = await post(port, "/api/checkout/abandon", { ...LEAD, session_id: "" });
    assert.equal(missingSid.status, 204);
    const badEmail = await post(port, "/api/checkout/abandon", {
      ...LEAD,
      session_id: "bl-sess-x",
      customer: { ...LEAD.customer, email: "not-an-email" },
    });
    assert.equal(badEmail.status, 204);
    const noEmail = await post(port, "/api/checkout/abandon", {
      session_id: "bl-sess-y",
      customer: { first_name: "Ada" },
    });
    assert.equal(noEmail.status, 204);
    const listed = await fetch(`http://127.0.0.1:${port}/api/checkout/abandon`);
    assert.equal(listed.status, 401);
    assert.equal(store.listAbandonedCheckouts().length, 0);
  });
});

test("card / PAN / CVV / last4 / paymentMethod card data → 400 and never persist", async () => {
  const store = createStore({ memoryOnly: true });
  await withServer({ store }, async (port) => {
    const cases = [
      { ...LEAD, card: { number: "4242424242424242", cvv: "123" } },
      { ...LEAD, cvv: "123" },
      { ...LEAD, last4: "4242" },
      { ...LEAD, pan: "4111111111111111" },
      { ...LEAD, paymentMethod: { type: "card", last4: "4242" } },
      { ...LEAD, customer: { ...LEAD.customer, number: "4242424242424242" } },
    ];
    for (const body of cases) {
      const res = await post(port, "/api/checkout/abandon", body);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error, "card_fields_not_accepted");
    }
    assert.equal(store.listAbandonedCheckouts().length, 0);
    const dumped = JSON.stringify(store.snapshot());
    assert.equal(dumped.includes("4242"), false);
    assert.equal(dumped.includes("last4"), false);
  });
});

test("happy upsert + second upsert same session updates stage/items/subtotal", async () => {
  const store = createStore({ memoryOnly: true });
  await withServer({ store }, async (port) => {
    const first = await post(port, "/api/checkout/abandon", LEAD);
    assert.equal(first.status, 204);
    const saved = store.getAbandonedCheckout(LEAD.session_id);
    assert.equal(saved.status, "open");
    assert.equal(saved.customer.email, "qa+abandon1@biolabsresearch.co");
    assert.equal(saved.subtotal, "158.00");
    assert.equal(saved.items[0].qty, 2);
    assert.equal(saved.stage, "contact");
    const firstSeen = saved.first_seen;

    const second = await post(port, "/api/checkout/abandon", {
      ...LEAD,
      stage: "shipping",
      subtotal: "200.00",
      items: [{ sku: "BL-PEP-001", name: "Research peptide A", qty: 3, amount: "79.00" }],
    });
    assert.equal(second.status, 204);
    const updated = store.getAbandonedCheckout(LEAD.session_id);
    assert.equal(updated.stage, "shipping");
    assert.equal(updated.subtotal, "200.00");
    assert.equal(updated.items[0].qty, 3);
    assert.equal(updated.first_seen, firstSeen);
    assert.equal(store.listAbandonedCheckouts().length, 1);
  });
});

test("quote with matching session_id marks abandoned checkout converted", async () => {
  await withEnv("PAYMENTS_ENABLED", undefined, async () => {
    const store = createStore({ memoryOnly: true });
    await withServer({
      store,
      sendQuoteEmail: async () => {},
    }, async (port) => {
      await post(port, "/api/checkout/abandon", LEAD);
      assert.equal(store.getAbandonedCheckout(LEAD.session_id).status, "open");

      const quoted = await post(port, "/api/checkout/quote", QUOTE);
      assert.equal(quoted.status, 200);
      const body = await quoted.json();
      assert.equal(body.ok, true);

      const row = store.getAbandonedCheckout(LEAD.session_id);
      assert.equal(row.status, "converted");
      assert.equal(row.converted_via, "quote");
      assert.equal(row.converted_id, body.quoteId);
      assert.ok(row.converted_at);
      assert.equal(store.listAbandonedCheckouts().length, 1);
    });
  });
});

test("charge success with matching session_id marks converted when payments are on", async () => {
  await withEnv("PAYMENTS_ENABLED", "true", async () => {
    const store = createStore({ memoryOnly: true });
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
            return {
              ok: true,
              processor: "umg",
              processorTxnId: "UMG-ABANDON-1",
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
      await post(port, "/api/checkout/abandon", LEAD);
      const res = await post(port, "/api/checkout/charge", {
        session_id: LEAD.session_id,
        idempotencyKey: "CART-ABANDON-1",
        amount: "158.00",
        customer: LEAD.customer,
        items: LEAD.items,
        card: { name: "Ada Nguyen", number: "4242424242424242", month: "12", year: "28", cvv: "123" },
      });
      assert.equal(res.status, 200);
      const row = store.getAbandonedCheckout(LEAD.session_id);
      assert.equal(row.status, "converted");
      assert.equal(row.converted_via, "charge");
    });
  });
});

test("retain 500 — oldest last_seen is dropped", () => {
  const store = createStore({ memoryOnly: true });
  for (let i = 0; i < ABANDON_MAX + 1; i += 1) {
    const ts = new Date(1_700_000_000_000 + i * 1000).toISOString();
    store.upsertAbandonedCheckout({
      session_id: `sess-${i}`,
      stage: "cart",
      customer: { email: `qa+trim${i}@biolabsresearch.co`, first_name: "Trim", last_name: String(i) },
      items: [{ sku: "X", name: "Item", qty: 1, amount: "1.00" }],
      subtotal: "1.00",
      last_seen: ts,
    });
  }
  const rows = store.listAbandonedCheckouts();
  assert.equal(rows.length, 500);
  assert.equal(store.getAbandonedCheckout("sess-0"), null);
  assert.ok(store.getAbandonedCheckout("sess-1"));
  assert.ok(store.getAbandonedCheckout(`sess-${ABANDON_MAX}`));
});

test("rate limit ~30/min returns 204 and does not persist the overflow", async () => {
  const store = createStore({ memoryOnly: true });
  const limiter = createRateLimiter({ max: 2, windowMs: 60_000 });
  await withServer({ store, abandonLimiter: limiter }, async (port) => {
    const a = await post(port, "/api/checkout/abandon", { ...LEAD, session_id: "rate-a" }, { "X-Forwarded-For": "203.0.113.9" });
    const b = await post(port, "/api/checkout/abandon", { ...LEAD, session_id: "rate-b", customer: { ...LEAD.customer, email: "qa+rateb@biolabsresearch.co" } }, { "X-Forwarded-For": "203.0.113.9" });
    const c = await post(port, "/api/checkout/abandon", { ...LEAD, session_id: "rate-c", customer: { ...LEAD.customer, email: "qa+ratec@biolabsresearch.co" } }, { "X-Forwarded-For": "203.0.113.9" });
    assert.equal(a.status, 204);
    assert.equal(b.status, 204);
    assert.equal(c.status, 204);
    assert.ok(store.getAbandonedCheckout("rate-a"));
    assert.ok(store.getAbandonedCheckout("rate-b"));
    assert.equal(store.getAbandonedCheckout("rate-c"), null);
  });

  const def = createRateLimiter();
  assert.equal(def.max, ABANDON_RATE_MAX);
  for (let i = 0; i < 30; i += 1) assert.equal(def.allow("1.1.1.1"), true);
  assert.equal(def.allow("1.1.1.1"), false);
  assert.equal(def.allow("9.9.9.9"), true);
});

test("bad JSON is a silent 204", async () => {
  const store = createStore({ memoryOnly: true });
  await withServer({ store }, async (port) => {
    const res = await post(port, "/api/checkout/abandon", "{not-json");
    assert.equal(res.status, 204);
    assert.equal(store.listAbandonedCheckouts().length, 0);
  });
});

test("normalize + digest stay first-party / no last4", () => {
  assert.equal(findForbiddenCardField({ card: { cvv: "123" } }), "card");
  assert.equal(normalizeAbandonPayload({ session_id: "x" }).silent, true);
  const ok = normalizeAbandonPayload(LEAD);
  assert.equal(ok.ok, true);
  const digest = formatAbandonedDigest([{ ...ok.record, status: "open" }]);
  assert.equal(digest.to, "admin@biolabsresearch.co");
  assert.match(digest.text, /qa\+abandon1@biolabsresearch\.co/);
  assert.equal(digest.text.toLowerCase().includes("last4"), false);
  assert.equal(isAbandonDigestEnabled({}), false);
  assert.equal(isAbandonDigestEnabled({ ABANDON_DIGEST_ENABLED: "true" }), true);
});
