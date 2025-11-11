import jwt, { type Secret, type SignOptions, type JwtPayload } from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import type { JwtPayload as AppClaims } from './types.js';

/**
 * Returns the JWT secret from environment variables.
 * Throws an error if missing to prevent the app from running insecurely.
 */
const getJwtSecret = (): Secret => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return process.env.JWT_SECRET;
};

/**
 * Parses a configurable JWT expiration value.
 * Accepts both:
 * - Human-readable strings (e.g., "1h", "7d")
 * - Numeric seconds
 *
 * @param value - Environment variable or config string
 */
const parseExpires = (value?: string): SignOptions['expiresIn'] => {
  if (!value) return '7d';
  const n = Number(value);
  return (Number.isFinite(n) ? n : value) as SignOptions['expiresIn'];
};

/**
 * Creates and signs a JWT containing the application's user claims.
 *
 * @param payload - Structured identity claims stored in the token.
 * @param expiresIn - Optional expiration override; defaults to environment config.
 */
export function signToken(
  payload: AppClaims,
  expiresIn: SignOptions['expiresIn'] = parseExpires(process.env.JWT_EXPIRES_IN)
) {
  return jwt.sign(payload as object, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn,
  });
}

/**
 * Verifies a JWT and returns the decoded user claims.
 * Ensures payload is an object (jsonwebtoken may return a string, which is invalid).
 *
 * @param token - The encoded JWT string.
 */
export function verifyToken(token: string): AppClaims & Partial<JwtPayload> {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  return decoded as AppClaims & Partial<JwtPayload>;
}

/**
 * Express middleware to enforce authentication.
 *
 * Token Lookup Strategy:
 * 1. Authorization: Bearer <token> header (API clients)
 * 2. auth-token HTTP-only cookie (browser sessions)
 *
 * On success:
 * - Decoded claims are assigned to `req.user`.
 *
 * On failure:
 * - Responds with 401 Unauthorized.
 */
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
