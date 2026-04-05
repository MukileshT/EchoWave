import { ExtractWSRequestFrom } from "@echowave/shared";
import { requireCanMutate } from "../middlewares";
import { HandlerFunction } from "../types";

export const handlePause: HandlerFunction<
  ExtractWSRequestFrom["PAUSE"]
> = async ({ ws, message }) => {
  const { room } = requireCanMutate(ws);

  // Use dynamic scheduling based on max client RTT
  const serverTimeToExecute = room.getScheduledExecutionTime();

  // Update playback state
  const success = room.updatePlaybackSchedulePause(
    message,
    serverTimeToExecute
  );

  if (!success) {
    // Track doesn't exist, don't broadcast the pause command
    console.warn(
      `Pause command rejected - track not in queue: ${message.audioSource}`
    );
    return;
  }

  room.broadcast({
    type: "SCHEDULED_ACTION",
    scheduledAction: message,
    serverTimeToExecute: serverTimeToExecute,
    // Dynamic delay based on actual client RTTs
  });
};
