import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_STOREFRONT_ORIGINS,
  corsHeadersForRequest,
  isStorefrontApiPath,
  storefrontOrigins,
} from "../lib/cors.js";
import { createStore } from "../lib/store.js";
import { startCrmServer } from "../index.js";

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

test("default storefront origins are the four production hosts", () => {
  assert.deepEqual(storefrontOrigins({}), [...DEFAULT_STOREFRONT_ORIGINS]);
  assert.deepEqual(storefrontOrigins({ CORS_STOREFRONT_ORIGINS: "" }), [...DEFAULT_STOREFRONT_ORIGINS]);
  assert.deepEqual(storefrontOrigins({ CORS_STOREFRONT_ORIGINS: "  " }), [...DEFAULT_STOREFRONT_ORIGINS]);
});

test("CORS_STOREFRONT_ORIGINS overrides defaults (comma-separated)", () => {
  assert.deepEqual(storefrontOrigins({ CORS_STOREFRONT_ORIGINS: "https://staging.example, https://www.staging.example" }), [
    "https://staging.example",
    "https://www.staging.example",
  ]);
});

test("only /api/checkout paths are storefront CORS surfaces", () => {
  assert.equal(isStorefrontApiPath("/api/checkout/charge"), true);
  assert.equal(isStorefrontApiPath("/api/checkout/quote"), true);
  assert.equal(isStorefrontApiPath("/api/checkout/abandon"), true);
  assert.equal(isStorefrontApiPath("/api/psp/settings"), false);
  assert.equal(isStorefrontApiPath("/api/store-orders"), false);
  assert.equal(isStorefrontApiPath("/api/health"), false);
});

test("corsHeadersForRequest never returns * and reflects allowlisted Origin only", () => {
  const env = {};
  const allowed = corsHeadersForRequest(
    { headers: { origin: "https://biolabsresearch.co" } },
    "/api/checkout/charge",
    env,
  );
  assert.equal(allowed["Access-Control-Allow-Origin"], "https://biolabsresearch.co");
  assert.equal(allowed.Vary, "Origin");
  assert.notEqual(allowed["Access-Control-Allow-Origin"], "*");

  const evil = corsHeadersForRequest(
    { headers: { origin: "https://evil.example" } },
    "/api/checkout/charge",
    env,
  );
  assert.equal(evil["Access-Control-Allow-Origin"], undefined);

  const staff = corsHeadersForRequest(
    { headers: { origin: "https://biolabsresearch.co" } },
    "/api/psp/settings",
    env,
  );
  assert.equal(staff["Access-Control-Allow-Origin"], undefined);

  const noOrigin = corsHeadersForRequest({ headers: {} }, "/api/checkout/charge", env);
  assert.equal(noOrigin["Access-Control-Allow-Origin"], undefined);
});

test("OPTIONS /api/checkout/charge: allowlisted Origin reflected; evil Origin has no ACAO", async () => {
  const store = createStore({ memoryOnly: true });
  await withServer({ store }, async (port) => {
    const ok = await fetch(`http://127.0.0.1:${port}/api/checkout/charge`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://biolabsresearch.co",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    assert.equal(ok.status, 204);
    assert.equal(ok.headers.get("access-control-allow-origin"), "https://biolabsresearch.co");
    assert.notEqual(ok.headers.get("access-control-allow-origin"), "*");

    const www = await fetch(`http://127.0.0.1:${port}/api/checkout/quote`, {
      method: "OPTIONS",
      headers: { Origin: "https://www.blrcommerce.io" },
    });
    assert.equal(www.headers.get("access-control-allow-origin"), "https://www.blrcommerce.io");

    const evil = await fetch(`http://127.0.0.1:${port}/api/checkout/charge`, {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example" },
    });
    assert.equal(evil.status, 204);
    assert.equal(evil.headers.get("access-control-allow-origin"), null);
  });
});

test("POST checkout responses use allowlist; staff APIs never emit ACAO *", async () => {
  const store = createStore({ memoryOnly: true });
  await withServer({ store }, async (port) => {
    const quote = await fetch(`http://127.0.0.1:${port}/api/checkout/quote`, {
      method: "POST",
      headers: {
        Origin: "https://blrcommerce.io",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotencyKey: "BL-QUOTE-CORS-1",
        amount: "10.00",
        currency: "USD",
        customer: {
          first_name: "Cors",
          last_name: "Test",
          email: "qa+cors@biolabsresearch.co",
        },
        items: [{ sku: "BL-1", name: "Item", qty: 1, amount: "10.00" }],
      }),
    });
    assert.equal(quote.headers.get("access-control-allow-origin"), "https://blrcommerce.io");

    const evilQuote = await fetch(`http://127.0.0.1:${port}/api/checkout/quote`, {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idempotencyKey: "BL-QUOTE-CORS-EVIL",
        amount: "10.00",
        currency: "USD",
        customer: {
          first_name: "Evil",
          last_name: "Origin",
          email: "qa+evil@biolabsresearch.co",
        },
        items: [{ sku: "BL-1", name: "Item", qty: 1, amount: "10.00" }],
      }),
    });
    assert.equal(evilQuote.headers.get("access-control-allow-origin"), null);

    const staff = await fetch(`http://127.0.0.1:${port}/api/psp/settings`, {
      headers: { Origin: "https://evil.example" },
    });
    assert.equal(staff.headers.get("access-control-allow-origin"), null);

    const staffOpts = await fetch(`http://127.0.0.1:${port}/api/psp/settings`, {
      method: "OPTIONS",
      headers: { Origin: "https://biolabsresearch.co" },
    });
    assert.equal(staffOpts.headers.get("access-control-allow-origin"), null);
  });
});

test("staging origin works when added via CORS_STOREFRONT_ORIGINS", async () => {
  await withEnv(
    "CORS_STOREFRONT_ORIGINS",
    "https://biolabsresearch.co,https://staging.biolabsresearch.co",
    async () => {
      const store = createStore({ memoryOnly: true });
      await withServer({ store }, async (port) => {
        const staging = await fetch(`http://127.0.0.1:${port}/api/checkout/abandon`, {
          method: "OPTIONS",
          headers: { Origin: "https://staging.biolabsresearch.co" },
        });
        assert.equal(staging.headers.get("access-control-allow-origin"), "https://staging.biolabsresearch.co");

        const www = await fetch(`http://127.0.0.1:${port}/api/checkout/abandon`, {
          method: "OPTIONS",
          headers: { Origin: "https://www.biolabsresearch.co" },
        });
        // www not in override list → no ACAO
        assert.equal(www.headers.get("access-control-allow-origin"), null);
      });
    },
  );
});
