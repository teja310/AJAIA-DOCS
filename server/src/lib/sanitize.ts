import sanitizeHtml from 'sanitize-html';

/**
 * Whitelist matching what the editor can actually produce. Anything else (scripts, styles,
 * event handlers, iframes, images) is stripped before it is stored — both for content saved
 * from the editor and for imported files.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'strong', 'b', 'em', 'i', 'u', 's',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'], ol: ['start'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    // Imported docs often use h4–h6; fold them into the editor's supported levels.
    h4: 'h3', h5: 'h3', h6: 'h3',
    b: 'strong', i: 'em',
  },
};

export function sanitize(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}
