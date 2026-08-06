"use client";

import { CHAT_ATTACHMENTS_BUCKET } from "@/features/chats/chat-attachments";
import { fetchAccessToken } from "@/lib/supabase/access-token-client";
import { getBrowserSupabaseConfig } from "@/lib/supabase/client";

export type ChatUploadPhase = "uploading";

export type ChatUploadProgressUpdate = {
  percent: number;
  loaded: number;
  total: number;
  bytesPerSecond: number;
  phase: ChatUploadPhase;
};

type UploadChatAttachmentOptions = {
  bucket?: string;
  upsert?: boolean;
  onProgress?: (update: ChatUploadProgressUpdate) => void;
};

function buildStorageUploadUrl(bucket: string, path: string, supabaseUrl: string): string {
  const normalizedBase = supabaseUrl.replace(/\/$/, "");
  const normalizedPath = path.replace(/^\/+/, "");

  return `${normalizedBase}/storage/v1/object/${bucket}/${normalizedPath}`;
}

function uploadViaXhr(
  body: File | Blob,
  url: string,
  accessToken: string,
  anonKey: string,
  options: {
    upsert?: boolean;
    onProgress?: (update: ChatUploadProgressUpdate) => void;
  } = {},
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let lastLoaded = 0;
    let lastTime = performance.now();

    const formData = new FormData();
    formData.append("cacheControl", "3600");
    formData.append("", body);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || !options.onProgress) {
        return;
      }

      const now = performance.now();
      const elapsedSeconds = (now - lastTime) / 1000;
      const loadedDelta = event.loaded - lastLoaded;
      const bytesPerSecond =
        elapsedSeconds > 0 ? loadedDelta / elapsedSeconds : 0;

      lastLoaded = event.loaded;
      lastTime = now;

      options.onProgress({
        percent: Math.min(100, (event.loaded / event.total) * 100),
        loaded: event.loaded,
        total: event.total,
        bytesPerSecond,
        phase: "uploading",
      });
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ success: true });
        return;
      }

      resolve({
        success: false,
        error:
          xhr.responseText?.trim() ||
          `Upload failed with status ${xhr.status}.`,
      });
    });

    xhr.addEventListener("error", () => {
      resolve({ success: false, error: "Network error during upload." });
    });

    xhr.addEventListener("abort", () => {
      resolve({ success: false, error: "Upload cancelled." });
    });

    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("x-upsert", options.upsert ? "true" : "false");
    xhr.send(formData);
  });
}

/**
 * Uploads a file/blob directly to a presigned URL (Cloudflare R2) via HTTP PUT,
 * reporting upload progress. The `contentType` MUST match the one the URL was
 * signed with, otherwise the signature check fails.
 */
export function uploadToPresignedUrl(
  body: File | Blob,
  url: string,
  contentType: string,
  options: {
    onProgress?: (update: ChatUploadProgressUpdate) => void;
  } = {},
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let lastLoaded = 0;
    let lastTime = performance.now();

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || !options.onProgress) {
        return;
      }

      const now = performance.now();
      const elapsedSeconds = (now - lastTime) / 1000;
      const loadedDelta = event.loaded - lastLoaded;
      const bytesPerSecond =
        elapsedSeconds > 0 ? loadedDelta / elapsedSeconds : 0;

      lastLoaded = event.loaded;
      lastTime = now;

      options.onProgress({
        percent: Math.min(100, (event.loaded / event.total) * 100),
        loaded: event.loaded,
        total: event.total,
        bytesPerSecond,
        phase: "uploading",
      });
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ success: true });
        return;
      }

      resolve({
        success: false,
        error:
          xhr.responseText?.trim() ||
          `Upload failed with status ${xhr.status}.`,
      });
    });

    xhr.addEventListener("error", () => {
      resolve({ success: false, error: "Network error during upload." });
    });

    xhr.addEventListener("abort", () => {
      resolve({ success: false, error: "Upload cancelled." });
    });

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(body);
  });
}

async function uploadStorageObject(
  body: File | Blob,
  path: string,
  options: UploadChatAttachmentOptions = {},
): Promise<{ success: boolean; error?: string }> {
  const config = getBrowserSupabaseConfig();

  if (!config) {
    return { success: false, error: "Supabase is not configured." };
  }

  // Access token from server (HttpOnly session) — never from document.cookie.
  const tokenPayload = await fetchAccessToken();

  if (!tokenPayload?.accessToken) {
    return { success: false, error: "Not authenticated." };
  }

  const bucket = options.bucket ?? CHAT_ATTACHMENTS_BUCKET;
  const upsert = options.upsert ?? false;
  const url = buildStorageUploadUrl(bucket, path, config.url);

  return uploadViaXhr(body, url, tokenPayload.accessToken, config.anonKey, {
    upsert,
    onProgress: options.onProgress,
  });
}

export async function uploadChatAttachmentDirect(
  file: File,
  path: string,
  options: UploadChatAttachmentOptions = {},
): Promise<{ success: boolean; error?: string }> {
  return uploadStorageObject(file, path, options);
}

export async function uploadChatAttachmentBlob(
  blob: Blob,
  path: string,
  options: Omit<UploadChatAttachmentOptions, "onProgress"> = {},
): Promise<{ success: boolean; error?: string }> {
  return uploadStorageObject(blob, path, {
    ...options,
    upsert: options.upsert ?? true,
  });
}
