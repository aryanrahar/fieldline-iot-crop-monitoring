const timeoutSignal = () => AbortSignal.timeout(3000);

export async function mirrorToFirebase(reading, config = process.env) {
  const base = (config.firebaseDatabaseUrl ?? config.FIREBASE_DATABASE_URL)?.replace(/\/$/, "");
  if (!base) return { enabled: false };
  const token = config.firebaseAuthToken ?? config.FIREBASE_AUTH_TOKEN;
  const key = encodeURIComponent(reading.timestamp.replace(/[.#$\[\]]/g, "-"));
  const auth = token ? `?auth=${encodeURIComponent(token)}` : "";
  const response = await fetch(`${base}/readings/${encodeURIComponent(reading.deviceId)}/${key}.json${auth}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(reading),
    signal: timeoutSignal()
  });
  if (!response.ok) throw new Error(`Firebase returned ${response.status}`);
  return { enabled: true, ok: true };
}

export async function updateBlynk(reading, metrics, config = process.env) {
  const token = config.blynkAuthToken ?? config.BLYNK_AUTH_TOKEN;
  if (!token) return { enabled: false };
  const server = config.blynkServer ?? config.BLYNK_SERVER ?? "https://blynk.cloud";
  const query = new URLSearchParams({
    token,
    V0: reading.sensors.soilMoisture,
    V1: reading.sensors.temperature,
    V2: reading.sensors.humidity,
    V3: metrics.cropHealth,
    V4: metrics.irrigation.action === "irrigate" ? 1 : 0
  });
  const response = await fetch(`${server}/external/api/batch/update?${query}`, { signal: timeoutSignal() });
  if (!response.ok) throw new Error(`Blynk returned ${response.status}`);
  return { enabled: true, ok: true };
}

export async function syncExternalServices(reading, metrics, config) {
  const settled = await Promise.allSettled([
    mirrorToFirebase(reading, config),
    updateBlynk(reading, metrics, config)
  ]);
  return settled.map((result, index) => ({
    service: index === 0 ? "firebase" : "blynk",
    ok: result.status === "fulfilled" && (result.value.ok || result.value.enabled === false),
    enabled: result.status === "fulfilled" ? result.value.enabled : true,
    error: result.status === "rejected" ? result.reason.message : undefined
  }));
}
