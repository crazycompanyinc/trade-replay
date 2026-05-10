import { Router } from 'express';
import { BacktestSessionService } from '../services/backtest.service';
import { MarketDataService } from '../services/market-data.service';
import { authenticate, type AuthRequest } from '../middleware/auth';
import { createSessionSchema, updateSessionSchema, createTradeSchema, updateTradeSchema } from '../models/backtest.schemas';

const router = Router();
router.use(authenticate);

// Sessions CRUD
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const sessions = await BacktestSessionService.getAll(req.user!.id);
    res.json({ success: true, data: sessions });
  } catch (err) { next(err); }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const data = createSessionSchema.parse(req.body);
    const session = await BacktestSessionService.create(req.user!.id, data);
    res.status(201).json({ success: true, data: session });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const session = await BacktestSessionService.getById(req.params.id, req.user!.id);
    res.json({ success: true, data: session });
  } catch (err) { next(err); }
});

router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    const data = updateSessionSchema.parse(req.body);
    const session = await BacktestSessionService.update(req.params.id, req.user!.id, data);
    res.json({ success: true, data: session });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    await BacktestSessionService.delete(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) { next(err); }
});

// Candles
router.get('/:id/candles', async (req: AuthRequest, res, next) => {
  try {
    const candles = await BacktestSessionService.getCandles(req.params.id, req.user!.id);
    res.json({ success: true, data: candles });
  } catch (err) { next(err); }
});

// Load market data into session
router.post('/:id/load-data', async (req: AuthRequest, res, next) => {
  try {
    const session = await BacktestSessionService.getById(req.params.id, req.user!.id);
    const { symbol, timeframe, count } = req.body;
    const result = await MarketDataService.loadCandlesIntoSession(
      req.params.id,
      symbol || session.symbol,
      timeframe || session.timeframe,
      count || 500
    );
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Trades
router.get('/:id/trades', async (req: AuthRequest, res, next) => {
  try {
    const trades = await BacktestSessionService.getTrades(req.params.id, req.user!.id);
    res.json({ success: true, data: trades });
  } catch (err) { next(err); }
});

router.post('/:id/trades', async (req: AuthRequest, res, next) => {
  try {
    const data = createTradeSchema.parse(req.body);
    const trade = await BacktestSessionService.createTrade(req.params.id, req.user!.id, data);
    res.status(201).json({ success: true, data: trade });
  } catch (err) { next(err); }
});

router.put('/:id/trades/:tradeId', async (req: AuthRequest, res, next) => {
  try {
    const data = updateTradeSchema.parse(req.body);
    const trade = await BacktestSessionService.updateTrade(req.params.id, req.params.tradeId, req.user!.id, data);
    res.json({ success: true, data: trade });
  } catch (err) { next(err); }
});

router.delete('/:id/trades/:tradeId', async (req: AuthRequest, res, next) => {
  try {
    await BacktestSessionService.deleteTrade(req.params.id, req.params.tradeId, req.user!.id);
    res.json({ success: true, message: 'Trade deleted' });
  } catch (err) { next(err); }
});

// Run backtest
router.post('/:id/run', async (req: AuthRequest, res, next) => {
  try {
    const results = await BacktestSessionService.runBacktest(req.params.id, req.user!.id);
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
});

// Results
router.get('/:id/results', async (req: AuthRequest, res, next) => {
  try {
    const results = await BacktestSessionService.getResults(req.params.id, req.user!.id);
    res.json({ success: true, data: results });
  } catch (err) { next(err); }
});

export default router;
