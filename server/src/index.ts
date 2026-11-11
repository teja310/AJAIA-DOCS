import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

const port = Number(process.env.PORT ?? 3001);
const dbFile = process.env.DATABASE_FILE ?? path.join(here, '..', 'data.db');
const sessionSecret = process.env.SESSION_SECRET ?? 'dev-only-secret-change-me';

if (isProd && !process.env.SESSION_SECRET) {
  console.warn('[warn] SESSION_SECRET is not set; using an insecure default.');
}

const db = openDb(dbFile);
const app = createApp(db, {
  sessionSecret,
  secureCookies: isProd,
  clientDist: path.join(here, '..', '..', 'client', 'dist'),
});

app.listen(port, () => {
  console.log(`Ajaia Docs listening on http://localhost:${port} (db: ${dbFile})`);
});
