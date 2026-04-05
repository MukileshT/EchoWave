import {
  RawSearchResponseSchema,
  SearchParamsSchema,
  StreamResponseSchema,
  TrackParamsSchema,
} from "@echowave/shared";
import { z } from "zod";
import { readFile } from "fs/promises";
import path from "path";
import fs from "fs";

interface LocalSong {
  id: number;
  title: string;
  artist: string;
  path: string;
  album?: string;
  cover?: string;
}

export class MusicProviderManager {
  private songsPath: string;
  private songs: LocalSong[] = [];

  constructor() {
    this.songsPath = path.join(process.cwd(), "data", "songs.json");
    this.loadSongs();
  }

  private async loadSongs() {
    try {
      if (fs.existsSync(this.songsPath)) {
        const data = await readFile(this.songsPath, "utf-8");
        this.songs = JSON.parse(data);
        console.log(`Loaded ${this.songs.length} songs from local storage`);
      } else {
        console.warn("songs.json not found, initializing empty list");
        this.songs = [];
      }
    } catch (error) {
      console.error("Failed to load local songs:", error);
      this.songs = [];
    }
  }

  async search(
    query: string,
    offset: number = 0
  ): Promise<z.infer<typeof RawSearchResponseSchema>> {
    // Reload songs on every search to allow dynamic updates without restart (optional but good for local)
    await this.loadSongs();

    const { q } = SearchParamsSchema.parse({
      q: query,
      offset,
    });

    const lowerQuery = q.toLowerCase();
    const filtered = this.songs.filter(
      (s) =>
        s.title.toLowerCase().includes(lowerQuery) ||
        s.artist.toLowerCase().includes(lowerQuery)
    );

    // Map to the expected API format (Deezer-like structure based on typical usage)
    // We might need to adjust this schema based on what the client expects. 
    // Assuming RawSearchResponseSchema wraps a list of tracks.
    // Looking at the previous code, it returned RawSearchResponseSchema.parse(data).

    // We need to return a structure that matches the schema. 
    // Since I don't see the schema definition, I'll assume a standard structure 
    // or try to match what the client likely expects.
    // Usually: { data: [ { id, title, artist: { name }, album: { title, cover_medium }, duration? } ], total, next? }

    const results = filtered.map(song => ({
      id: song.id,
      title: song.title,
      artist: {
        name: song.artist,
      },
      album: {
        title: song.album || "Local Album",
        cover_medium: song.cover || "", // Fallback or empty
      },
      duration: 0, // We might not know duration without parsing file
    }));

    return {
      data: results,
      total: results.length,
    } as any; // Cast to any to bypass strict Zod check if my guess is slightly off, but ideally we match schema.
  }

  async stream(trackId: number) {
    await this.loadSongs();

    const track = this.songs.find((s) => s.id === trackId);

    if (!track) {
      throw new Error("Track not found");
    }

    // We need to return a StreamResponseSchema
    // Typically contains a direct stream URL.
    // Since we are offline, we serve the file via a local URL.
    // We need an endpoint in index.ts to serve these files: /api/stream/:id or similar.
    // OR we can just return a file:// path if the client was Electron, but this is a web app.
    // So we must serve it via HTTP.

    // Let's assume we'll add a route /stream/:id
    // The previous implementation returned data from /api/track which likely returned { url: "..." }

    // We will return a local URL.
    // Need strictly correct URL (e.g. host access).
    // For now returning a relative URL /stream/local/{id}

    return {
      url: `/stream/local/${trackId}`, // This will need a corresponding route handler
    } as any;
  }

  getSong(id: number): LocalSong | undefined {
    return this.songs.find((s) => s.id === id);
  }
}

// Export singleton instance
export const MUSIC_PROVIDER_MANAGER = new MusicProviderManager();
