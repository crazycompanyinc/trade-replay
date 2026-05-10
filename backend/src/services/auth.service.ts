import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { generateToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';
import type { RegisterInput, LoginInput } from '../models/auth.schemas';

export const AuthService = {
  async register(data: RegisterInput) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { username: data.username }] },
    });
    if (existing) {
      throw new AppError(409, 'Email or username already exists');
    }

    const password = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: { email: data.email, username: data.username, password },
      select: { id: true, email: true, username: true, role: true, createdAt: true },
    });

    const token = generateToken({ id: user.id, email: user.email, username: user.username, role: user.role });
    return { user, token };
  },

  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) throw new AppError(401, 'Invalid email or password');

    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) throw new AppError(401, 'Invalid email or password');

    const token = generateToken({ id: user.id, email: user.email, username: user.username, role: user.role });
    const { password: _, ...safeUser } = user;
    return { user: safeUser, token };
  },

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, role: true, avatar: true, createdAt: true },
    });
    if (!user) throw new AppError(404, 'User not found');
    return user;
  },
};
