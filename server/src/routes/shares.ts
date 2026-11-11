import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../db.js';
import { assertRole } from '../access.js';
import { HttpError } from '../errors.js';

const ShareBody = z.object({
  email: z.string().trim().email(),
  role: z.enum(['viewer', 'editor']),
});

/** Mounted at /api/documents/:id/shares. Only the owner can view or change access. */
export function sharesRouter(db: DB) {
  const router = Router({ mergeParams: true });

  const listShares = (documentId: string) =>
    db
      .prepare(
        `SELECT u.id AS user_id, u.email, u.name, s.role, s.created_at
           FROM document_shares s JOIN users u ON u.id = s.user_id
          WHERE s.document_id = ? ORDER BY u.name`,
      )
      .all(documentId);

  router.get('/', (req, res) => {
    const id = (req.params as { id: string }).id;
    assertRole(db, id, req.user!.id, 'owner');
    res.json({ shares: listShares(id) });
  });

  // Upsert: sharing with someone who already has access just changes their role.
  router.post('/', (req, res) => {
    const id = (req.params as { id: string }).id;
    assertRole(db, id, req.user!.id, 'owner');
    const { email, role } = ShareBody.parse(req.body);

    const target = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
    if (!target) throw new HttpError(404, `No user with email ${email}.`);
    if (target.id === req.user!.id) throw new HttpError(400, 'You already own this document.');

    db.prepare(
      `INSERT INTO document_shares (document_id, user_id, role) VALUES (?, ?, ?)
       ON CONFLICT (document_id, user_id) DO UPDATE SET role = excluded.role`,
    ).run(id, target.id, role);
    res.status(201).json({ shares: listShares(id) });
  });

  router.delete('/:userId', (req, res) => {
    const { id, userId } = req.params as { id: string; userId: string };
    assertRole(db, id, req.user!.id, 'owner');
    db.prepare('DELETE FROM document_shares WHERE document_id = ? AND user_id = ?').run(id, Number(userId));
    res.json({ shares: listShares(id) });
  });

  return router;
}
