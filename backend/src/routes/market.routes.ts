import { Router } from 'express';
import { MarketDataService } from '../services/market-data.service';

const router = Router();

router.get('/symbols', (req, res) => {
  const symbols = MarketDataService.getSymbols();
  res.json({ success: true, data: symbols });
});

router.get('/timeframes', (req, res) => {
  const timeframes = MarketDataService.getTimeframes();
  res.json({ success: true, data: timeframes });
});

router.get('/candles', async (req, res, next) => {
  try {
    const symbol = req.query.symbol as string;
    const timeframe = (req.query.timeframe as string) || '1h';
    const count = parseInt(req.query.count as string) || 500;

    if (!symbol) {
      res.status(400).json({ success: false, error: 'Symbol is required' });
      return;
    }

    const candles = await MarketDataService.getCandles(symbol, timeframe, count);
    res.json({ success: true, data: candles });
  } catch (err) {
    next(err);
  }
});

export default router;
