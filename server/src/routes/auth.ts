import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const router = Router();

router.post('/login', (req: Request, res: Response): void => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const emailMatch = crypto.timingSafeEqual(
    Buffer.from(email),
    Buffer.from(config.ADMIN_EMAIL)
  );
  const passwordMatch = crypto.timingSafeEqual(
    Buffer.from(password),
    Buffer.from(config.ADMIN_PASSWORD)
  );

  if (!emailMatch || !passwordMatch) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign({ email }, config.JWT_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

export default router;
