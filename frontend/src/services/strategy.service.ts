import api from './api';
import type { ApiResponse } from '../types';
import type { Strategy } from '../types';

export const strategyApi = {
  getAll: () =>
    api.get<ApiResponse<Strategy[]>>('/strategies'),

  getPublic: () =>
    api.get<ApiResponse<Strategy[]>>('/strategies/public'),

  getById: (id: string) =>
    api.get<ApiResponse<Strategy>>(`/strategies/${id}`),

  create: (data: Partial<Strategy>) =>
    api.post<ApiResponse<Strategy>>('/strategies', data),

  update: (id: string, data: Partial<Strategy>) =>
    api.put<ApiResponse<Strategy>>(`/strategies/${id}`, data),

  delete: (id: string) =>
    api.delete(`/strategies/${id}`),
};
