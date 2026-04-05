import { ExtractWSRequestFrom } from "@echowave/shared";
import { requireCanMutate } from "../middlewares";
import { HandlerFunction } from "../types";

export const handleSetListeningSource: HandlerFunction<
  ExtractWSRequestFrom["SET_LISTENING_SOURCE"]
> = async ({ ws, message }) => {
  // Handle listening source update
  const { room } = requireCanMutate(ws);

  room.updateListeningSource(message);
};
