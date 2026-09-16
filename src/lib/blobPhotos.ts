import { del } from "@vercel/blob";

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

export function isPendingPhotoUrl(url: string | undefined): boolean {
  return Boolean(url && url.includes("/photos/pending/"));
}

export async function deleteBlobUrl(url: string | undefined): Promise<void> {
  if (!url || !blobToken()) return;
  try {
    await del(url, { token: blobToken() });
  } catch {
    /* Blob may already be gone */
  }
}
