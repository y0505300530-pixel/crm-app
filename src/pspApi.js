const json = async (res) => {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: text || "bad_response" }; }
};

function crmAuthHeaders(extra = {}) {
  const headers = { ...extra };
  if (typeof localStorage !== "undefined") {
    try {
      const token = localStorage.getItem("crm_token") || "";
      if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
    } catch {
      /* private mode */
    }
  }
  return headers;
}

export async function fetchHealth() {
  const res = await fetch("/api/psp/health");
  return json(res);
}

export async function fetchSettings() {
  const res = await fetch("/api/psp/settings", { headers: crmAuthHeaders() });
  return json(res);
}

export async function saveSettings(settings) {
  const res = await fetch("/api/psp/settings", {
    method: "PUT",
    headers: crmAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ settings }),
  });
  return json(res);
}

export async function fetchOrders() {
  const res = await fetch("/api/store-orders", { headers: crmAuthHeaders() });
  return json(res);
}

export async function pollOrders() {
  const res = await fetch("/api/store-orders/poll", { method: "POST", headers: crmAuthHeaders() });
  return json(res);
}

export async function runDryRun(scenario) {
  const res = await fetch("/api/psp/dry-run", {
    method: "POST",
    headers: crmAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ scenario }),
  });
  return json(res);
}

export async function fetchAbandonedCheckouts() {
  const res = await fetch("/api/checkout/abandon", { headers: crmAuthHeaders() });
  return json(res);
}
