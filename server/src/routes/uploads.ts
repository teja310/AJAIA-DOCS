import { Router } from 'express';
import multer from 'multer';
import type { DB } from '../db.js';
import { assertRole } from '../access.js';
import { HttpError } from '../errors.js';
import { convertUpload, MAX_UPLOAD_BYTES } from '../lib/convert.js';
import { createDocument, loadDocument } from './documents.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

function requireFile(file: Express.Multer.File | undefined): Express.Multer.File {
  if (!file) throw new HttpError(400, 'No file uploaded. Use the "file" field.');
  return file;
}

/** POST /api/uploads/import — turn an uploaded .txt/.md/.docx into a brand-new document. */
export function uploadsRouter(db: DB) {
  const router = Router();
  router.post('/import', upload.single('file'), async (req, res) => {
    const file = requireFile(req.file);
    const { title, html } = await convertUpload(file.originalname, file.buffer);
    const doc = createDocument(db, req.user!.id, title, html);
    res.status(201).json({ document: { ...doc, role: 'owner' } });
  });
  return router;
}

/** POST /api/documents/:id/import — append an uploaded file's content to an existing document. */
export function importIntoDocumentRouter(db: DB) {
  const router = Router({ mergeParams: true });
  router.post('/', upload.single('file'), async (req, res) => {
    const id = (req.params as { id: string }).id;
    const role = assertRole(db, id, req.user!.id, 'editor');
    const file = requireFile(req.file);
    const { html } = await convertUpload(file.originalname, file.buffer);

    db.prepare(
      `UPDATE documents
          SET content_html = content_html || ?, version = version + 1,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ?`,
    ).run(html, id);
    res.json({ document: { ...loadDocument(db, id), role } });
  });
  return router;
}
