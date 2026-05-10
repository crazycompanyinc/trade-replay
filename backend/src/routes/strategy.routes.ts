import { Router } from 'express';
import { StrategyService } from '../services/strategy.service';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { createStrategySchema, updateStrategySchema } from '../models/strategy.schemas';

const router = Router();

router.get('/public', async (req: AuthRequest, res, next) => {
  try {
    const strategies = await StrategyService.getPublic();
    res.json({ success: true, data: strategies });
  } catch (err) { next(err); }
});

router.use(authenticate);

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const strategies = await StrategyService.getAll(req.user!.id);
    res.json({ success: true, data: strategies });
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createStrategySchema.parse(req.body);
    const strategy = await StrategyService.create(req.user!.id, data);
    res.status(201).json({ success: true, data: strategy });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const strategy = await StrategyService.getById(req.params.id);
    res.json({ success: true, data: strategy });
  } catch (err) { next(err); }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = updateStrategySchema.parse(req.body);
    const strategy = await StrategyService.update(req.params.id, req.user!.id, data);
    res.json({ success: true, data: strategy });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await StrategyService.delete(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Strategy deleted' });
  } catch (err) { next(err); }
});

export default router;
