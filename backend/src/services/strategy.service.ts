import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/errorHandler';
import type { CreateStrategyInput, UpdateStrategyInput } from '../models/strategy.schemas';

export const StrategyService = {
  async getAll(userId: string) {
    return prisma.strategy.findMany({
      where: { OR: [{ userId }, { isPublic: true }] },
      include: { user: { select: { username: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  },

  async getById(id: string) {
    const strategy = await prisma.strategy.findUnique({
      where: { id },
      include: { user: { select: { username: true } } },
    });
    if (!strategy) throw new AppError(404, 'Strategy not found');
    return strategy;
  },

  async create(userId: string, data: CreateStrategyInput) {
    return prisma.strategy.create({
      data: {
        name: data.name,
        description: data.description,
        config: data.config as unknown as Prisma.InputJsonValue,
        isPublic: data.isPublic,
        userId,
      },
    });
  },

  async update(id: string, userId: string, data: UpdateStrategyInput) {
    const strategy = await prisma.strategy.findFirst({ where: { id, userId } });
    if (!strategy) throw new AppError(404, 'Strategy not found or not owned by you');
    const updateData: Prisma.StrategyUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.config !== undefined) updateData.config = data.config as unknown as Prisma.InputJsonValue;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
    return prisma.strategy.update({ where: { id }, data: updateData });
  },

  async delete(id: string, userId: string) {
    const strategy = await prisma.strategy.findFirst({ where: { id, userId } });
    if (!strategy) throw new AppError(404, 'Strategy not found or not owned by you');
    await prisma.strategy.delete({ where: { id } });
    return { success: true };
  },

  async getPublic() {
    return prisma.strategy.findMany({
      where: { isPublic: true },
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },
};
