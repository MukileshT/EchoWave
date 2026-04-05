import { ExtractWSRequestFrom } from "@echowave/shared";
import { requireRoom } from "../middlewares";
import { HandlerFunction } from "../types";

export const handleSendIp: HandlerFunction<
  ExtractWSRequestFrom["SEND_IP"]
> = async ({ ws, message }) => {
  const { room } = requireRoom(ws);

  room.processIP({ ws, message });

  room.broadcast({
    type: "ROOM_EVENT",
    event: {
      type: "CLIENT_CHANGE",
      clients: room.getClients(),
    },
  });
};
