import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

export type AuthUser = { userId: string; username: string };

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be set in production');
    }
    return 'dev-secret-change-in-prod';
  }
  return secret;
}

export function getUserFromToken(req: NextRequest): AuthUser | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const token = auth.replace('Bearer ', '');
    return jwt.verify(token, getJwtSecret()) as AuthUser;
  } catch {
    return null;
  }
}

export function requireAuth(req: NextRequest): AuthUser | { error: string; status: number } {
  const user = getUserFromToken(req);
  if (!user) return { error: 'Unauthorized', status: 401 };
  return user;
}