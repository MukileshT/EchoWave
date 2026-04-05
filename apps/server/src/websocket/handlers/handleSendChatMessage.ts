import { SendChatMessageSchema } from "@echowave/shared/types/WSRequest";
import { z } from "zod";
import { MyWebSocket, WSData } from "../../utils/websocket";
import { requireRoom } from "../middlewares";

export async function handleSendChatMessage({
  ws,
  message,
}: {
  ws: MyWebSocket;
  message: z.infer<typeof SendChatMessageSchema>;
}) {
  const { room } = requireRoom(ws);

  try {
    const chatMessage = room.addChatMessage({
      clientId: ws.data.clientId,
      text: message.text,
    });

    // Get the newest ID after adding the message
    const newestId = room.getNewestChatId();

    // Broadcast to all clients in room
    room.broadcast({
      type: "ROOM_EVENT",
      event: {
        type: "CHAT_UPDATE",
        messages: [chatMessage], // Single message for new chat
        isFullSync: false, // This is an incremental update
        newestId, // Latest message ID
      },
    });
  } catch (error) {
    console.error(
      `Failed to send chat message in room ${ws.data.roomId}:`,
      error
    );
  }
}
