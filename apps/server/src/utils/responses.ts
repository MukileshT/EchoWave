import { WSUnicastType } from "@echowave/shared";
import { MyWebSocket } from "./websocket";
import { WebSocket } from "ws";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "Access-Control-Allow-Headers": "*",
};

// Helper functions for common responses
export const jsonResponse = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders,
  });

export const errorResponse = (message: string, status = 400) =>
  new Response(message, {
    status,
    headers: corsHeaders,
  });

export const sendUnicast = ({
  ws,
  message,
}: {
  ws: MyWebSocket;
  message: WSUnicastType;
}) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
};
