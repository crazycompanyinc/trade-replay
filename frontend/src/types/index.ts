export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  avatar?: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface BacktestSession {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  startBalance: number;
  endBalance: number | null;
  totalPnl: number | null;
  totalPnlPct: number | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number | null;
  maxDrawdown: number | null;
  sharpeRatio: number | null;
  status: 'draft' | 'running' | 'completed' | 'aborted';
  config: Record<string, unknown> | null;
  userId: string;
  strategyId: string | null;
  strategy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
  _count?: { trades: number };
}

export interface Trade {
  id: string;
  sessionId: string;
  type: 'long' | 'short';
  entryPrice: number;
  exitPrice: number | null;
  entryTime: string;
  exitTime: string | null;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
  pnl: number | null;
  pnlPct: number | null;
  status: 'open' | 'closed' | 'cancelled';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Strategy {
  id: string;
  name: string;
  description: string | null;
  config: {
    indicators: Array<{ type: string; period?: number; color?: string; overbought?: number; oversold?: number; stdDev?: number }>;
    entryRules: Array<Record<string, unknown>>;
    exitRules: Array<Record<string, unknown>>;
    riskManagement?: { stopLossPct?: number; takeProfitPct?: number; positionSize?: number };
  };
  isPublic: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketSymbol {
  symbol: string;
  name: string;
  basePrice: number;
  volatility: number;
  minPrice: number;
  maxPrice: number;
  category: string;
}

export interface BacktestResults {
  session: BacktestSession;
  trades: Trade[];
  summary: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number | null;
    totalPnl: number | null;
    totalPnlPct: number | null;
    maxDrawdown: number | null;
    sharpeRatio: number | null;
    startBalance: number;
    endBalance: number | null;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  details?: Array<{ path: string; message: string }>;
}
