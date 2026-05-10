import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Generate realistic OHLCV candle data
function generateCandles(symbol: string, count: number, basePrice: number, volatility: number) {
  const candles = [];
  let price = basePrice;
  const now = Math.floor(Date.now() / 1000);
  const interval = 3600; // 1 hour candles

  for (let i = 0; i < count; i++) {
    const time = now - (count - i) * interval;
    const change = (Math.random() - 0.48) * volatility; // slight upward bias
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.floor(Math.random() * 10000) + 1000;

    candles.push({ time, open, high, low, close, volume });
    price = close;
  }
  return candles;
}

async function main() {
  console.log('Seeding database...');

  // Clean
  await prisma.trade.deleteMany();
  await prisma.candle.deleteMany();
  await prisma.backtestSession.deleteMany();
  await prisma.strategy.deleteMany();
  await prisma.user.deleteMany();

  // Create demo users
  const password = await bcrypt.hash('demo123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@tradereplay.com',
      username: 'admin',
      password,
      role: 'admin',
    },
  });

  const trader = await prisma.user.create({
    data: {
      email: 'trader@tradereplay.com',
      username: 'trader',
      password,
      role: 'user',
    },
  });

  const demo = await prisma.user.create({
    data: {
      email: 'demo@tradereplay.com',
      username: 'demo',
      password,
      role: 'user',
    },
  });

  console.log(`Created 3 users: admin, trader, demo (password: demo123)`);

  // Create default strategies
  const strategies = await Promise.all([
    prisma.strategy.create({
      data: {
        name: 'Moving Average Crossover',
        description: 'Buy when fast MA crosses above slow MA, sell on cross below',
        config: {
          indicators: [
            { type: 'SMA', period: 20, color: '#2196F3' },
            { type: 'SMA', period: 50, color: '#FF9800' },
          ],
          entryRules: [{ type: 'ma_cross_above', fast: 20, slow: 50 }],
          exitRules: [{ type: 'ma_cross_below', fast: 20, slow: 50 }],
          riskManagement: { stopLossPct: 2, takeProfitPct: 4, positionSize: 0.1 },
        },
        isPublic: true,
        userId: admin.id,
      },
    }),
    prisma.strategy.create({
      data: {
        name: 'RSI Reversal',
        description: 'Buy when RSI oversold (<30), sell when overbought (>70)',
        config: {
          indicators: [{ type: 'RSI', period: 14, overbought: 70, oversold: 30 }],
          entryRules: [{ type: 'rsi_oversold', threshold: 30 }],
          exitRules: [{ type: 'rsi_overbought', threshold: 70 }],
          riskManagement: { stopLossPct: 1.5, takeProfitPct: 3, positionSize: 0.05 },
        },
        isPublic: true,
        userId: admin.id,
      },
    }),
    prisma.strategy.create({
      data: {
        name: 'Breakout Strategy',
        description: 'Trade breakouts from support/resistance levels',
        config: {
          indicators: [{ type: 'VWAP' }, { type: 'BollingerBands', period: 20, stdDev: 2 }],
          entryRules: [{ type: 'breakout_above', lookback: 20 }],
          exitRules: [{ type: 'breakout_below', lookback: 20 }],
          riskManagement: { stopLossPct: 1, takeProfitPct: 2, positionSize: 0.1 },
        },
        isPublic: true,
        userId: trader.id,
      },
    }),
  ]);

  console.log(`Created ${strategies.length} strategies`);

  // Create a demo backtest session with data
  const symbols = [
    { symbol: 'EURUSD', basePrice: 1.0850, volatility: 0.0020, count: 2000 },
    { symbol: 'BTCUSD', basePrice: 42000, volatility: 800, count: 2000 },
    { symbol: 'AAPL', basePrice: 178, volatility: 3, count: 2000 },
    { symbol: 'GOLD', basePrice: 2020, volatility: 20, count: 2000 },
  ];

  for (const sym of symbols) {
    const session = await prisma.backtestSession.create({
      data: {
        name: `${sym.symbol} Demo Session`,
        symbol: sym.symbol,
        timeframe: '1H',
        startBalance: 10000,
        status: 'completed',
        config: {
          spread: 0.0002,
          commission: 0.001,
          slippage: 0.0001,
          initialBalance: 10000,
        },
        userId: trader.id,
        strategyId: strategies[0].id,
      },
    });

    // Generate candles
    const candles = generateCandles(sym.symbol, sym.count, sym.basePrice, sym.volatility);
    await prisma.candle.createMany({
      data: candles.map((c) => ({ ...c, sessionId: session.id })),
    });

    // Generate sample trades
    let balance = 10000;
    const tradeCount = 20 + Math.floor(Math.random() * 30);
    for (let i = 0; i < tradeCount; i++) {
      const candle = candles[Math.floor(Math.random() * candles.length)];
      const type = Math.random() > 0.5 ? 'long' : 'short';
      const entryPrice = (candle.open + candle.close) / 2;
      const pnlPct = (Math.random() - 0.4) * 4; // -1.6% to +2.4%
      const pnl = balance * (pnlPct / 100) * 0.1;
      balance += pnl;

      const entryTime = new Date(candle.time * 1000);
      const exitTime = new Date(entryTime.getTime() + 3600000 * (1 + Math.random() * 12));

      await prisma.trade.create({
        data: {
          sessionId: session.id,
          type,
          entryPrice,
          exitPrice: entryPrice * (1 + pnlPct / 100),
          entryTime,
          exitTime,
          quantity: 1,
          stopLoss: type === 'long' ? entryPrice * 0.98 : entryPrice * 1.02,
          takeProfit: type === 'long' ? entryPrice * 1.04 : entryPrice * 0.96,
          pnl,
          pnlPct,
          status: 'closed',
        },
      });
    }

    // Update session results
    const winningTrades = await prisma.trade.count({
      where: { sessionId: session.id, pnl: { gt: 0 } },
    });
    const losingTrades = await prisma.trade.count({
      where: { sessionId: session.id, pnl: { lt: 0 } },
    });
    const totalTrades = winningTrades + losingTrades;

    await prisma.backtestSession.update({
      where: { id: session.id },
      data: {
        endBalance: balance,
        totalPnl: balance - 10000,
        totalPnlPct: ((balance - 10000) / 10000) * 100,
        totalTrades,
        winningTrades,
        losingTrades,
        winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
        maxDrawdown: 5.2 + Math.random() * 10,
        sharpeRatio: 0.5 + Math.random() * 1.5,
      },
    });

    console.log(`  ${sym.symbol}: ${candles.length} candles, ${totalTrades} trades`);
  }

  console.log('Seed complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
