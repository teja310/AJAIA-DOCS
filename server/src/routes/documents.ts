import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../db.js';
import { assertRole } from '../access.js';
import { HttpError } from '../errors.js';
import { sanitize } from '../lib/sanitize.js';

const Title = z.string().trim().min(1, 'Title cannot be empty').max(200, 'Title is too long (max 200)');

const CreateBody = z.object({
  title: Title.optional(),
  content_html: z.string().optional(),
});

const PatchBody = z
  .object({
    title: Title.optional(),
    content_html: z.string().optional(),
    version: z.number().int().positive(),
  })
  .refine((b) => b.title !== undefined || b.content_html !== undefined, 'Nothing to update');

export interface DocumentRow {
  id: string;
  owner_id: number;
  owner_name: string;
  title: string;
  content_html: string;
  version: number;
  created_at: string;
  updated_at: string;
}

const SELECT_DOC = `
  SELECT d.id, d.owner_id, u.name AS owner_name, d.title, d.content_html, d.version, d.created_at, d.updated_at
    FROM documents d JOIN users u ON u.id = d.owner_id`;

export function loadDocument(db: DB, id: string) {
  return db.prepare(`${SELECT_DOC} WHERE d.id = ?`).get(id) as DocumentRow;
}

export function createDocument(db: DB, ownerId: number, title: string, html: string) {
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO documents (id, owner_id, title, content_html) VALUES (?, ?, ?, ?)').run(
    id,
    ownerId,
    title,
    sanitize(html),
  );
  return loadDocument(db, id);
}

export function documentsRouter(db: DB) {
  const router = Router();

  router.get('/', (req, res) => {
    const userId = req.user!.id;
    const owned = db
      .prepare(
        `SELECT d.id, d.title, d.updated_at, u.name AS owner_name, 'owner' AS role
           FROM documents d JOIN users u ON u.id = d.owner_id
          WHERE d.owner_id = ? ORDER BY d.updated_at DESC`,
      )
      .all(userId);
    const shared = db
      .prepare(
        `SELECT d.id, d.title, d.updated_at, u.name AS owner_name, s.role
           FROM document_shares s
           JOIN documents d ON d.id = s.document_id
           JOIN users u ON u.id = d.owner_id
          WHERE s.user_id = ? ORDER BY d.updated_at DESC`,
      )
      .all(userId);
    res.json({ owned, shared });
  });

  router.post('/', (req, res) => {
    const body = CreateBody.parse(req.body ?? {});
    const doc = createDocument(db, req.user!.id, body.title ?? 'Untitled document', body.content_html ?? '');
    res.status(201).json({ document: { ...doc, role: 'owner' } });
  });

  router.get('/:id', (req, res) => {
    const role = assertRole(db, req.params.id, req.user!.id, 'viewer');
    res.json({ document: { ...loadDocument(db, req.params.id), role } });
  });

  router.patch('/:id', (req, res) => {
    const id = req.params.id;
    const role = assertRole(db, id, req.user!.id, 'editor');
    const body = PatchBody.parse(req.body);

    // Optimistic concurrency: the write only lands if the client edited the latest version.
    // This prevents two editors from silently overwriting each other.
    const result = db
      .prepare(
        `UPDATE documents
            SET title        = COALESCE(@title, title),
                content_html = COALESCE(@content_html, content_html),
                version      = version + 1,
                updated_at   = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = @id AND version = @version`,
      )
      .run({
        id,
        version: body.version,
        title: body.title ?? null,
        content_html: body.content_html !== undefined ? sanitize(body.content_html) : null,
      });

    if (result.changes === 0) {
      throw new HttpError(409, 'This document was changed by someone else. Reload to get the latest version.');
    }
    res.json({ document: { ...loadDocument(db, id), role } });
  });

  router.delete('/:id', (req, res) => {
    assertRole(db, req.params.id, req.user!.id, 'owner');
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  return router;
}
