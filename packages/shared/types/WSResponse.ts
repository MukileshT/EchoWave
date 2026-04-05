import { z } from "zod";
import { WSBroadcastSchema } from "./WSBroadcast";
import { WSUnicastSchema } from "./WSUnicast";
export const WSResponseSchema = z.union([WSUnicastSchema, WSBroadcastSchema]);
export type WSResponseType = z.infer<typeof WSResponseSchema>;
