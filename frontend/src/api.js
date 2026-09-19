const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { accept: "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }
  return response.json();
}

export function getDashboard({ deviceId = "", limit = 120 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (deviceId) params.set("deviceId", deviceId);
  return request(`/api/v1/dashboard?${params}`);
}

export function getDevices() {
  return request("/api/v1/devices");
}

export function streamUrl(deviceId = "") {
  const params = new URLSearchParams();
  if (deviceId) params.set("deviceId", deviceId);
  const query = params.toString();
  return `${BASE}/api/v1/stream${query ? `?${query}` : ""}`;
}
