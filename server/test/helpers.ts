import request from 'supertest';
import { openDb, DEMO_PASSWORD } from '../src/db.js';
import { createApp } from '../src/app.js';

/** Fresh in-memory DB + app per test file, plus logged-in agents for each seeded user. */
export async function setup() {
  const db = openDb(':memory:');
  const app = createApp(db, { sessionSecret: 'test-secret' });

  async function login(name: 'alice' | 'bob' | 'carol') {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: `${name}@ajaia.test`, password: DEMO_PASSWORD }).expect(200);
    return agent;
  }

  return { db, app, alice: await login('alice'), bob: await login('bob'), carol: await login('carol') };
}
