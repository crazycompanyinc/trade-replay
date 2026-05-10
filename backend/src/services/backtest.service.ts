import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import type { CreateSessionInput, UpdateSessionInput, CreateTradeInput, UpdateTradeInput } from '../models/backtest.schemas';

export const BacktestSessionService = {
  async getAll(userId: string) {
    return prisma.backtestSession.findMany({
      where: { userId },
      include: { strategy: { select: { id: true, name: true } }, _count: { select: { trades: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async getById(sessionId: string, userId: string) {
    const session = await prisma.backtestSession.findFirst({
      where: { id: sessionId, userId },
      include: { strategy: true, _count: { select: { trades: true, candles: true } } },
    });
    if (!session) throw new AppError(404, 'Session not found');
    return session;
  },

  async create(userId: string, data: CreateSessionInput) {
    return prisma.backtestSession.create({
      data: {
        name: data.name,
        symbol: data.symbol,
        timeframe: data.timeframe,
        startBalance: data.startBalance,
        strategyId: data.strategyId,
        config: data.config as unknown as Prisma.InputJsonValue,
        userId,
        status: 'draft',
      },
    });
  },

  async update(sessionId: string, userId: string, data: UpdateSessionInput) {
    await this.getById(sessionId, userId);
    return prisma.backtestSession.update({
      where: { id: sessionId },
      data,
    });
  },

  async delete(sessionId: string, userId: string) {
    await this.getById(sessionId, userId);
    await prisma.backtestSession.delete({ where: { id: sessionId } });
    return { success: true };
  },

  async getCandles(sessionId: string, userId: string) {
    await this.getById(sessionId, userId);
    return prisma.candle.findMany({
      where: { sessionId },
      orderBy: { time: 'asc' },
    });
  },

  async getTrades(sessionId: string, userId: string) {
    await this.getById(sessionId, userId);
    return prisma.trade.findMany({
      where: { sessionId },
      orderBy: { entryTime: 'asc' },
    });
  },

  async createTrade(sessionId: string, userId: string, data: CreateTradeInput) {
    await this.getById(sessionId, userId);
    return prisma.trade.create({
      data: {
        ...data,
        sessionId,
        entryTime: new Date(data.entryTime),
        exitTime: data.exitTime ? new Date(data.exitTime) : undefined,
      },
    });
  },

  async updateTrade(sessionId: string, tradeId: string, userId: string, data: UpdateTradeInput) {
    await this.getById(sessionId, userId);
    const trade = await prisma.trade.findFirst({ where: { id: tradeId, sessionId } });
    if (!trade) throw new AppError(404, 'Trade not found');

    return prisma.trade.update({
      where: { id: tradeId },
      data: {
        ...data,
        entryTime: data.entryTime ? new Date(data.entryTime) : undefined,
        exitTime: data.exitTime ? new Date(data.exitTime) : undefined,
      },
    });
  },

  async deleteTrade(sessionId: string, tradeId: string, userId: string) {
    await this.getById(sessionId, userId);
    const trade = await prisma.trade.findFirst({ where: { id: tradeId, sessionId } });
    if (!trade) throw new AppError(404, 'Trade not found');
    await prisma.trade.delete({ where: { id: tradeId } });
    return { success: true };
  },

  async runBacktest(sessionId: string, userId: string) {
    const session = await this.getById(sessionId, userId);
    const candles = await prisma.candle.findMany({
      where: { sessionId },
      orderBy: { time: 'asc' },
    });

    if (candles.length < 50) {
      throw new AppError(400, 'Need at least 50 candles to run backtest. Add market data first.');
    }

    // Clear existing trades
    await prisma.trade.deleteMany({ where: { sessionId } });

    // Simple MA crossover backtest engine
    const config = (session.config as Record<string, number>) || {};
    const spread = config.spread || 0.0002;
    const commission = config.commission || 0.001;

    let balance = session.startBalance;
    let position: { type: string; entryPrice: number; quantity: number; stopLoss: number | null; takeProfit: number | null } | null = null;
    const trades: Array<{ type: string; entryPrice: number; exitPrice: number; entryTime: Date; exitTime: Date; pnl: number; pnlPct: number; quantity: number }> = [];

    const fastPeriod = 10;
    const slowPeriod = 30;

    for (let i = slowPeriod; i < candles.length; i++) {
      const fastMA = candles.slice(i - fastPeriod, i).reduce((s, c) => s + c.close, 0) / fastPeriod;
      const slowMA = candles.slice(i - slowPeriod, i).reduce((s, c) => s + c.close, 0) / slowPeriod;
      const prevFastMA = candles.slice(i - fastPeriod - 1, i - 1).reduce((s, c) => s + c.close, 0) / fastPeriod;
      const prevSlowMA = candles.slice(i - slowPeriod - 1, i - 1).reduce((s, c) => s + c.close, 0) / slowPeriod;

      const candle = candles[i];

      // Check SL/TP on open position
      if (position) {
        let exitPrice: number | null = null;
        if (position.type === 'long') {
          if (position.stopLoss && candle.low <= position.stopLoss) exitPrice = position.stopLoss;
          else if (position.takeProfit && candle.high >= position.takeProfit) exitPrice = position.takeProfit;
        } else {
          if (position.stopLoss && candle.high >= position.stopLoss) exitPrice = position.stopLoss;
          else if (position.takeProfit && candle.low <= position.takeProfit) exitPrice = position.takeProfit;
        }

        if (exitPrice) {
          const pnl = position.type === 'long'
            ? (exitPrice - position.entryPrice) * position.quantity
            : (position.entryPrice - exitPrice) * position.quantity;
          const cost = (position.entryPrice + exitPrice) * position.quantity * commission;
          const netPnl = pnl - cost;
          balance += netPnl;
          trades.push({
            type: position.type,
            entryPrice: position.entryPrice,
            exitPrice,
            entryTime: new Date(candles[i - 1].time * 1000),
            exitTime: new Date(candle.time * 1000),
            pnl: netPnl,
            pnlPct: (netPnl / balance) * 100,
            quantity: position.quantity,
          });
          position = null;
        }
      }

      // Entry signals
      if (!position) {
        if (prevFastMA <= prevSlowMA && fastMA > slowMA) {
          // Long entry
          const entryPrice = candle.open + spread;
          const riskAmount = balance * 0.02;
          const quantity = Math.max(0.01, riskAmount / (entryPrice * 0.02));
          position = {
            type: 'long',
            entryPrice,
            quantity,
            stopLoss: entryPrice * 0.98,
            takeProfit: entryPrice * 1.04,
          };
        } else if (prevFastMA >= prevSlowMA && fastMA < slowMA) {
          // Short entry
          const entryPrice = candle.open - spread;
          const riskAmount = balance * 0.02;
          const quantity = Math.max(0.01, riskAmount / (entryPrice * 0.02));
          position = {
            type: 'short',
            entryPrice,
            quantity,
            stopLoss: entryPrice * 1.02,
            takeProfit: entryPrice * 0.96,
          };
        }
      }
    }

    // Save trades
    if (trades.length > 0) {
      await prisma.trade.createMany({
        data: trades.map((t) => ({
          sessionId,
          type: t.type,
          entryPrice: t.entryPrice,
          exitPrice: t.exitPrice,
          entryTime: t.entryTime,
          exitTime: t.exitTime,
          quantity: t.quantity,
          pnl: t.pnl,
          pnlPct: t.pnlPct,
          status: 'closed' as const,
        })),
      });
    }

    // Calculate results
    const winningTrades = trades.filter((t) => t.pnl > 0).length;
    const losingTrades = trades.filter((t) => t.pnl < 0).length;
    const totalTrades = trades.length;
    const totalPnl = balance - session.startBalance;

    // Max drawdown
    let peak = session.startBalance;
    let maxDD = 0;
    let runningBalance = session.startBalance;
    for (const t of trades) {
      runningBalance += t.pnl;
      if (runningBalance > peak) peak = runningBalance;
      const dd = ((peak - runningBalance) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }

    // Sharpe ratio (simplified)
    const returns = trades.map((t) => t.pnlPct);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdDev = returns.length > 1
      ? Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
      : 0;
    const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

    await prisma.backtestSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        endBalance: balance,
        totalPnl,
        totalPnlPct: (totalPnl / session.startBalance) * 100,
        totalTrades,
        winningTrades,
        losingTrades,
        winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
        maxDrawdown: maxDD,
        sharpeRatio: sharpe,
      },
    });

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnl,
      totalPnlPct: (totalPnl / session.startBalance) * 100,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      maxDrawdown: maxDD,
      sharpeRatio: sharpe,
      finalBalance: balance,
    };
  },

  async getResults(sessionId: string, userId: string) {
    const session = await this.getById(sessionId, userId);
    const trades = await prisma.trade.findMany({
      where: { sessionId },
      orderBy: { entryTime: 'asc' },
    });

    return {
      session,
      trades,
      summary: {
        totalTrades: session.totalTrades,
        winningTrades: session.winningTrades,
        losingTrades: session.losingTrades,
        winRate: session.winRate,
        totalPnl: session.totalPnl,
        totalPnlPct: session.totalPnlPct,
        maxDrawdown: session.maxDrawdown,
        sharpeRatio: session.sharpeRatio,
        startBalance: session.startBalance,
        endBalance: session.endBalance,
      },
    };
  },
};
