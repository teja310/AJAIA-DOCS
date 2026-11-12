import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3999';
const OUT = new URL('./screenshots/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

// Uses your installed Google Chrome (no browser download). Requires the app running at BASE with a fresh DB.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const log = (...a) => console.log('✔', ...a);

async function session(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/status of (401|409)/.test(m.text()) && errors.push(`${name} console: ${m.text()}`));
  await page.goto(`${BASE}/login`);
  if (name === 'Alice Chen') await page.screenshot({ path: OUT + '00-login.png' });
  await page.getByRole('button', { name: new RegExp(name, 'i') }).click();
  await page.getByText('My documents').waitFor();
  return page;
}

// --- Alice: create, rename, format, autosave, reopen
const alice = await session('Alice Chen');
await alice.screenshot({ path: OUT + '01-dashboard.png' });
await alice.getByRole('button', { name: /blank document/i }).click();
await alice.waitForURL(/\/d\//);
const docUrl = alice.url();
const title = alice.getByLabel('Document title');
await title.fill('Q3 Launch Plan');
await title.press('Enter');
await alice.getByText(/✓ Saved/).waitFor();
log('created + renamed');

const ed = alice.locator('.tiptap');
await ed.click();
await alice.getByLabel('Text style').selectOption('h1');
await alice.keyboard.type('Launch plan');
await alice.keyboard.press('Enter');
await alice.keyboard.press('ControlOrMeta+b');
await alice.keyboard.type('Bold');
await alice.keyboard.press('ControlOrMeta+b');
await alice.keyboard.type(' ');
await alice.getByRole('button', { name: 'Italic' }).click();
await alice.keyboard.type('italic');
await alice.getByRole('button', { name: 'Italic' }).click();
await alice.keyboard.type(' ');
await alice.getByRole('button', { name: 'Underline' }).click();
await alice.keyboard.type('under');
await alice.getByRole('button', { name: 'Underline' }).click();
await alice.keyboard.press('Enter');
await alice.getByRole('button', { name: 'Bulleted list' }).click();
await alice.keyboard.type('first bullet');
await alice.keyboard.press('Enter');
await alice.keyboard.type('second bullet');
await alice.keyboard.press('Enter');
await alice.keyboard.press('Enter');
await alice.getByRole('button', { name: 'Numbered list' }).click();
await alice.keyboard.type('step one');
await alice.getByText('Saving…').or(alice.getByText('Unsaved changes')).first().waitFor();
await alice.getByText(/✓ Saved/).waitFor({ timeout: 5000 });
log('formatted + autosaved');
await alice.screenshot({ path: OUT + '02-editor.png' });

await alice.reload();
await alice.locator('.tiptap h1').waitFor();
const html = await alice.locator('.tiptap').innerHTML();
for (const tag of ['<h1>', '<strong>Bold</strong>', '<em>italic</em>', '<u>under</u>', '<ul>', '<ol>']) {
  if (!html.includes(tag)) throw new Error(`missing ${tag} after reload: ${html}`);
}
if ((await title.inputValue()) !== 'Q3 Launch Plan') throw new Error('title not persisted');
log('formatting + title persisted after reload');

// --- Import into the doc
await alice.locator('input[type=file]').setInputFiles({
  name: 'appendix.md', mimeType: 'text/markdown', buffer: Buffer.from('## Appendix\n\n- risk A\n- risk B\n'),
});
await alice.getByText(/Imported “appendix.md”/).waitFor();
if (!(await alice.locator('.tiptap h2', { hasText: 'Appendix' }).count())) throw new Error('import not shown');
log('import into existing doc');

// Bad upload type is rejected client-side
await alice.locator('input[type=file]').setInputFiles({ name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') });
await alice.getByText(/isn't supported/).waitFor();
log('unsupported file rejected');

// --- Share: Bob viewer, Carol editor
await alice.getByRole('button', { name: 'Share' }).click();
const dlg = alice.locator('dialog');
await dlg.getByLabel('Person').selectOption('bob@ajaia.test');
await dlg.getByLabel('Access level').selectOption('viewer');
await dlg.getByRole('button', { name: 'Share' }).click();
await dlg.getByText('Bob Okafor').waitFor();
await dlg.getByLabel('Person').selectOption('carol@ajaia.test');
await dlg.getByLabel('Access level').selectOption('editor');
await dlg.getByRole('button', { name: 'Share' }).click();
await dlg.getByText('Carol Singh').waitFor();
await alice.screenshot({ path: OUT + '03-share.png' });
await dlg.getByRole('button', { name: 'Close' }).click();
log('shared with bob (viewer) + carol (editor)');

// --- Bob: sees it as shared, read-only
const bob = await session('Bob Okafor');
const shared = bob.locator('.doc-section', { hasText: 'Shared with me' });
await shared.getByText('Q3 Launch Plan').waitFor();
await shared.locator('.doc-item', { hasText: 'Q3 Launch Plan' }).getByText('View only').waitFor();
await bob.screenshot({ path: OUT + '04-bob-dashboard.png' });
await bob.goto(docUrl);
await bob.getByText(/view-only/).waitFor();
await bob.screenshot({ path: OUT + '04b-bob-readonly.png' });
if (await bob.locator('.toolbar').count()) throw new Error('viewer sees toolbar');
if ((await bob.locator('.tiptap').getAttribute('contenteditable')) !== 'false') throw new Error('viewer can edit');
log('bob sees doc as read-only');

// --- Carol: edits, then Alice's stale tab hits a conflict
const carol = await session('Carol Singh');
await carol.goto(docUrl);
await carol.locator('.tiptap').click();
await carol.keyboard.press('ControlOrMeta+End');
await carol.keyboard.press('Enter');
await carol.keyboard.type('Carol was here');
await carol.getByText(/✓ Saved/).waitFor({ timeout: 5000 });
log('carol edited as editor');

await alice.locator('.tiptap').click();
await alice.keyboard.type(' stale edit');
await alice.getByText(/changed by someone else/).waitFor({ timeout: 5000 });
await alice.screenshot({ path: OUT + '05-conflict.png' });
log('stale write produced conflict banner');
await alice.getByRole('button', { name: 'Reload latest' }).click();
await alice.getByText('Carol was here').waitFor();
log('reload shows carol edit');

// --- Upload as new doc from dashboard
await alice.goto(BASE + '/');
await alice.locator('input[type=file]').setInputFiles({
  name: 'meeting-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Agenda\n\nItem one\nItem two'),
});
await alice.waitForURL(/\/d\//);
if ((await alice.getByLabel('Document title').inputValue()) !== 'meeting-notes') throw new Error('upload title');
log('upload creates new doc');

// Long doc: scroll and make sure the toolbar stays pinned below the header
await alice.locator('.tiptap').click();
for (let i = 0; i < 40; i++) { await alice.keyboard.type('Paragraph ' + i); await alice.keyboard.press('Enter'); }
await alice.mouse.wheel(0, 600);
await alice.waitForTimeout(300);
await alice.screenshot({ path: OUT + '06-scrolled.png' });
await alice.goto(BASE + '/');
await alice.screenshot({ path: OUT + '07-alice-dashboard.png' });

await browser.close();
if (errors.length) {
  console.log('Browser errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('ALL UI CHECKS PASSED');
