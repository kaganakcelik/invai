import fs from 'fs';

export interface StorageAdapter {
  save(file: Express.Multer.File): Promise<string>;
  get(filename: string): fs.ReadStream;
}
