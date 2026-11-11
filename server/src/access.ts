import type { DB } from './db.js';
import { HttpError } from './errors.js';

export type Role = 'owner' | 'editor' | 'viewer';

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

/** The single source of truth for "what can this user do with this document". */
export function getRole(db: DB, documentId: string, userId: number): Role | null {
  const row = db
    .prepare(
      `SELECT CASE WHEN d.owner_id = @userId THEN 'owner' ELSE s.role END AS role
         FROM documents d
         LEFT JOIN document_shares s ON s.document_id = d.id AND s.user_id = @userId
        WHERE d.id = @documentId`,
    )
    .get({ documentId, userId }) as { role: Role | null } | undefined;
  return row?.role ?? null;
}

/**
 * Throws unless the user has at least `minimum` access.
 * No access at all → 404 (don't reveal that the document exists).
 * Some access but not enough → 403.
 */
export function assertRole(db: DB, documentId: string, userId: number, minimum: Role): Role {
  const role = getRole(db, documentId, userId);
  if (!role) throw new HttpError(404, 'Document not found.');
  if (RANK[role] < RANK[minimum]) {
    const msg = minimum === 'owner' ? 'Only the owner can do that.' : 'You have view-only access to this document.';
    throw new HttpError(403, msg);
  }
  return role;
}
