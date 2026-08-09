import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { env } from '../config/env.js';

/**
 * Local-disk file storage. `STORAGE_PROVIDER` in env is a placeholder for a future S3/
 * Cloudinary driver (per the Phase 0 design) — this is the only implementation wired up so
 * far, since no cloud credentials exist yet. Swapping providers later only touches this file.
 */
const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');

export const UPLOADS_URL_PREFIX = '/uploads';
export const UPLOADS_DIR = UPLOADS_ROOT;

export async function saveUploadedFile(input: {
  buffer: Buffer;
  originalName: string;
  subdirectory: string;
}): Promise<{ url: string; relativePath: string }> {
  const ext = path.extname(input.originalName).toLowerCase();
  const filename = `${randomUUID()}${ext}`;
  const dir = path.join(UPLOADS_ROOT, input.subdirectory);
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, input.buffer);

  const relativePath = `${input.subdirectory}/${filename}`;
  return { url: `${env.API_URL}${UPLOADS_URL_PREFIX}/${relativePath}`, relativePath };
}

/** Same on-disk convention as `saveUploadedFile`, for server-generated files (PDFs) that never
 * came from a multer upload. */
export async function saveGeneratedFile(input: {
  buffer: Buffer;
  extension: string;
  subdirectory: string;
}): Promise<{ url: string; relativePath: string }> {
  const filename = `${randomUUID()}${input.extension}`;
  const dir = path.join(UPLOADS_ROOT, input.subdirectory);
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, input.buffer);

  const relativePath = `${input.subdirectory}/${filename}`;
  return { url: `${env.API_URL}${UPLOADS_URL_PREFIX}/${relativePath}`, relativePath };
}

export async function deleteUploadedFile(relativePath: string): Promise<void> {
  const filePath = path.join(UPLOADS_ROOT, relativePath);
  await fs.rm(filePath, { force: true });
}

/** Extracts the storage-relative path from a previously-issued upload URL, or null if the
 * URL doesn't point at our own upload storage (e.g. it's an external/CDN URL). */
export function relativePathFromUrl(url: string): string | null {
  const marker = UPLOADS_URL_PREFIX + '/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.slice(index + marker.length);
}
