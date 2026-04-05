import { ExtractWSRequestFrom } from "@echowave/shared";
import { requireCanMutate } from "../middlewares";
import { HandlerFunction } from "../types";

export const handlePlay: HandlerFunction<
  ExtractWSRequestFrom["PLAY"]
> = async ({ ws, message }) => {
  const { room } = requireCanMutate(ws);

  // Use dynamic scheduling based on max client RTT
  const serverTimeToExecute = room.getScheduledExecutionTime();

  // Update playback state - now returns false if track doesn't exist
  const success = room.updatePlaybackSchedulePlay(message, serverTimeToExecute);

  if (!success) {
    // Track doesn't exist, don't broadcast the play command
    console.warn(`Play command rejected - track not in queue: ${message.audioSource}`);
    return;
  }

  room.broadcast({
    type: "SCHEDULED_ACTION",
    scheduledAction: message,
    serverTimeToExecute: serverTimeToExecute,
    // Dynamic delay based on actual client RTTs
  });
};
