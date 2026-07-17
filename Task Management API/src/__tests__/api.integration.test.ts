// Mock Redis BEFORE importing the app — jest.mock is hoisted
import { afterAll, describe, expect, it, jest } from '@jest/globals';

jest.mock('../config/redis', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      }),
      del: jest.fn(async (key: string) => {
        store.delete(key);
        return 1;
      }),
    },
  };
});

import request from 'supertest';
import { createApp } from '../app';
import prisma from '../config/prisma';
import redis from '../config/redis';

const app = createApp();
const testEmail = `test-${Date.now()}@example.com`;
const password = 'password123';
let token: string;
let taskId: string;

afterAll(async () => {
  // Clean up test data, then close the DB connection
  await prisma.task.deleteMany({ where: { owner: { email: testEmail } } });
  await prisma.user.deleteMany({ where: { email: testEmail } });
  await prisma.$disconnect();
});

describe('Auth endpoints', () => {
  it('registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, password, name: 'Test' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe(testEmail);
    expect(res.body).not.toHaveProperty('password'); // never leak hashes
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, password });

    expect(res.status).toBe(409);
  });

  it('rejects invalid input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: '123' });

    expect(res.status).toBe(400);
  });

  it('logs in and returns a JWT', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'wrong' });

    expect(res.status).toBe(401);
  });
});

describe('Task endpoints', () => {
  it('rejects unauthenticated access', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });

  it('creates a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Test task', description: 'from jest' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('TODO');
    taskId = res.body.id;
  });

  it('lists tasks (cache miss, then populates cache)', async () => {
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.some((t: any) => t.id === taskId)).toBe(true);
    expect(redis.set).toHaveBeenCalled(); // cache was written
  });

  it('serves the second list from cache', async () => {
    (redis.get as jest.Mock).mockClear();
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(redis.get).toHaveBeenCalled();
  });

  it('invalidates cache on update', async () => {
    const res = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'DONE' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DONE');
    expect(redis.del).toHaveBeenCalled();
  });

  it('deletes the task', async () => {
    const res = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });
});