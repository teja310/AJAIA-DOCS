import { Router, type RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { DB } from './db.js';
import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'ajaia_session';

export interface User {
  id: number;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const LoginBody = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

/**
 * Mocked-but-real auth: seeded users log in with a password, and we store their id in a
 * signed, httpOnly cookie. Signing prevents a client from forging another user's id.
 */
export function authRouter(db: DB, opts: { secureCookies: boolean }) {
  const router = Router();

  router.post('/login', (req, res) => {
    const { email, password } = LoginBody.parse(req.body);
    const row = db
      .prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?')
      .get(email) as (User & { password_hash: string }) | undefined;
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      throw new HttpError(401, 'Invalid email or password.');
    }
    res.cookie(SESSION_COOKIE, String(row.id), {
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      secure: opts.secureCookies,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
    res.json({ user: { id: row.id, email: row.email, name: row.name } });
  });

  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE);
    res.status(204).end();
  });

  router.get('/me', requireUser(db), (req, res) => {
    res.json({ user: req.user });
  });

  return router;
}

export function requireUser(db: DB): RequestHandler {
  const stmt = db.prepare('SELECT id, email, name FROM users WHERE id = ?');
  return (req, _res, next) => {
    const raw = req.signedCookies?.[SESSION_COOKIE];
    const id = Number(raw);
    const user = raw && Number.isInteger(id) ? (stmt.get(id) as User | undefined) : undefined;
    if (!user) return next(new HttpError(401, 'Please sign in.'));
    req.user = user;
    next();
  };
}
