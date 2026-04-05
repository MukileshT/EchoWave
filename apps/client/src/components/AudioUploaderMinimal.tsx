"use client";

import { uploadAudioFile } from "@/lib/api";
import { cn, trimFileName } from "@/lib/utils";
import { useCanMutate } from "@/store/global";
import { useRoomStore } from "@/store/room";
import { CloudUpload, FolderOpen, Plus } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { toast } from "sonner";

export const AudioUploaderMinimal = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const canMutate = useCanMutate();
  const roomId = useRoomStore((state) => state.roomId);
  const posthog = usePostHog();

  const isDisabled = !canMutate;

  const handleFileUpload = async (file: File) => {
    if (isDisabled) return;

    // Store file name for display
    setFileName(file.name);

    // Track upload initiated
    posthog.capture("upload_initiated", {
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      room_id: roomId,
    });

    try {
      setIsUploading(true);

      // Upload the file to the server as binary
      await uploadAudioFile({
        file,
        roomId,
      });

      // Track successful upload
      posthog.capture("upload_success", {
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        room_id: roomId,
      });

      setTimeout(() => setFileName(null), 3000);
    } catch (err) {
      console.error("Error during upload:", err);
      toast.error("Failed to upload audio file");
      setFileName(null);

      // Track upload failure
      posthog.capture("upload_failed", {
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        room_id: roomId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleMultipleFiles = async (files: FileList) => {
    if (isDisabled || files.length === 0) return;

    const allFiles = Array.from(files);
    const audioFiles = allFiles.filter((file) => {
      // Check by MIME type and file extension as fallback
      const isAudioType = file.type.startsWith("audio/");
      const hasAudioExt = /\.(mp3|wav|m4a|aac|ogg|webm|flac)$/i.test(file.name);
      return isAudioType || hasAudioExt;
    });

    const skippedCount = allFiles.length - audioFiles.length;

    if (audioFiles.length === 0) {
      toast.error("No audio files found in selection");
      return;
    }

    // Notify user about filtered files
    if (skippedCount > 0) {
      toast.info(
        `Found ${audioFiles.length} audio file${audioFiles.length > 1 ? 's' : ''}, skipped ${skippedCount} non-audio file${skippedCount > 1 ? 's' : ''}`
      );
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: audioFiles.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      setFileName(file.name);
      setUploadProgress({ current: i + 1, total: audioFiles.length });

      try {
        await uploadAudioFile({
          file,
          roomId,
        });

        successCount++;

        posthog.capture("upload_success", {
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          room_id: roomId,
          batch_upload: true,
        });
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err);
        failCount++;

        posthog.capture("upload_failed", {
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          room_id: roomId,
          error: err instanceof Error ? err.message : "Unknown error",
          batch_upload: true,
        });
      }

      // Small delay between uploads to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Show summary toast
    if (successCount > 0 && failCount === 0) {
      toast.success(`Successfully uploaded ${successCount} file${successCount > 1 ? 's' : ''}`);
    } else if (successCount > 0 && failCount > 0) {
      toast.warning(
        `Uploaded ${successCount} file${successCount > 1 ? 's' : ''}, ${failCount} failed`
      );
    } else {
      toast.error(`Failed to upload ${failCount} file${failCount > 1 ? 's' : ''}`);
    }

    setIsUploading(false);
    setUploadProgress(null);
    setTimeout(() => setFileName(null), 2000);
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isDisabled) return;
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (files.length === 1) {
      handleFileUpload(files[0]);
    } else {
      handleMultipleFiles(files);
    }
  };

  const onFolderInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isDisabled) return;
    const files = event.target.files;
    if (!files || files.length === 0) return;
    handleMultipleFiles(files);
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const onDropEvent = (event: React.DragEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    if (files.length === 1) {
      const file = files[0];
      const isAudioType = file.type.startsWith("audio/");
      const hasAudioExt = /\.(mp3|wav|m4a|aac|ogg|webm|flac)$/i.test(file.name);
      
      if (!isAudioType && !hasAudioExt) {
        toast.error("Please select an audio file");
        return;
      }
      handleFileUpload(file);
    } else {
      handleMultipleFiles(files);
    }
  };

  return (
    <div
      className={cn(
        "border border-neutral-700/50 rounded-md mx-2 transition-all overflow-hidden",
        isDisabled
          ? "bg-neutral-800/20 opacity-50"
          : "bg-neutral-800/30 hover:bg-neutral-800/50",
        isDragging && !isDisabled
          ? "outline outline-primary-400 outline-dashed"
          : "outline-none"
      )}
      id="drop_zone"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDragEnd={onDragLeave}
      onDrop={onDropEvent}
      title={
        isDisabled ? "Admin-only mode - only admins can upload" : undefined
      }
    >
      <label
        htmlFor="audio-upload"
        className={cn("block w-full", isDisabled ? "" : "cursor-pointer")}
      >
        <div className="p-3 flex items-center gap-3">
          <div
            className={cn(
              "p-1.5 rounded-md flex-shrink-0",
              isDisabled
                ? "bg-neutral-600 text-neutral-400"
                : "bg-primary-700 text-white"
            )}
          >
            {isUploading ? (
              <CloudUpload className="h-4 w-4 animate-pulse" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">
              {isUploading && uploadProgress
                ? `Uploading ${uploadProgress.current}/${uploadProgress.total}...`
                : isUploading
                ? "Uploading..."
                : fileName
                ? trimFileName(fileName)
                : "Upload audio"}
            </div>
            {!isUploading && !fileName && (
              <div
                className={cn(
                  "text-xs truncate",
                  isDisabled ? "text-neutral-500" : "text-neutral-400"
                )}
              >
                {isDisabled
                  ? "Must be an admin to upload"
                  : "Add music to queue"}
              </div>
            )}
            {uploadProgress && (
              <div className="w-full bg-neutral-700 rounded-full h-1 mt-1">
                <div
                  className="bg-primary-500 h-1 rounded-full transition-all duration-300"
                  style={{
                    width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </label>

      <input
        id="audio-upload"
        type="file"
        accept="audio/mpeg,audio/mp3,audio/wav,audio/aac,audio/ogg,audio/webm,audio/flac,.mp3,.wav,.m4a,.aac,.ogg,.webm,.flac"
        onChange={onInputChange}
        disabled={isUploading || isDisabled}
        className="hidden"
        multiple
      />

      <input
        id="folder-upload"
        type="file"
        // @ts-expect-error - webkitdirectory is not in TypeScript types but is widely supported
        webkitdirectory=""
        directory=""
        multiple
        onChange={onFolderInputChange}
        disabled={isUploading || isDisabled}
        className="hidden"
      />

      {/* Folder upload button */}
      <label
        htmlFor="folder-upload"
        className={cn(
          "block w-full border-t border-neutral-700/50",
          isDisabled ? "" : "cursor-pointer"
        )}
        title={
          isDisabled ? "Admin-only mode - only admins can upload" : "Upload folder of songs"
        }
      >
        <div className="p-2 flex items-center gap-2 hover:bg-neutral-800/40 transition-colors">
          <div
            className={cn(
              "p-1 rounded-md flex-shrink-0",
              isDisabled
                ? "bg-neutral-600 text-neutral-400"
                : "bg-primary-700/50 text-white"
            )}
          >
            <FolderOpen className="h-3 w-3" />
          </div>
          <div className="text-xs text-neutral-400">
            {isDisabled ? "Admin-only" : "Upload folder"}
          </div>
        </div>
      </label>
    </div>
  );
};
