import fs from "fs/promises";
import path from "path";

const STORAGE_ROOT = process.env.STORAGE_PATH || "/data/notal-storage";

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export function getStoragePath(...segments: string[]): string {
  return path.join(STORAGE_ROOT, ...segments);
}

export async function saveFile(
  subDir: string,
  fileName: string,
  data: Buffer | string
): Promise<string> {
  const dir = getStoragePath(subDir);
  await ensureDir(dir);
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, data);
  return path.join(subDir, fileName);
}

export async function readFile(relativePath: string): Promise<Buffer> {
  const fullPath = getStoragePath(relativePath);
  return fs.readFile(fullPath);
}

export async function deleteFile(relativePath: string): Promise<void> {
  const fullPath = getStoragePath(relativePath);
  try {
    await fs.unlink(fullPath);
  } catch {
    // file may not exist
  }
}

export async function fileExists(relativePath: string): Promise<boolean> {
  const fullPath = getStoragePath(relativePath);
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}
