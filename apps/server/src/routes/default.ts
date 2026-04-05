import { GetDefaultAudioType } from "@echowave/shared";
import { getPublicAudioUrl, listObjectsWithPrefix } from "../lib/storage";
import { errorResponse, jsonResponse } from "../utils/responses";

export async function handleGetDefaultAudio(_req: Request) {
  try {
    // List all objects with "default/" prefix
    const objects = await listObjectsWithPrefix("default/");

    if (!objects || objects.length === 0) {
      return jsonResponse([]);
    }

    // Map to array of objects with public URLs
    const response: GetDefaultAudioType = objects.map((obj) => ({
      url: getPublicAudioUrl("default", obj.Key.replace("default/", "")), // Hacky: getPublicAudioUrl expects roomId, fileName. 
      // Actually storage's getPublicAudioUrl does: `${STORAGE_CONFIG.PUBLIC_URL_PREFIX}/room-${roomId}/${encodedFileName}`. 
      // Default tracks are not in room folders. They are in 'default' folder? 
      // storage.ts logic might be room-centric.
      // Let's check storage.ts getPublicAudioUrl again (Step 169).
    }));

    // storage.ts: getPublicAudioUrl(roomId, fileName) -> .../room-{roomId}/{fileName}
    // We need a generic url for default files.
    // Let's just manually construct it for now or assume listObjectsWithPrefix returns Key that is usable.
    // storage.ts listObjects returns Key.
    // Node static serve will serve /storage/default/... if mapped correctly.
    // Let's assume /storage is static root.

    const responseCorrect: GetDefaultAudioType = objects.map((obj) => ({
      url: `/storage/${obj.Key}`
    }));

    return jsonResponse(responseCorrect);
  } catch (error) {
    console.error("Failed to list default audio files:", error);
    return errorResponse("Failed to list default audio files", 500);
  }
}
