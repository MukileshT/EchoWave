import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { WebSocketServer } from "ws";
import path from "path";
import { BackupManager } from "./managers/BackupManager";
import { getActiveRooms } from "./routes/active";
import { handleGetDefaultAudio } from "./routes/default";
import { handleDiscover } from "./routes/discover";
import { handleRoot } from "./routes/root";
import { handleStats } from "./routes/stats";
import { handleGetPresignedURL, handleUploadComplete } from "./routes/upload";
import {
  handleClose,
  handleMessage,
  handleOpen,
} from "./routes/websocketHandlers";
import { uploadBytes } from "./lib/storage";
import { corsHeaders } from "./utils/responses";
import { MyWebSocket } from "./utils/websocket";
import { MUSIC_PROVIDER_MANAGER } from "./managers/MusicProviderManager";
import fs from "fs";

const app = new Hono();

// Global server instances
let server: any;
let wss: any;

// CORS Middleware
app.use("/*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    // Return explicit CORS response for OPTIONS
    return new Response(null, { headers: corsHeaders });
  }

  await next();

  // Append CORS headers to all responses
  Object.entries(corsHeaders).forEach(([k, v]) => {
    c.res.headers.set(k, v);
  });
});

// Routes
app.get("/", (c) => handleRoot(c.req.raw));
app.get("/active-rooms", (c) => getActiveRooms(c.req.raw));
app.get("/default", (c) => handleGetDefaultAudio(c.req.raw));
app.get("/discover", (c) => handleDiscover(c.req.raw));
app.get("/stats", () => handleStats());

// Stream local audio
app.get("/stream/local/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.text("Invalid ID", 400);

  const song = MUSIC_PROVIDER_MANAGER.getSong(id);
  if (!song) return c.text("Song not found", 404);

  try {
    const stat = await fs.promises.stat(song.path);
    const fileSize = stat.size;
    const range = c.req.header("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(song.path, { start, end });

      const headers = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": "audio/mpeg",
      };

      // Hono stream response?
      // Hono's c.body with stream not fully typed for Node Readable in strict mode sometimes?
      // Use standard Response
      // @ts-ignore
      return new Response(file, { status: 206, headers });
    } else {
      const headers = {
        "Content-Length": fileSize.toString(),
        "Content-Type": "audio/mpeg",
      };
      // @ts-ignore
      return new Response(fs.createReadStream(song.path), { status: 200, headers });
    }
  } catch (e) {
    console.error("Stream error", e);
    return c.text("Error streaming file", 500);
  }
});

app.post("/upload/get-presigned-url", (c) => handleGetPresignedURL(c.req.raw));
app.post("/upload/complete", (c) => handleUploadComplete(c.req.raw));

// Local PUT upload handler
app.put("/upload/put", async (c) => {
  const roomId = c.req.query("roomId");
  const fileName = c.req.query("fileName");
  const contentType = c.req.query("contentType") || "audio/mpeg";

  if (!roomId || !fileName) {
    return c.text("Missing roomId or fileName", 400);
  }

  try {
    const body = await c.req.arrayBuffer();
    const url = await uploadBytes(body, roomId, fileName, contentType);
    return c.json({ url });
  } catch (error) {
    console.error("Upload failed", error);
    return c.text("Upload failed", 500);
  }
});

// Serve static files from storage with CORS headers and range request support
app.use("/storage/*", async (c, next) => {
  const pathname = c.req.path.replace("/storage/", "");
  const fullPath = path.join(process.cwd(), "storage", pathname);

  // Verify the file exists and is within storage directory
  if (!fullPath.startsWith(path.join(process.cwd(), "storage"))) {
    return c.text("Forbidden", 403);
  }

  try {
    const stat = await fs.promises.stat(fullPath);
    const fileSize = stat.size;
    const range = c.req.header("range");

    // Determine MIME type
    const mimeType = pathname.endsWith(".mp3")
      ? "audio/mpeg"
      : pathname.endsWith(".wav")
        ? "audio/wav"
        : pathname.endsWith(".ogg")
          ? "audio/ogg"
          : "application/octet-stream";

    if (range) {
      // Handle range requests
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        return c.text("Range Not Satisfiable", 416);
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(fullPath, { start, end });

      return new Response(file as any, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize.toString(),
          "Content-Type": mimeType,
          ...corsHeaders,
        },
      });
    } else {
      // Handle full file request
      const file = fs.createReadStream(fullPath);
      return new Response(file as any, {
        status: 200,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Length": fileSize.toString(),
          "Content-Type": mimeType,
          ...corsHeaders,
        },
      });
    }
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return c.text("Not Found", 404);
    }
    console.error(`Error serving ${pathname}:`, error);
    return c.text("Internal Server Error", 500);
  }
});

