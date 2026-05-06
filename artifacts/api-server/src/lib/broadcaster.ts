import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";

export type BroadcastEvent =
  | { type: "sensor_update"; data: Record<string, unknown> }
  | { type: "pump_status"; data: Record<string, unknown> }
  | { type: "alert_created"; data: Record<string, unknown> }
  | { type: "alert_acknowledged"; data: { id: number } }
  | { type: "zone_updated"; data: Record<string, unknown> }
  | { type: "ping" };

let wss: WebSocketServer | null = null;

export function createWebSocketServer(server: import("http").Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    ws.send(JSON.stringify({ type: "ping" }));

    ws.on("message", (msg) => {
      try {
        const parsed = JSON.parse(String(msg));
        if (parsed.type === "ping") ws.send(JSON.stringify({ type: "ping" }));
      } catch {}
    });

    ws.on("error", () => {});
  });

  return wss;
}

export function broadcast(event: BroadcastEvent): void {
  if (!wss) return;
  const payload = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}
