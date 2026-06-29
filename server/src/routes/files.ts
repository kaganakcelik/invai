import { Router, Request, Response } from 'express';
import path from 'path';
import { localAdapter as adapter } from '../storage/localAdapter';

const EXT_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const router = Router();

router.get('/:filename', (req: Request, res: Response): void => {
  const filename = req.params.filename;

  if (filename.includes('..') || filename.includes('/')) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream';

  try {
    const stream = adapter.get(filename);
    stream.on('error', () => res.status(404).json({ error: 'File not found' }));
    res.setHeader('Content-Type', contentType);
    stream.pipe(res);
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});

export default router;
