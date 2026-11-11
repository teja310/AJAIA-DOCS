import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

export type DB = Database.Database;

export const DEMO_PASSWORD = 'demo1234';

export const SEED_USERS = [
  { email: 'alice@ajaia.test', name: 'Alice Chen' },
  { email: 'bob@ajaia.test', name: 'Bob Okafor' },
  { email: 'carol@ajaia.test', name: 'Carol Singh' },
];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);

CREATE TABLE IF NOT EXISTS document_shares (
  document_id TEXT    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT    NOT NULL CHECK (role IN ('viewer','editor')),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (document_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shares_user ON document_shares(user_id);
`;

/** Opens (or creates) the database, applies the schema and seeds demo data if empty. */
export function openDb(filename: string): DB {
  const db = new Database(filename);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  seed(db);
  return db;
}

function seed(db: DB) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (n > 0) return;

  const hash = bcrypt.hashSync(DEMO_PASSWORD, 8);
  const insertUser = db.prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)');
  const ids = SEED_USERS.map((u) => Number(insertUser.run(u.email, u.name, hash).lastInsertRowid));

  // One welcome doc owned by Alice and shared with Bob, so the sharing flow is visible immediately.
  const docId = crypto.randomUUID();
  db.prepare('INSERT INTO documents (id, owner_id, title, content_html) VALUES (?, ?, ?, ?)').run(
    docId,
    ids[0],
    'Welcome to Ajaia Docs',
    '<h1>Welcome to Ajaia Docs</h1>' +
      '<p>This is a <strong>lightweight</strong> collaborative editor. Try <em>formatting</em>, <u>underlining</u>, and lists:</p>' +
      '<ul><li><p>Create and rename documents</p></li><li><p>Import .txt, .md or .docx files</p></li><li><p>Share with teammates as viewer or editor</p></li></ul>' +
      '<p>Changes save automatically.</p>',
  );
  db.prepare('INSERT INTO document_shares (document_id, user_id, role) VALUES (?, ?, ?)').run(docId, ids[1], 'editor');
}
