const { request, chromium } = require('./playwright-runtime.cjs');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../src/LingWay.Web');
let server;
async function start() {
  server = spawn('dotnet', ['bin/Validation/net10.0/LingWay.Web.dll', '--urls', 'http://localhost:5181'], {
    cwd: root, stdio: 'ignore', env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development',
      ConnectionStrings__LingWay: 'Server=localhost;Database=LingWay_HardeningTest20261101;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True', Mail__Mode: 'Local' }
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://localhost:5181/api/bootstrap')).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Test server did not start');
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  await new Promise(r => { server.once('exit', r); server.kill(); });
}
(async () => {
  await start();
  const ctx = await request.newContext({ baseURL: 'http://localhost:5181' });
  let state = await (await ctx.get('/api/bootstrap')).json();
  const accounts = fs.readFileSync(path.resolve(__dirname, process.env.LINGWAY_TEST_ACCOUNTS || "../tests/accounts.local.txt"), 'utf8');
  const password = accounts.match(/Email: student@lingway\.local\s+Пароль: ([^\r\n]+)/)[1];
  assert.equal((await ctx.post('/api/login', { data: { email: 'student@lingway.local', password }, headers: { 'X-CSRF-Token': state.csrf } })).status(), 200);
  state = await (await ctx.get('/api/bootstrap')).json();
  assert.ok(state.user);
  assert.ok((await (await ctx.get('/api/bootstrap')).json()).user, 'session remains valid within one server run');
  const post = (url, data) => ctx.post(url, { data, headers: { 'X-CSRF-Token': state.csrf } });
  assert.equal((await post('/api/profile', { profile: { notifications: false } })).status(), 200);
  const push = await post('/api/push-test', {});
  assert.equal(push.status(), 400);
  assert.match((await push.json()).error, /выключены/);
  assert.equal((await post('/api/notifications/test', {})).status(), 200);
  let inbox = await (await ctx.get('/api/notifications')).json();
  const notification = inbox.find(n => n.title === 'Тестовое уведомление' && !n.readAt);
  assert.ok(notification, 'test notification is persisted');
  const other = await request.newContext({ baseURL: 'http://localhost:5181' });
  let otherState = await (await other.get('/api/bootstrap')).json();
  await other.post('/api/guest', { data: {}, headers: { 'X-CSRF-Token': otherState.csrf } });
  otherState = await (await other.get('/api/bootstrap')).json();
  assert.equal((await other.post('/api/notifications/read', { data: { id: notification.id }, headers: { 'X-CSRF-Token': otherState.csrf } })).status(), 404);
  assert.ok(!(await (await other.get('/api/notifications')).json()).some(n => n.id === notification.id));
  await other.dispose();
  assert.equal((await post('/api/notifications/read', { id: notification.id })).status(), 200);
  inbox = await (await ctx.get('/api/notifications')).json();
  assert.ok(inbox.find(n => n.id === notification.id).readAt);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ storageState: await ctx.storageState() });
    await page.goto('http://localhost:5181/#settings');
    await page.getByRole('button', { name: 'Добавить тест в колокольчик' }).click();
    await page.waitForFunction(() => document.querySelector('#push-test-status')?.textContent.includes('добавлено'));
    assert.ok(await page.locator('.notification-panel').isVisible());
    assert.ok(await page.locator('.notification-badge').isVisible());
    await page.reload();
    await page.locator('.notification-button').click();
    await page.getByText('Тестовое уведомление', { exact: true }).first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Разрешить уведомления', exact: true }).count(), 0);
    await page.evaluate(() => startNewLesson(data.lessons.find(l => l.published && moduleUnlocked(l.module_id)).id));
    async function step() {
      await page.evaluate(async () => {
        const s = currentLesson().steps[training.index];
        if (!training.feedback) {
          const form = document.createElement('form');
          const field = document.createElement('input'); field.name = 'value';
          field.value = s.options ? String(s.answer) : s.accepted[0];
          form.append(field); await answerStep(form);
        }
        await nextStep();
      });
    }
    await step(); await step();
    await page.evaluate(() => syncLessonProgress());
    const checkpoint = await page.evaluate(() => ({ id: training.id, index: training.index, lesson: training.lesson_id, answers: training.answers.length }));
    assert.equal(checkpoint.answers, 2);
    await page.evaluate(() => go('dashboard'));
    await page.getByRole('button', { name: 'Продолжить с сохранённого шага' }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Продолжить с сохранённого шага' }).click();
    assert.equal(await page.evaluate(() => training.index), checkpoint.index);
    const clean = await browser.newContext({ storageState: await ctx.storageState() });
    const cleanPage = await clean.newPage();
    await cleanPage.goto('http://localhost:5181/#dashboard');
    await cleanPage.getByRole('button', { name: 'Продолжить с сохранённого шага' }).click();
    assert.equal(await cleanPage.evaluate(() => training.id), checkpoint.id, 'checkpoint restored from account in a fresh browser');
    await clean.close();
    page.on('dialog', d => d.accept());
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => data.user && navigator.serviceWorker.controller);
    await page.evaluate(() => downloadOffline());
    await page.context().setOffline(true);
    await page.reload();
    await page.waitForFunction(() => training && data.user);
    assert.equal(await page.evaluate(() => training.index), checkpoint.index);
    assert.ok(await page.evaluate(async () => {
      const response = await fetch(Object.values(data.offline_audio)[0]);
      const audio = new AudioContext();
      try { return (await audio.decodeAudioData(await response.arrayBuffer())).duration > 0; }
      finally { await audio.close(); }
    }), 'cached audio decodes without network');
    let count = 0;
    while (await page.evaluate(() => !!training)) {
      assert.ok(count++ < 100, 'lesson terminates');
      await step();
    }
    assert.ok(await page.evaluate(async id => (await offlineGet('queue-' + data.user.id)).some(a => a.id === id), checkpoint.id));
    await page.context().setOffline(false);
    await page.evaluate(async () => { await refresh(); await syncQueue(); await syncQueue(); });
    assert.equal(await page.evaluate(id => data.attempts.filter(a => a.id === id).length, checkpoint.id), 1);
    assert.equal(await page.evaluate(async () => (await offlineGet('queue-' + data.user.id)).length), 0);
    assert.equal(await page.evaluate(() => pendingLesson()), undefined);
  } finally { await browser.close(); }
  await stop();
  await start();
  state = await (await ctx.get('/api/bootstrap')).json();
  assert.equal(state.user, null, 'restart invalidates previous login');
  await ctx.dispose();
  console.log('PASS: sessions; notification ownership/UI; partial lesson resume after reload and in fresh browser; full offline completion; reconnect sync without duplicates; server restart logout.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(stop);
