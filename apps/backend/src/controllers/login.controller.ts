import { Request, Response } from 'express';
import { z } from 'zod';

import { signToken } from '../auth.js';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

/**
 * userLogin
 * ---------
 * Handles the user login process.
 *
 * Steps:
 * 1. Validate request body using Zod to prevent malformed input.
 * 2. Verify credentials (here, a simple static check for demonstration).
 * 3. If valid, sign a JWT token and set it as a HTTP-only cookie.
 * 4. Return a JSON response confirming authentication.
 */
export const userLogin = async (req: Request, res: Response) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'Invalid payload' });

  try {
    const { username, password } = parse.data;

    if (username === 'admin' && password === 'admin') {
      const token = signToken({ sub: '1', username: 'admin' });
      const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

      res.cookie('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax',
        maxAge: 7 * 24 * 3600 * 1000,
        domain: cookieDomain
      });

      return res.json({ ok: true, token });
    }

    return res.status(401).json({ error: 'Incorrect credentials' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}

/**
 * userLogout
 * ----------
 * Clears the authentication cookie to log the user out.
 *
 * Notes:
 * - Must use the same cookie attributes (domain, sameSite, etc.) that were used when setting the cookie.
 */
export const userLogout = async (_req: Request, res: Response) => {
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;

  try {
    res.clearCookie('auth-token', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      domain: cookieDomain,
      path: '/login',
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
