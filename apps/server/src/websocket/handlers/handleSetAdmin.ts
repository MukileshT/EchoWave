import { ExtractWSRequestFrom } from "@echowave/shared";
import { requireRoomAdmin } from "../middlewares";
import { HandlerFunction } from "../types";

export const handleSetAdmin: HandlerFunction<
  ExtractWSRequestFrom["SET_ADMIN"]
> = async ({ ws, message }) => {
  const { room } = requireRoomAdmin(ws);
  room.setAdmin({
    targetClientId: message.clientId,
    isAdmin: message.isAdmin,
  });

  room.broadcast({
    type: "ROOM_EVENT",
    event: {
      type: "CLIENT_CHANGE",
      clients: room.getClients(),
    },
  });
};
