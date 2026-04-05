import { ExtractWSRequestFrom } from "@echowave/shared";
import { requireRoom } from "../middlewares";
import { HandlerFunction } from "../types";

export const handleMoveClient: HandlerFunction<
  ExtractWSRequestFrom["MOVE_CLIENT"]
> = async ({ ws, message }) => {
  // Handle client move
  const { room } = requireRoom(ws);
  room.moveClient(message.clientId, message.position);
};
