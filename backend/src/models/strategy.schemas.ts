import { z } from 'zod';

export const createStrategySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  config: z.object({
    indicators: z.array(z.object({
      type: z.string(),
      period: z.number().optional(),
      color: z.string().optional(),
      overbought: z.number().optional(),
      oversold: z.number().optional(),
      stdDev: z.number().optional(),
    })),
    entryRules: z.array(z.record(z.unknown())),
    exitRules: z.array(z.record(z.unknown())),
    riskManagement: z.object({
      stopLossPct: z.number().optional(),
      takeProfitPct: z.number().optional(),
      positionSize: z.number().optional(),
    }).optional(),
  }),
  isPublic: z.boolean().default(false),
});

export const updateStrategySchema = createStrategySchema.partial();

export type CreateStrategyInput = z.infer<typeof createStrategySchema>;
export type UpdateStrategyInput = z.infer<typeof updateStrategySchema>;