// Port finding and server start logic
const startServer = async (initialPort: number) => {
  let port = initialPort;
  const maxRetries = 10;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const s = serve({
          fetch: app.fetch,
          port,
        }, (info) => {
          console.log(`HTTP listening on http://${info.address}:${info.port}`);
          // Also log LAN IP
          const { networkInterfaces } = require("os");
          const nets = networkInterfaces();
          for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
              if (net.family === "IPv4" && !net.internal) {
                console.log(`> LAN Access: http://${net.address}:${info.port}`);
              }
            }
          }
          resolve();
        });

        // @ts-ignore
        const wsServer = new WebSocketServer({ server: s });

        wsServer.on("connection", (ws, req) => {
          const url = new URL(req.url || "", `http://${req.headers.host}`);
          const roomId = url.searchParams.get("roomId");
          const username = url.searchParams.get("username");
          const clientId = url.searchParams.get("clientId");

          if (!roomId || !username || !clientId) {
            console.log("WebSocket connection missing parameters, closing.");
            ws.close(1008, "Missing parameters");
            return;
          }

          // Attach data to standard WS
          const myWs = ws as MyWebSocket;
          myWs.data = {
            roomId,
            username,
            clientId,
          };

          handleOpen(myWs);

          ws.on("message", (message) => {
            // ws message is RawData (Buffer | ArrayBuffer | Buffer[]), expect string | Buffer
            // In node ws, message is usually Buffer or ArrayBuffer.
            handleMessage(myWs, message as unknown as Buffer);
          });

          ws.on("close", () => {
            handleClose(myWs);
          });

          ws.on("error", (error) => {
            console.error(`WebSocket error for ${username}:`, error);
          });
        });

        // Assign to global variables
        server = s;
        wss = wsServer;

        s.on('error', (e: any) => {
          if (e.code === 'EADDRINUSE') {
            console.log(`Port ${port} is busy, trying ${port + 1}...`);
            reject(e);
          } else {
            console.error('Server error:', e);
          }
        });
      });
      return; // Successfully started
    } catch (e: any) {
      if (e.code === 'EADDRINUSE') {
        port++;
        // If we failed in the serve callback (async), we might need better handling, 
        // but @hono/node-server usually throws synchronously if port is busy? 
        // Actually serve() returns a Server object which emits 'error'.
        // The above promise wrapping attempts to catch this.
        // However, node http server listen is async. 
        // This simple retry block is a basic attempt. 
        continue;
      }
      throw e;
    }
  }
  console.error("Could not find a free port to bind to.");
  process.exit(1);
};

console.log(`Starting server...`);
startServer(8080);


// Restore state from backup on startup
BackupManager.restoreState().catch((error) => {
  console.error("Failed to restore state on startup:", error);
});

// Set up periodic backups
const BACKUP_INTERVAL_MS = 60 * 1000; // 1 minute
setInterval(() => {
  // console.log("🔄 Performing periodic backup at", new Date().toISOString());
  BackupManager.backupState().catch((error) => {
    console.error("Failed to perform periodic backup:", error);
  });
}, BACKUP_INTERVAL_MS);

// Simple graceful shutdown
const shutdown = async () => {
  console.log("\n⚠️ Shutting down...");

  if (server) server.close();
  if (wss) wss.close();
  await BackupManager.backupState(); // Save state

  process.exit(0);
};

// Handle shutdown signals
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
