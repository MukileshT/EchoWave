import { ExtractWSRequestFrom } from "@echowave/shared";
import { requireCanMutate } from "../middlewares";
import { HandlerFunction } from "../types";

export const handleReorderClient: HandlerFunction<
  ExtractWSRequestFrom["REORDER_CLIENT"]
> = async ({ ws, message }) => {
  // Handle client reordering
  const { room } = requireCanMutate(ws);

  const reorderedClients = room.reorderClients(message.clientId);

  // Broadcast the updated client order to all clients
  room.broadcast({
    type: "ROOM_EVENT",
    event: {
      type: "CLIENT_CHANGE",
      clients: reorderedClients,
    },
  });
};
