const json = async (res) => {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: text || "bad_response" }; }
};

export async function fetchHealth() {
  const res = await fetch("/api/psp/health");
  return json(res);
}

export async function fetchSettings() {
  const res = await fetch("/api/psp/settings");
  return json(res);
}

export async function saveSettings(settings) {
  const res = await fetch("/api/psp/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings }),
  });
  return json(res);
}

export async function fetchOrders() {
  const res = await fetch("/api/store-orders");
  return json(res);
}

export async function pollOrders() {
  const res = await fetch("/api/store-orders/poll", { method: "POST" });
  return json(res);
}

export async function runDryRun(scenario) {
  const res = await fetch("/api/psp/dry-run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario }),
  });
  return json(res);
}

export async function fetchAbandonedCheckouts() {
  const res = await fetch("/api/checkout/abandon");
  return json(res);
}
