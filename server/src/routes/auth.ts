import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Auth is handled client-side by Supabase. This endpoint just returns the current user info.
router.get('/me', requireAuth, (req: AuthRequest, res: Response): void => {
  res.json({ id: req.user!.id, email: req.user!.email });
});

export default router;
