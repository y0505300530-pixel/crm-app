const json = async (res) => {
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { error: text || "bad_response" }; }
  return { status: res.status, body };
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

export async function fetchInventory() {
  const res = await fetch("/api/inventory", { headers: crmAuthHeaders() });
  return json(res);
}

export async function rerunIntake() {
  const res = await fetch("/api/inventory/intake", {
    method: "POST",
    headers: crmAuthHeaders(),
  });
  return json(res);
}

export async function markPurchaseOrderReceived(poId) {
  const res = await fetch(`/api/inventory/purchase-orders/${encodeURIComponent(poId)}/mark-received`, {
    method: "POST",
    headers: crmAuthHeaders(),
  });
  return json(res);
}
