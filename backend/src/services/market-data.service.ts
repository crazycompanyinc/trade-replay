import { prisma } from '../config/prisma';

interface SymbolInfo {
  symbol: string;
  name: string;
  basePrice: number;
  volatility: number;
  minPrice: number;
  maxPrice: number;
  category: string;
}

const SYMBOLS: SymbolInfo[] = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar', basePrice: 1.0850, volatility: 0.0020, minPrice: 0.95, maxPrice: 1.25, category: 'Forex' },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', basePrice: 1.2650, volatility: 0.0025, minPrice: 1.10, maxPrice: 1.45, category: 'Forex' },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', basePrice: 150.50, volatility: 0.5, minPrice: 120, maxPrice: 160, category: 'Forex' },
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', basePrice: 42000, volatility: 800, minPrice: 20000, maxPrice: 80000, category: 'Crypto' },
  { symbol: 'ETHUSD', name: 'Ethereum / US Dollar', basePrice: 2250, volatility: 80, minPrice: 1000, maxPrice: 5000, category: 'Crypto' },
  { symbol: 'AAPL', name: 'Apple Inc.', basePrice: 178, volatility: 3, minPrice: 120, maxPrice: 220, category: 'Stocks' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', basePrice: 140, volatility: 2.5, minPrice: 100, maxPrice: 180, category: 'Stocks' },
  { symbol: 'TSLA', name: 'Tesla Inc.', basePrice: 245, volatility: 8, minPrice: 150, maxPrice: 350, category: 'Stocks' },
  { symbol: 'GOLD', name: 'Gold Futures', basePrice: 2020, volatility: 20, minPrice: 1700, maxPrice: 2500, category: 'Commodities' },
  { symbol: 'SILVER', name: 'Silver Futures', basePrice: 24.5, volatility: 0.5, minPrice: 18, maxPrice: 32, category: 'Commodities' },
];

const TIMEFRAMES: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

function generateCandlesForSymbol(symbol: string, count: number, intervalSeconds: number) {
  const info = SYMBOLS.find((s) => s.symbol === symbol);
  if (!info) return [];

  const candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> = [];
  let price = info.basePrice;
  const now = Math.floor(Date.now() / 1000);
  const startTime = now - count * intervalSeconds;

  for (let i = 0; i < count; i++) {
    const time = startTime + i * intervalSeconds;
    const trend = Math.sin(i / 200) * info.volatility * 0.3;
    const noise = (Math.random() - 0.48) * info.volatility;
    const open = price;
    const close = price + trend + noise;
    const high = Math.max(open, close) + Math.random() * info.volatility * 0.4;
    const low = Math.min(open, close) - Math.random() * info.volatility * 0.4;
    const volume = Math.floor(Math.random() * 10000) + 500;

    candles.push({
      time,
      open: Number(open.toFixed(5)),
      high: Number(high.toFixed(5)),
      low: Number(low.toFixed(5)),
      close: Number(close.toFixed(5)),
      volume,
    });
    price = close;
  }
  return candles;
}

export const MarketDataService = {
  getSymbols() {
    return SYMBOLS;
  },

  getSymbolInfo(symbol: string) {
    const info = SYMBOLS.find((s) => s.symbol === symbol);
    if (!info) return null;
    return info;
  },

  getTimeframes() {
    return Object.keys(TIMEFRAMES);
  },

  async getCandles(symbol: string, timeframe: string = '1h', count: number = 500) {
    const interval = TIMEFRAMES[timeframe] || 3600;
    return generateCandlesForSymbol(symbol, count, interval);
  },

  async loadCandlesIntoSession(sessionId: string, symbol: string, timeframe: string = '1h', count: number = 500) {
    const interval = TIMEFRAMES[timeframe] || 3600;
    const candles = generateCandlesForSymbol(symbol, count, interval);

    if (candles.length === 0) {
      return { loaded: 0 };
    }

    // Delete existing candles for this session
    await prisma.candle.deleteMany({ where: { sessionId } });

    // Insert new candles
    await prisma.candle.createMany({
      data: candles.map((c) => ({ ...c, sessionId })),
    });

    return { loaded: candles.length };
  },
};
