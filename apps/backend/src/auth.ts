import jwt, { type Secret, type SignOptions, type JwtPayload } from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload as AppClaims } from './types.js';

const getJwtSecret = (): Secret => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return process.env.JWT_SECRET;
};

const parseExpires = (value?: string): SignOptions['expiresIn'] => {
  if (!value) return '7d';
  const n = Number(value);
  return (Number.isFinite(n) ? n : value) as SignOptions['expiresIn'];
};

export function signToken(
  payload: AppClaims,
  expiresIn: SignOptions['expiresIn'] = parseExpires(process.env.JWT_EXPIRES_IN)
) {
  return jwt.sign(payload as object, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn,
  });
}

export function verifyToken(token: string): AppClaims & Partial<JwtPayload> {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  return decoded as AppClaims & Partial<JwtPayload>;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : undefined;

  const cookies = req.cookies || {};
  const token = cookies["auth-token"] ?? bearer;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    (req as any).user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}
