import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import redis from '../config/redis';
import logger from '../config/logger';

const CACHE_TTL_SECONDS = 60;
const cacheKeyForUser = (userId: string) => `tasks:${userId}`;

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
});

export async function createTask(req: Request, res: Response) {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
  }

  const ownerId = req.user!.userId;

  const task = await prisma.task.create({
    data: { ...parsed.data, ownerId },
  });

  await redis.del(cacheKeyForUser(ownerId));

  return res.status(201).json(task);
}

export async function listTasks(req: Request, res: Response) {
  const ownerId = req.user!.userId;
  const cacheKey = cacheKeyForUser(ownerId);

  const cached = await redis.get(cacheKey);
  if (cached) {
    logger.debug(`Cache hit for ${cacheKey}`);
    return res.json(JSON.parse(cached));
  }

  logger.debug(`Cache miss for ${cacheKey}`);

  // Admins can see all tasks; regular users only see their own.
  const where = req.user!.role === 'ADMIN' ? {} : { ownerId };
  const tasks = await prisma.task.findMany({ where, orderBy: { createdAt: 'desc' } });

  await redis.set(cacheKey, JSON.stringify(tasks), 'EX', CACHE_TTL_SECONDS);

  return res.json(tasks);
}

export async function getTask(req: Request, res: Response) {
  const { id } = req.params;
  const task = await prisma.task.findUnique({ where: { id } });

  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  if (req.user!.role !== 'ADMIN' && task.ownerId !== req.user!.userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  return res.json(task);
}

export async function updateTask(req: Request, res: Response) {
  const { id } = req.params;
  const parsed = taskSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
  }

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: 'Task not found' });
  }

  if (req.user!.role !== 'ADMIN' && existing.ownerId !== req.user!.userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const task = await prisma.task.update({ where: { id }, data: parsed.data });

  await redis.del(cacheKeyForUser(existing.ownerId));

  return res.json(task);
}

export async function deleteTask(req: Request, res: Response) {
  const { id } = req.params;

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: 'Task not found' });
  }

  if (req.user!.role !== 'ADMIN' && existing.ownerId !== req.user!.userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  await prisma.task.delete({ where: { id } });
  await redis.del(cacheKeyForUser(existing.ownerId));

  return res.status(204).send();
}
