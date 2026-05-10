import { z } from 'zod';

export const createSessionSchema = z.object({
  name: z.string().min(1, 'Session name is required').max(100),
  symbol: z.string().min(1, 'Symbol is required'),
  timeframe: z.string().default('1H'),
  startBalance: z.number().positive().default(10000),
  strategyId: z.string().optional(),
  config: z.object({
    spread: z.number().default(0.0002),
    commission: z.number().default(0.001),
    slippage: z.number().default(0.0001),
  }).optional(),
});

export const updateSessionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  status: z.enum(['draft', 'running', 'completed', 'aborted']).optional(),
  config: z.object({
    spread: z.number(),
    commission: z.number(),
    slippage: z.number(),
  }).optional(),
});

export const createTradeSchema = z.object({
  type: z.enum(['long', 'short']),
  entryPrice: z.number().positive(),
  exitPrice: z.number().positive().optional(),
  entryTime: z.string().datetime(),
  exitTime: z.string().datetime().optional(),
  quantity: z.number().positive().default(1),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const updateTradeSchema = createTradeSchema.partial();

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type CreateTradeInput = z.infer<typeof createTradeSchema>;
export type UpdateTradeInput = z.infer<typeof updateTradeSchema>;
