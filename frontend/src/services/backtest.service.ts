import api from './api';
import type { ApiResponse } from '../types';
import type { BacktestSession, Trade, BacktestResults, Candle } from '../types';

export const backtestApi = {
  getAll: () =>
    api.get<ApiResponse<BacktestSession[]>>('/sessions'),

  getById: (id: string) =>
    api.get<ApiResponse<BacktestSession>>(`/sessions/${id}`),

  create: (data: Partial<BacktestSession>) =>
    api.post<ApiResponse<BacktestSession>>('/sessions', data),

  update: (id: string, data: Partial<BacktestSession>) =>
    api.put<ApiResponse<BacktestSession>>(`/sessions/${id}`, data),

  delete: (id: string) =>
    api.delete(`/sessions/${id}`),

  getCandles: (id: string) =>
    api.get<ApiResponse<Candle[]>>(`/sessions/${id}/candles`),

  loadData: (id: string, symbol: string, timeframe: string, count: number) =>
    api.post<ApiResponse<{ loaded: number }>>(`/sessions/${id}/load-data`, { symbol, timeframe, count }),

  getTrades: (id: string) =>
    api.get<ApiResponse<Trade[]>>(`/sessions/${id}/trades`),

  createTrade: (sessionId: string, data: Partial<Trade>) =>
    api.post<ApiResponse<Trade>>(`/sessions/${sessionId}/trades`, data),

  updateTrade: (sessionId: string, tradeId: string, data: Partial<Trade>) =>
    api.put<ApiResponse<Trade>>(`/sessions/${sessionId}/trades/${tradeId}`, data),

  deleteTrade: (sessionId: string, tradeId: string) =>
    api.delete(`/sessions/${sessionId}/trades/${tradeId}`),

  runBacktest: (id: string) =>
    api.post<ApiResponse<BacktestResults['summary']>>(`/sessions/${id}/run`),

  getResults: (id: string) =>
    api.get<ApiResponse<BacktestResults>>(`/sessions/${id}/results`),
};
