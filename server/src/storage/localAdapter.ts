import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { StorageAdapter } from './storageAdapter';

function ensureUploadDir(): void {
  if (!fs.existsSync(config.UPLOAD_DIR)) {
    fs.mkdirSync(config.UPLOAD_DIR, { recursive: true });
  }
}

export const localAdapter: StorageAdapter = {
  async save(file: Express.Multer.File): Promise<string> {
    ensureUploadDir();
    const ext = path.extname(file.originalname) || mimeToExt(file.mimetype);
    const filename = `${uuidv4()}${ext}`;
    const dest = path.join(config.UPLOAD_DIR, filename);
    await fs.promises.writeFile(dest, file.buffer);
    return filename;
  },

  get(filename: string): fs.ReadStream {
    const filePath = path.join(config.UPLOAD_DIR, filename);
    return fs.createReadStream(filePath);
  },
};

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  return map[mime] ?? '';
}
