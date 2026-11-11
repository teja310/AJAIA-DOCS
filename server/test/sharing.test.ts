import { describe, it, expect, beforeEach } from 'vitest';
import { setup } from './helpers.js';

let ctx: Awaited<ReturnType<typeof setup>>;
let docId: string;

beforeEach(async () => {
  ctx = await setup();
  const { body } = await ctx.alice.post('/api/documents').send({ title: 'Roadmap' }).expect(201);
  docId = body.document.id;
});

const listTitles = (rows: { title: string }[]) => rows.map((r) => r.title);

describe('sharing', () => {
  it('separates owned and shared documents on the dashboard', async () => {
    await ctx.alice.post(`/api/documents/${docId}/shares`).send({ email: 'bob@ajaia.test', role: 'viewer' }).expect(201);

    const alice = (await ctx.alice.get('/api/documents')).body;
    const bob = (await ctx.bob.get('/api/documents')).body;

    expect(listTitles(alice.owned)).toContain('Roadmap');
    expect(listTitles(alice.shared)).not.toContain('Roadmap');
    expect(listTitles(bob.owned)).not.toContain('Roadmap');
    const shared = bob.shared.find((d: { id: string }) => d.id === docId);
    expect(shared).toMatchObject({ role: 'viewer', owner_name: 'Alice Chen' });
  });

  it('lets a viewer read but not edit', async () => {
    await ctx.alice.post(`/api/documents/${docId}/shares`).send({ email: 'bob@ajaia.test', role: 'viewer' }).expect(201);

    const read = await ctx.bob.get(`/api/documents/${docId}`).expect(200);
    expect(read.body.document.role).toBe('viewer');
    const write = await ctx.bob.patch(`/api/documents/${docId}`).send({ content_html: '<p>hi</p>', version: 1 }).expect(403);
    expect(write.body.error).toMatch(/view-only/);
  });

  it('lets an editor edit, but not share or delete', async () => {
    await ctx.alice.post(`/api/documents/${docId}/shares`).send({ email: 'carol@ajaia.test', role: 'editor' }).expect(201);

    await ctx.carol.patch(`/api/documents/${docId}`).send({ content_html: '<p>edited by carol</p>', version: 1 }).expect(200);
    const seenByOwner = await ctx.alice.get(`/api/documents/${docId}`);
    expect(seenByOwner.body.document.content_html).toBe('<p>edited by carol</p>');

    await ctx.carol.post(`/api/documents/${docId}/shares`).send({ email: 'bob@ajaia.test', role: 'editor' }).expect(403);
    await ctx.carol.delete(`/api/documents/${docId}`).expect(403);
  });

  it('changes role on re-share and revokes access', async () => {
    await ctx.alice.post(`/api/documents/${docId}/shares`).send({ email: 'bob@ajaia.test', role: 'viewer' }).expect(201);
    const upgraded = await ctx.alice
      .post(`/api/documents/${docId}/shares`)
      .send({ email: 'bob@ajaia.test', role: 'editor' })
      .expect(201);
    expect(upgraded.body.shares).toHaveLength(1);
    expect(upgraded.body.shares[0].role).toBe('editor');

    const bobId = upgraded.body.shares[0].user_id;
    await ctx.alice.delete(`/api/documents/${docId}/shares/${bobId}`).expect(200);
    await ctx.bob.get(`/api/documents/${docId}`).expect(404);
  });

  it('validates share targets', async () => {
    const unknown = await ctx.alice
      .post(`/api/documents/${docId}/shares`)
      .send({ email: 'nobody@ajaia.test', role: 'viewer' })
      .expect(404);
    expect(unknown.body.error).toMatch(/no user/i);

    await ctx.alice.post(`/api/documents/${docId}/shares`).send({ email: 'alice@ajaia.test', role: 'viewer' }).expect(400);
    await ctx.alice.post(`/api/documents/${docId}/shares`).send({ email: 'bob@ajaia.test', role: 'admin' }).expect(400);
  });
});
