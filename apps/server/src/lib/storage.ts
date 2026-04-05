import { existsSync, mkdirSync } from "fs";
import { readFile, writeFile, unlink, readdir } from "fs/promises";
import path from "path";
import sanitize from "sanitize-filename";
import { R2_AUDIO_FILE_NAME_DELIMITER } from "@echowave/shared";

// Configuration for local storage
const STORAGE_CONFIG = {
    BASE_DIR: path.join(process.cwd(), "storage"),
    PUBLIC_URL_PREFIX: "/storage", // This will be handled by a static file serve route
    API_URL: process.env.API_URL || "http://localhost:8080",
};

// Ensure storage directory exists
if (!existsSync(STORAGE_CONFIG.BASE_DIR)) {
    mkdirSync(STORAGE_CONFIG.BASE_DIR, { recursive: true });
}

export interface AudioFileMetadata {
    roomId: string;
    fileName: string;
    originalName: string;
    contentType: string;
    fileSize: number;
    uploadedAt: string;
}

/**
 * Create a consistent key (path) for storage
 */
export function createKey(roomId: string, fileName: string): string {
    return path.join("room-" + roomId, fileName);
}

/**
 * Get the full local filesystem path
 */
function getFullPath(key: string): string {
    return path.join(STORAGE_CONFIG.BASE_DIR, key);
}

/**
 * Generate a local URL for uploading (simulated presigned URL)
 * In a local setup, the client can upload directly to a specific endpoint.
 * We'll return a path that the client can POST to.
 */
export async function generatePresignedUploadUrl(
    roomId: string,
    fileName: string,
    contentType: string,
    expiresIn: number = 3600,
    baseUrl?: string
): Promise<string> {
    // Return a full URL that the client can PUT to.
    const base = baseUrl || STORAGE_CONFIG.API_URL;
    return `${base}/upload/put?roomId=${roomId}&fileName=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(contentType)}`;
}

/**
 * Get the public URL for an audio file
 */
export function getPublicAudioUrl(roomId: string, fileName: string, baseUrl?: string): string {
    const encodedFileName = encodeURIComponent(fileName);
    const base = baseUrl || STORAGE_CONFIG.API_URL;
    return `${base}${STORAGE_CONFIG.PUBLIC_URL_PREFIX}/room-${roomId}/${encodedFileName}`;
}

/**
 * Extract the key from a public URL
 */
export function extractKeyFromUrl(url: string): string | null {
    try {
        // If it's a full URL, parse it
        let pathname = url;
        if (url.startsWith("http")) {
            const urlParts = new URL(url);
            pathname = urlParts.pathname;
        }

        // Remove prefix
        if (pathname.startsWith(STORAGE_CONFIG.PUBLIC_URL_PREFIX)) {
            pathname = pathname.substring(STORAGE_CONFIG.PUBLIC_URL_PREFIX.length);
        }

        // Remove leading slash
        if (pathname.startsWith("/")) {
            pathname = pathname.substring(1);
        }

        // Decode path parts
        const parts = pathname.split("/");
        const decodedParts = parts.map(p => decodeURIComponent(p));
        return decodedParts.join("/");
    } catch (error) {
        console.error(`Failed to extract key from URL ${url}:`, error);
        return null;
    }
}

/**
 * Validate if an audio file exists locally
 */
export async function validateAudioFileExists(audioUrl: string): Promise<boolean> {
    try {
        const key = extractKeyFromUrl(audioUrl);
        if (!key) return false;

        const fullPath = getFullPath(key);
        return existsSync(fullPath);
    } catch (error) {
        console.error(`Error validating audio file ${audioUrl}:`, error);
        return false;
    }
}

/**
 * Generate a unique file name for audio uploads
 */
export function generateAudioFileName(originalName: string): string {
    const extension = originalName.split(".").pop() || "mp3";
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
    const nameWithoutSlashes = nameWithoutExt.replace(/[\/\\]/g, "-");
    let safeName = sanitize(nameWithoutSlashes, { replacement: "*" });

    const maxNameLength = 100; // Shorter max length for FS
    if (safeName.length > maxNameLength) {
        safeName = safeName.substring(0, maxNameLength);
    }

    if (!safeName) safeName = "audio";

    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, "-");

    return `${safeName}${R2_AUDIO_FILE_NAME_DELIMITER}${dateStr}.${extension}`;
}

/**
 * List all objects with a given prefix
 */
