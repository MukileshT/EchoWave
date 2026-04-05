import { ExtractWSRequestFrom } from "@echowave/shared/types/WSRequest";
import { requireCanMutate } from "../middlewares";
import { HandlerFunction } from "../types";

export const handleSetGlobalVolume: HandlerFunction<
  ExtractWSRequestFrom["SET_GLOBAL_VOLUME"]
> = async ({ ws, message }) => {
  const { room } = requireCanMutate(ws);

  // Set the global volume
  room.setGlobalVolume(message.volume);
};
