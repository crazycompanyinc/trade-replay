import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { registerSchema, loginSchema } from '../models/auth.schemas';

const router = Router();

router.post('/register', async (req: AuthRequest, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await AuthService.register(data);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req: AuthRequest, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await AuthService.login(data);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/profile', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await AuthService.getProfile(req.user!.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

export default router;
