import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, (_req: AuthRequest, res: Response): void => {
  const rows = db.prepare('SELECT * FROM locations ORDER BY name').all();
  res.json(rows);
});

router.post('/', requireAuth, (req: AuthRequest, res: Response): void => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const id = uuidv4();
  db.prepare('INSERT OR IGNORE INTO locations (id, name) VALUES (?, ?)').run(id, name.trim());
  const row = db.prepare('SELECT * FROM locations WHERE name = ?').get(name.trim());
  res.status(201).json(row);
});

export default router;
