import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDashboardSummaryQueryKey,
  getGetLatestSensorReadingsQueryKey,
  getGetPumpsQueryKey,
  getGetAlertsQueryKey,
} from "@workspace/api-client-react";

type WSEvent =
  | { type: "sensor_update"; data: Record<string, unknown> }
  | { type: "pump_status"; data: Record<string, unknown> }
  | { type: "alert_acknowledged"; data: { id: number } }
  | { type: "alert_created"; data: Record<string, unknown> }
  | { type: "zone_updated"; data: Record<string, unknown> }
  | { type: "ping" };

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useRealtimeUpdates() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const mountedRef = useRef(true);

  const handleEvent = useCallback(
    (event: WSEvent) => {
      switch (event.type) {
        case "sensor_update":
          queryClient.invalidateQueries({ queryKey: getGetLatestSensorReadingsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          break;
        case "pump_status":
          queryClient.invalidateQueries({ queryKey: getGetPumpsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          break;
        case "alert_acknowledged":
        case "alert_created":
          queryClient.invalidateQueries({ queryKey: getGetAlertsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          break;
        case "zone_updated":
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          break;
        case "ping":
          break;
      }
    },
    [queryClient]
  );

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptsRef.current = 0;
    };

    ws.onmessage = (msg) => {
      try {
        const event: WSEvent = JSON.parse(msg.data);
        handleEvent(event);
      } catch {}
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      if (attemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        attemptsRef.current += 1;
        setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [handleEvent]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      wsRef.current?.close();
    };
  }, [connect]);
}
