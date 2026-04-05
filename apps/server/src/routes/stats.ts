import * as os from "os";
import { globalManager } from "../managers";
import { corsHeaders } from "../utils/responses";

export async function handleStats(): Promise<Response> {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = process.memoryUsage(); // rss, heapTotal, heapUsed, external, arrayBuffers

  const stats = {
    memory: {
      total: `${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
      free: `${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
      used: `${(usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
      process: {
        rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`,
      },
    },
    rooms: {
      totalRooms: globalManager.getRoomCount(),
      activeUsers: await globalManager.getActiveUserCount(),
    },
  };

  return new Response(JSON.stringify(stats), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
