import { useCallback, useEffect, useRef, useState } from "react";
import { getDashboard, getDevices, streamUrl } from "../api.js";

const emptyDashboard = { current: null, metrics: null, trends: {}, readings: [] };

export function useTelemetry(deviceId) {
  const [data, setData] = useState(emptyDashboard);
  const [devices, setDevices] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const retryRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const [dashboard, devicePayload] = await Promise.all([
        getDashboard({ deviceId, limit: 120 }),
        getDevices()
      ]);
      setData(dashboard);
      setDevices(devicePayload.devices || []);
      setError("");
      setStatus("live");
    } catch (reason) {
      setError(reason.message);
      setStatus("error");
    }
  }, [deviceId]);

  useEffect(() => {
    let active = true;
    let stream;
    const connect = async () => {
      await refresh();
      if (!active) return;
      stream = new EventSource(streamUrl(deviceId));
      stream.addEventListener("connected", () => active && setStatus("live"));
      stream.addEventListener("reading", async () => {
        if (!active) return;
        try {
          const dashboard = await getDashboard({ deviceId, limit: 120 });
          setData(dashboard);
          setStatus("live");
          setError("");
        } catch (reason) {
          setError(reason.message);
        }
      });
      stream.onerror = () => {
        if (!active) return;
        setStatus("reconnecting");
        stream.close();
        clearTimeout(retryRef.current);
        retryRef.current = setTimeout(connect, 4000);
      };
    };
    connect();
    const fallback = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(fallback);
      clearTimeout(retryRef.current);
      stream?.close();
    };
  }, [deviceId, refresh]);

  return { data, devices, status, error, refresh };
}
