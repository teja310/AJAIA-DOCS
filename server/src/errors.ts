import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

/** An error with an HTTP status that is safe to show to the client. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path.join('.');
    res.status(400).json({ error: path ? `${path}: ${first.message}` : first?.message ?? 'Invalid request' });
    return;
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 2 MB).' : err.message;
    res.status(400).json({ error: message });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Document is too large to save.' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
