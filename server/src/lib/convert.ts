import path from 'node:path';
import mammoth from 'mammoth';
import { marked } from 'marked';
import { HttpError } from '../errors.js';
import { sanitize } from './sanitize.js';

export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.docx'] as const;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export interface Converted {
  title: string;
  html: string;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Plain text: blank lines separate paragraphs; single newlines become <br>. */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Turns an uploaded file into sanitized, editor-compatible HTML plus a suggested title. */
export async function convertUpload(originalName: string, buffer: Buffer): Promise<Converted> {
  const ext = path.extname(originalName).toLowerCase();
  const title = path.basename(originalName, path.extname(originalName)).trim().slice(0, 200) || 'Imported document';

  let html: string;
  switch (ext) {
    case '.txt':
      html = textToHtml(buffer.toString('utf8'));
      break;
    case '.md':
      html = await marked.parse(buffer.toString('utf8'), { gfm: true });
      break;
    case '.docx':
      try {
        // mammoth drops underline by default; keep it since the editor supports it.
        html = (await mammoth.convertToHtml({ buffer }, { styleMap: ['u => u'] })).value;
      } catch {
        throw new HttpError(400, 'Could not read that .docx file. Is it a valid Word document?');
      }
      break;
    default:
      throw new HttpError(400, `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}.`);
  }

  const clean = sanitize(html);
  return { title, html: clean || '<p></p>' };
}
