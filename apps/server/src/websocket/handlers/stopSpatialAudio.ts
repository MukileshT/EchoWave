import {
  ExtractWSRequestFrom,
  WSBroadcastType,
  epochNow,
} from "@echowave/shared";
import { requireCanMutate } from "../middlewares";
import { HandlerFunction } from "../types";

export const handleStopSpatialAudio: HandlerFunction<
  ExtractWSRequestFrom["STOP_SPATIAL_AUDIO"]
> = async ({ ws, message }) => {
  // Stop the spatial audio interval if it exists
  const { room } = requireCanMutate(ws); // do nothing if no room exists

  // This important for
  const broadcastMessage: WSBroadcastType = {
    type: "SCHEDULED_ACTION",
    scheduledAction: {
      type: "STOP_SPATIAL_AUDIO",
    },
    serverTimeToExecute: epochNow() + 0,
  };

  // Reset all gains:
  room.broadcast(broadcastMessage);

  room.stopSpatialAudio();
};