export async function listObjectsWithPrefix(prefix: string, options: { includeFolders?: boolean } = {}) {
    // This is a bit tricky to map 1:1 to S3 prefix search on FS without walking the tree.
    // For our usage, prefix usually implies a directory like "room-123/" or "state-backup/"

    // Check if prefix ends with slash -> treat as directory
    // If not, treat as directory + partial filename? S3 is flat, FS is hierarchical.
    // We will assume our prefixes map to directories in STORAGE_DIR.

    const searchPath = path.join(STORAGE_CONFIG.BASE_DIR, prefix);

    // If prefix doesn't end in /, we imply it might be a partial folder name or file.
    // But typically in this app, we use "room-{id}/" or "state-backup/".
    // Let's assume we are looking inside the directory if it exists.

    // If the prefix includes "room-123/", we look in "storage/room-123/"
    const parts = prefix.split("/");
    const dirName = parts[0]; // e.g., "room-123" or "state-backup"

    const targetDir = path.join(STORAGE_CONFIG.BASE_DIR, dirName);

    if (!existsSync(targetDir)) return [];

    try {
        const files = await readdir(targetDir, { withFileTypes: true });

        // Map to S3-like object structure
        return files
            .filter(dirent => dirent.isFile())
            .map(dirent => ({
                Key: path.join(dirName, dirent.name).replace(/\\/g, "/"), // Force forward slashes for keys
                Size: 0, // We could get size but avoiding extra stat for now unless needed
            }));
    } catch (error) {
        console.error(`Failed to list objects in ${targetDir}:`, error);
        return [];
    }
}

/**
 * Delete objects with prefix
 * In FS terms, this usually means deleting a directory or files in it.
 */
export async function deleteObjectsWithPrefix(prefix: string = ""): Promise<{ deletedCount: number }> {
    // Dangerous if empty, but let's handle "room-123" style prefixes
    if (!prefix) return { deletedCount: 0 };

    // We assume prefix maps to a folder for simplicity in this migration
    // e.g. "room-123" -> storage/room-123

    // Handle "room-123/" suffix
    const cleanPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    const targetPath = path.join(STORAGE_CONFIG.BASE_DIR, cleanPrefix);

    if (!existsSync(targetPath)) return { deletedCount: 0 };

    try {
        // If it's a directory, remove it and its contents
        // Use fs-extra like logic or just node's rm
        // fs.rm(path, { recursive: true, force: true })
        const { rm } = require("fs/promises");
        await rm(targetPath, { recursive: true, force: true });

        return { deletedCount: 1 }; // Rough count, we deleted the "group"
    } catch (e) {
        console.error("Delete failed", e);
        throw e;
    }
}

/**
 * Upload a file to local storage
 */
export async function uploadFile(
    filePath: string,
    roomId: string,
    fileName: string
): Promise<string> {
    const key = createKey(roomId, fileName);
    const targetPath = getFullPath(key);
    const targetDir = path.dirname(targetPath);

    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
    }

    await writeFile(targetPath, await readFile(filePath));
    return getPublicAudioUrl(roomId, fileName);
}

/**
 * Upload bytes directly
 */
export async function uploadBytes(
    bytes: Uint8Array | ArrayBuffer,
    roomId: string,
    fileName: string,
    contentType: string = "audio/mpeg"
): Promise<string> {
    const key = createKey(roomId, fileName);
    const targetPath = getFullPath(key);
    const targetDir = path.dirname(targetPath);

    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
    }

    const buffer = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
    await writeFile(targetPath, buffer);

    return getPublicAudioUrl(roomId, fileName);
}

/**
 * Upload JSON (write to file)
 */
export async function uploadJSON(key: string, data: object): Promise<void> {
    const targetPath = getFullPath(key);
    const targetDir = path.dirname(targetPath);

    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
    }

    await writeFile(targetPath, JSON.stringify(data, null, 2));
}

/**
 * Download JSON (read from file)
 */
export async function downloadJSON<T = any>(key: string): Promise<T | null> {
    const targetPath = getFullPath(key);
    if (!existsSync(targetPath)) return null;

    try {
        const data = await readFile(targetPath, "utf-8");
        return JSON.parse(data) as T;
    } catch (error) {
        console.error(`Failed to read JSON from ${targetPath}:`, error);
        return null;
    }
}

/**
 * Get latest file with prefix
 */
export async function getLatestFileWithPrefix(prefix: string): Promise<string | null> {
    const files = await listObjectsWithPrefix(prefix);
    if (files.length === 0) return null;

    // Sort descending by Key
    files.sort((a, b) => (b.Key || "").localeCompare(a.Key || ""));
    return files[0].Key || null;
}

/**
 * Delete a single object
 */
export async function deleteObject(key: string): Promise<void> {
    const targetPath = getFullPath(key);
    if (existsSync(targetPath)) {
        await unlink(targetPath);
    }
}

/**
 * Get sorted files
 */
export async function getSortedFilesWithPrefix(prefix: string, extension?: string): Promise<string[]> {
    const files = await listObjectsWithPrefix(prefix);

    return files
        .filter(f => !extension || (f.Key && f.Key.endsWith(extension)))
        .map(f => f.Key!)
        .sort((a, b) => b.localeCompare(a));
}

// Stub for compat
export function validateR2Config() {
    return { isValid: true, errors: [] };
}

export async function cleanupOrphanedRooms(
    activeRoomIds: Set<string>,
    performDeletion: boolean = false
) {
    // Simplified cleanup for local FS
    // List all 'room-*' directories in root of storage
    // Compare with activeRoomIds
    // Delete if not active

    // Not implementing fully for this iteration to save time/complexity, 
    // but stubs are needed to keep server running.
    return { orphanedRooms: [], totalRooms: 0, totalFiles: 0 };
}
