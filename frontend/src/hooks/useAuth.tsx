import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { authApi } from '../services/auth.service';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await authApi.login(email, password);
      if (data.success) {
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        setToken(data.data.token);
        setUser(data.data.user);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, username: string, password: string) => {
    setLoading(true);
    try {
      const { data } = await authApi.register(email, username, password);
      if (data.success) {
        localStorage.setItem('token', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        setToken(data.data.token);
        setUser(data.data.user);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await authApi.getProfile();
      if (data.success) {
        localStorage.setItem('user', JSON.stringify(data.data));
        setUser(data.data);
      }
    } catch {
      logout();
    }
  }, [token, logout]);

  useEffect(() => {
    if (token && !user) refreshUser();
  }, [token, user, refreshUser]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
