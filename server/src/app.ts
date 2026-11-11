import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import type { DB } from './db.js';
import { authRouter, requireUser } from './auth.js';
import { documentsRouter } from './routes/documents.js';
import { sharesRouter } from './routes/shares.js';
import { importIntoDocumentRouter, uploadsRouter } from './routes/uploads.js';
import { errorHandler, HttpError } from './errors.js';

export interface AppOptions {
  sessionSecret: string;
  secureCookies?: boolean;
  /** Directory of the built SPA to serve in production. */
  clientDist?: string;
}

/** Builds the Express app around an already-open database (tests pass an in-memory one). */
export function createApp(db: DB, opts: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser(opts.sessionSecret));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter(db, { secureCookies: !!opts.secureCookies }));

  const auth = requireUser(db);
  app.get('/api/users', auth, (req, res) => {
    const users = db.prepare('SELECT id, email, name FROM users WHERE id != ? ORDER BY name').all(req.user!.id);
    res.json({ users });
  });
  app.use('/api/documents/:id/shares', auth, sharesRouter(db));
  app.use('/api/documents/:id/import', auth, importIntoDocumentRouter(db));
  app.use('/api/documents', auth, documentsRouter(db));
  app.use('/api/uploads', auth, uploadsRouter(db));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

  if (opts.clientDist && fs.existsSync(opts.clientDist)) {
    app.use(express.static(opts.clientDist, { index: false, maxAge: '1h' }));
    // SPA fallback: let React Router handle any non-API path.
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(opts.clientDist!, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
