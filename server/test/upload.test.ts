import fs from 'node:fs';
import { describe, it, expect, beforeEach } from 'vitest';
import { setup } from './helpers.js';

const fixture = (name: string) => fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url));

let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  ctx = await setup();
});

describe('file import', () => {
  it('turns a Markdown file into a new formatted document', async () => {
    const md = '# Launch notes\n\nSome **bold** and _italic_ text.\n\n- alpha\n- beta\n\n<script>alert(1)</script>\n';
    const res = await ctx.alice
      .post('/api/uploads/import')
      .attach('file', Buffer.from(md), 'launch-notes.md')
      .expect(201);

    const doc = res.body.document;
    expect(doc.title).toBe('launch-notes');
    expect(doc.role).toBe('owner');
    expect(doc.content_html).toContain('<h1>Launch notes</h1>');
    expect(doc.content_html).toContain('<strong>bold</strong>');
    expect(doc.content_html).toContain('<em>italic</em>');
    expect(doc.content_html).toMatch(/<ul>\s*<li>alpha<\/li>/);
    expect(doc.content_html).not.toContain('<script');

    const list = await ctx.alice.get('/api/documents');
    expect(list.body.owned.map((d: { id: string }) => d.id)).toContain(doc.id);
  });

  it('turns a Word .docx into a new document, keeping headings, marks and lists', async () => {
    const res = await ctx.alice
      .post('/api/uploads/import')
      .attach('file', fixture('quarterly-review.docx'), 'quarterly-review.docx')
      .expect(201);
    expect(res.body.document.title).toBe('quarterly-review');
    expect(res.body.document.content_html).toBe(
      '<h1>Quarterly Review</h1>' +
        '<p>Some <strong>bold</strong> and <em>italic</em> and <u>underlined</u> text.</p>' +
        '<h2>Highlights</h2><ul><li>Revenue up</li><li>Costs flat</li></ul><ol><li>Hire</li><li>Ship</li></ol>',
    );
  });

  it('rejects a corrupt .docx with a helpful message', async () => {
    const res = await ctx.alice
      .post('/api/uploads/import')
      .attach('file', Buffer.from('not a zip'), 'broken.docx')
      .expect(400);
    expect(res.body.error).toMatch(/could not read/i);
  });

  it('turns a text file into paragraphs and escapes markup', async () => {
    const res = await ctx.alice
      .post('/api/uploads/import')
      .attach('file', Buffer.from('Line one\nline two\n\n<b>not bold</b>'), 'notes.txt')
      .expect(201);
    expect(res.body.document.content_html).toBe('<p>Line one<br />line two</p><p>&lt;b&gt;not bold&lt;/b&gt;</p>');
  });

  it('rejects unsupported file types and missing files', async () => {
    const bad = await ctx.alice
      .post('/api/uploads/import')
      .attach('file', Buffer.from('%PDF-1.4'), 'report.pdf')
      .expect(400);
    expect(bad.body.error).toMatch(/unsupported/i);

    await ctx.alice.post('/api/uploads/import').expect(400);
  });

  it('rejects files over 2 MB', async () => {
    const big = Buffer.alloc(2 * 1024 * 1024 + 1, 'a');
    const res = await ctx.alice.post('/api/uploads/import').attach('file', big, 'big.txt').expect(400);
    expect(res.body.error).toMatch(/too large/i);
  });

  it('appends an imported file into an existing document (editors only)', async () => {
    const { body } = await ctx.alice
      .post('/api/documents')
      .send({ title: 'Draft', content_html: '<p>Existing</p>' })
      .expect(201);
    const id = body.document.id;

    const res = await ctx.alice
      .post(`/api/documents/${id}/import`)
      .attach('file', Buffer.from('## Appendix'), 'appendix.md')
      .expect(200);
    expect(res.body.document.content_html).toBe('<p>Existing</p><h2>Appendix</h2>');
    expect(res.body.document.version).toBe(2);

    await ctx.alice.post(`/api/documents/${id}/shares`).send({ email: 'bob@ajaia.test', role: 'viewer' });
    await ctx.bob
      .post(`/api/documents/${id}/import`)
      .attach('file', Buffer.from('x'), 'x.txt')
      .expect(403);
  });
});
