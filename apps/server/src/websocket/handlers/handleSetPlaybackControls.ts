import { ExtractWSRequestFrom } from "@echowave/shared";
import { requireRoomAdmin } from "../middlewares";
import { HandlerFunction } from "../types";

export const handleSetPlaybackControls: HandlerFunction<
  ExtractWSRequestFrom["SET_PLAYBACK_CONTROLS"]
> = async ({ ws, message }) => {
  const { room } = requireRoomAdmin(ws);
  room.setPlaybackControls(message.permissions);

  // Echo
  room.broadcast({
    type: "ROOM_EVENT",
    event: {
      type: "SET_PLAYBACK_CONTROLS",
      permissions: message.permissions,
    },
  });
};
