import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setup } from './helpers.js';

let ctx: Awaited<ReturnType<typeof setup>>;
beforeEach(async () => {
  ctx = await setup();
});

describe('auth', () => {
  it('rejects unauthenticated requests', async () => {
    await request(ctx.app).get('/api/documents').expect(401);
  });

  it('rejects a wrong password', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'alice@ajaia.test', password: 'nope' })
      .expect(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('rejects a forged (unsigned) session cookie', async () => {
    await request(ctx.app).get('/api/documents').set('Cookie', 'ajaia_session=1').expect(401);
  });
});

describe('documents', () => {
  it('creates, renames, edits and reopens a document with formatting intact', async () => {
    const created = await ctx.alice.post('/api/documents').send({}).expect(201);
    const doc = created.body.document;
    expect(doc.title).toBe('Untitled document');
    expect(doc.version).toBe(1);

    const html = '<h2>Plan</h2><p><strong>bold</strong> <em>it</em> <u>under</u></p><ol><li><p>one</p></li></ol>';
    const saved = await ctx.alice
      .patch(`/api/documents/${doc.id}`)
      .send({ title: 'Q3 plan', content_html: html, version: 1 })
      .expect(200);
    expect(saved.body.document.version).toBe(2);

    const reopened = await ctx.alice.get(`/api/documents/${doc.id}`).expect(200);
    expect(reopened.body.document.title).toBe('Q3 plan');
    expect(reopened.body.document.content_html).toBe(html);
  });

  it('strips dangerous HTML on save', async () => {
    const { body } = await ctx.alice.post('/api/documents').send({}).expect(201);
    const res = await ctx.alice
      .patch(`/api/documents/${body.document.id}`)
      .send({ content_html: '<p onclick="x()">hi</p><script>alert(1)</script>', version: 1 })
      .expect(200);
    expect(res.body.document.content_html).toBe('<p>hi</p>');
  });

  it('validates titles', async () => {
    const { body } = await ctx.alice.post('/api/documents').send({}).expect(201);
    const res = await ctx.alice
      .patch(`/api/documents/${body.document.id}`)
      .send({ title: '   ', version: 1 })
      .expect(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it('returns 409 when saving on top of a stale version', async () => {
    const { body } = await ctx.alice.post('/api/documents').send({}).expect(201);
    const id = body.document.id;
    await ctx.alice.patch(`/api/documents/${id}`).send({ content_html: '<p>first</p>', version: 1 }).expect(200);
    const stale = await ctx.alice
      .patch(`/api/documents/${id}`)
      .send({ content_html: '<p>overwrite</p>', version: 1 })
      .expect(409);
    expect(stale.body.error).toMatch(/changed by someone else/);

    const current = await ctx.alice.get(`/api/documents/${id}`);
    expect(current.body.document.content_html).toBe('<p>first</p>');
  });

  it('returns 404 for a document the user has no access to', async () => {
    const { body } = await ctx.alice.post('/api/documents').send({ title: 'Private' }).expect(201);
    await ctx.carol.get(`/api/documents/${body.document.id}`).expect(404);
    await ctx.carol.patch(`/api/documents/${body.document.id}`).send({ title: 'x', version: 1 }).expect(404);
    await ctx.carol.delete(`/api/documents/${body.document.id}`).expect(404);
  });
});
