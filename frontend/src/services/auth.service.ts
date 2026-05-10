import api from './api';
import type { ApiResponse } from '../types';
import type { AuthResponse, User } from '../types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<AuthResponse>>('/auth/login', { email, password }),

  register: (email: string, username: string, password: string) =>
    api.post<ApiResponse<AuthResponse>>('/auth/register', { email, username, password }),

  getProfile: () =>
    api.get<ApiResponse<User>>('/auth/profile'),
};
