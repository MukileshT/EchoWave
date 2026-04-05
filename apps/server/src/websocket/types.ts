import {
  ClientActionEnum,
  ExtractWSRequestFrom,
  WSRequestType,
} from "@echowave/shared";
import { z } from "zod";
import { MyWebSocket, WSData } from "../utils/websocket";

// Base handler function type
export type HandlerFunction<T = WSRequestType> = (data: {
  ws: MyWebSocket;
  message: T;
  // server argument removed as we broadcast via RoomManager
}) => Promise<void>;

// Handler definition map type
export type WebsocketRegistry = {
  [ClientAction in z.infer<typeof ClientActionEnum>]: {
    handle: HandlerFunction<ExtractWSRequestFrom[ClientAction]>;
    description?: string;
  };
};
