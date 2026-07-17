/// <reference types="jest" />
import jwt from 'jsonwebtoken';
import { authenticate, authorize } from '../middleware/auth';
import { Request, Response, NextFunction } from 'express';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('authenticate middleware', () => {
  it('rejects requests with no Authorization header', () => {
    const req = { headers: {} } as Request;
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', () => {
    const req = { headers: { authorization: 'Bearer garbage' } } as Request;
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid token and attaches user to req', () => {
    const token = jwt.sign({ userId: 'u1', role: 'USER' }, 'test-secret');
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const res = mockRes();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ userId: 'u1', role: 'USER' });
  });
});

describe('authorize middleware', () => {
  it('blocks a USER from an ADMIN-only route', () => {
    const req = { user: { userId: 'u1', role: 'USER' } } as Request;
    const res = mockRes();
    const next = jest.fn();

    authorize('ADMIN')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows an ADMIN through', () => {
    const req = { user: { userId: 'a1', role: 'ADMIN' } } as Request;
    const res = mockRes();
    const next = jest.fn();

    authorize('ADMIN')(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});