import { put } from '@vercel/blob';

export async function persistRemoteAsset(
  sourceUrl: string,
  filename: string
): Promise<{ url: string; persisted: boolean }> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { url: sourceUrl, persisted: false };
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download asset: ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const buffer = Buffer.from(await response.arrayBuffer());

  const blob = await put(filename, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: true,
  });

  return { url: blob.url, persisted: true };
}