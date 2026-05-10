import api from './api';
import type { ApiResponse } from '../types';
import type { MarketSymbol, Candle } from '../types';

export const marketApi = {
  getSymbols: () =>
    api.get<ApiResponse<MarketSymbol[]>>('/market/symbols'),

  getTimeframes: () =>
    api.get<ApiResponse<string[]>>('/market/timeframes'),

  getCandles: (symbol: string, timeframe: string = '1h', count: number = 500) =>
    api.get<ApiResponse<Candle[]>>(`/market/candles?symbol=${symbol}&timeframe=${timeframe}&count=${count}`),
};
