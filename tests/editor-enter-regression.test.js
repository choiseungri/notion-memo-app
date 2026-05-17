const test = require('node:test');
const assert = require('node:assert/strict');
const { createReadStream, existsSync, mkdtempSync, rmSync } = require('node:fs');
const { createServer } = require('node:http');
const { extname, join, resolve } = require('node:path');
const { spawn } = require('node:child_process');
const { tmpdir } = require('node:os');

const ROOT = resolve(__dirname, '..');
const CHROME_PATHS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

test('double Enter in the middle of a block moves trailing text into the next block', async (t) => {
  const chromePath = CHROME_PATHS.find((candidate) => existsSync(candidate));
  if (!chromePath) {
    t.skip('Chrome is not installed in a known location');
    return;
  }

  const server = await startStaticServer();
  const port = await getFreeDebugPort();
  const profile = mkdtempSync(join(tmpdir(), 'memo-enter-test-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank'
  ], { stdio: 'ignore' });

  t.after(async () => {
    chrome.kill('SIGTERM');
    server.close();
    await sleep(100);
    rmSync(profile, { recursive: true, force: true });
  });

  await waitForChrome(port);
  const tab = await createTab(port, `http://127.0.0.1:${server.address().port}/?enter-regression=${Date.now()}`);
  const cdp = await connect(tab.webSocketDebuggerUrl);
  t.after(() => cdp.close());

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await sleep(500);
  await cdp.send('Runtime.evaluate', { expression: 'localStorage.clear()' });
  await cdp.send('Page.reload', { ignoreCache: true });
  await sleep(500);

  const result = await cdp.send('Runtime.evaluate', {
    expression: `(() => new Promise((resolve) => {
      const target = document.querySelector('[contenteditable][data-field="html"]');
      target.textContent = 'abcdef';
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'abcdef' }));

      const range = document.createRange();
      range.setStart(target.firstChild, 3);
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

      setTimeout(() => {
        const saved = JSON.parse(localStorage.getItem('local-notion-memo.v1') || '{}');
        resolve(saved.memos?.[0]?.blocks?.map((block) => ({ type: block.type, html: block.html })) || []);
      }, 700);
    }))()`,
    awaitPromise: true,
    returnByValue: true
  });

  assert.deepEqual(result.result.value.slice(0, 2), [
    { type: 'p', html: 'abc' },
    { type: 'p', html: 'def' }
  ]);
});

function startStaticServer() {
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  };

  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = resolve(ROOT, relative);
    if (!filePath.startsWith(ROOT) || !existsSync(filePath)) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream' });
    createReadStream(filePath).pipe(response);
  });

  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => resolveServer(server));
  });
}

function getFreeDebugPort() {
  const server = createServer();
  return new Promise((resolvePort) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolvePort(port));
    });
  });
}

async function waitForChrome(port) {
  for (let index = 0; index < 50; index += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
    } catch (_error) {
      // Retry until the debugging endpoint is ready.
    }
    await sleep(100);
  }
  throw new Error('Chrome debugging port did not open');
}

async function createTab(port, url) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  return response.json();
}

function connect(wsUrl) {
  return new Promise((resolveSocket, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();

    ws.onopen = () => resolveSocket({
      send(method, params = {}) {
        const id = nextId;
        nextId += 1;
        ws.send(JSON.stringify({ id, method, params }));
        return new Promise((resolve, rejectCall) => pending.set(id, { resolve, rejectCall, method }));
      },
      close() {
        ws.close();
      }
    });

    ws.onerror = reject;
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id);
      if (message.error) item.rejectCall(new Error(`${item.method}: ${message.error.message}`));
      else item.resolve(message.result);
    };
  });
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
