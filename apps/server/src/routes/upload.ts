import {
  GetUploadUrlSchema,
  UploadCompleteResponseType,
  UploadCompleteSchema,
  UploadUrlResponseType,
} from "@echowave/shared";
import {
  createKey,
  generateAudioFileName,
  generatePresignedUploadUrl,
  getPublicAudioUrl,
  validateR2Config,
} from "../lib/storage";
import { globalManager } from "../managers";
import { errorResponse, jsonResponse } from "../utils/responses";

// New endpoint to get presigned upload URL
export const handleGetPresignedURL = async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405);
    }

    // Validate configuration
    // Local storage always valid effectively
    // const r2Validation = validateR2Config(); 

    const body = await req.json();
    const parseResult = GetUploadUrlSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(
        `Invalid request data: ${parseResult.error.message}`,
        400
      );
    }

    const { roomId, fileName, contentType } = parseResult.data;

    // Check if room exists
    const room = globalManager.getRoom(roomId);
    if (!room) {
      return errorResponse(
        "Room not found. Please join the room before uploading files.",
        404
      );
    }

    // Generate unique filename
    const uniqueFileName = generateAudioFileName(fileName);
    const r2Key = createKey(roomId, uniqueFileName);

    // Get base URL from request for LAN support
    const url = new URL(req.url);
    const protocol = url.protocol;
    const host = req.headers.get("host") || url.host;
    const baseUrl = `${protocol}//${host}`;

    // Generate presigned URL for upload
    // For local, this is a path to our PUT handler
    const uploadUrl = await generatePresignedUploadUrl(
      roomId,
      uniqueFileName,
      contentType,
      3600,
      baseUrl
    );
    const publicUrl = getPublicAudioUrl(roomId, uniqueFileName, baseUrl);

    console.log(`Generated upload URL: ${uploadUrl}`);

    const response: UploadUrlResponseType = {
      uploadUrl,
      publicUrl,
    };

    return jsonResponse(response);
  } catch (error) {
    console.error("Error generating upload URL:", error);
    return errorResponse("Failed to generate upload URL", 500);
  }
};

// Endpoint to confirm successful upload and broadcast to room
export const handleUploadComplete = async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405);
    }

    const body = await req.json();
    const parseResult = UploadCompleteSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(
        `Invalid request data: ${parseResult.error.message}`,
        400
      );
    }

    const { roomId, originalName, publicUrl } = parseResult.data;

    // Check if room exists
    const room = globalManager.getRoom(roomId);
    if (!room) {
      return errorResponse(
        "Room not found. The room may have been closed during upload.",
        404
      );
    }

    const sources = room.addAudioSource({ url: publicUrl });

    console.log(
      `✅ Audio upload completed - broadcasting to room ${roomId} new sources: ${sources.length}`
    );

    // Broadcast to room that new audio is available
    room.broadcast({
      type: "ROOM_EVENT",
      event: {
        type: "SET_AUDIO_SOURCES",
        sources,
      },
    });

    const response: UploadCompleteResponseType = { success: true };
    return jsonResponse(response);
  } catch (error) {
    console.error("Error confirming upload:", error);
    return errorResponse("Failed to confirm upload", 500);
  }
};
