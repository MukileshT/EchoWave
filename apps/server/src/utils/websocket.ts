import { WebSocket } from "ws";

export interface WSData {
  roomId: string;
  clientId: string;
  username: string;
}

export type MyWebSocket = WebSocket & { data: WSData };
