"use client";

import { upload } from "@vercel/blob/client";
import type { SharedFile } from "@/lib/docs";
import { MAX_FILE_BYTES } from "@/lib/files";
import { api } from "@/lib/utils";

/** Uploads straight from the browser to Vercel Blob, then records the file on the page. */
export async function uploadToPage(docId: string, file: File, onProgress?: (percent: number) => void): Promise<SharedFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`“${file.name}” is over 10 MB.`);
  const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(-120) || "file";
  const blob = await upload(`docs/${docId}/${safeName}`, file, {
    access: "public",
    handleUploadUrl: `/api/docs/${docId}/files/upload`,
    onUploadProgress: (e) => onProgress?.(Math.round(e.percentage)),
  });
  const { file: saved } = await api<{ file: SharedFile }>(`/api/docs/${docId}/files`, {
    method: "POST",
    json: {
      url: blob.url,
      pathname: blob.pathname,
      name: file.name,
      size: file.size,
      contentType: file.type || blob.contentType || "application/octet-stream",
    },
  });
  return saved;
}
