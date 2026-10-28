// 本地静态服务 + 无头 Chrome / Edge（Chrome 调试协议），供分享图和取景检查脚本共用。
// 不依赖外网：页面里的 three.js 在 vendor/ 下。需要 Node 22+（自带 fetch、WebSocket）。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.css': 'text/css; charset=utf-8',
};

// 只读静态服务，根目录之外的路径一律 404
function startStaticServer(root, port = 0) {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(base, `.${rel}`);
    if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject); // 例如端口被占用
    server.listen(port, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise((r) => server.close(r)) }));
  });
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

// 启动无头浏览器，返回一个页面的控制对象
async function launch({ width = 1280, height = 800, port = null } = {}) {
  const browserPath = findBrowser();
  if (!browserPath) throw new Error('找不到 Chrome 或 Edge，可用环境变量 CHROME_PATH 指定');
  // 调试端口每次另找一个空闲的：固定端口时，同时跑两个检查会连到同一个浏览器、互相干扰
  if (!port) port = await new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  // 用临时配置目录，不碰日常使用的浏览器配置
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'flatpack3d-'));
  const proc = spawn(browserPath, [
    '--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-first-run',
    `--user-data-dir=${profile}`, `--window-size=${width},${height}`, `--remote-debugging-port=${port}`, 'about:blank',
  ], { stdio: 'ignore' });
  const close = async () => {
    proc.kill();
    await sleep(300);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(200);
      try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* 还没起来 */ }
    }
    if (!target) throw new Error('浏览器调试端口没有响应');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    const consoleErrors = [];
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
      if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    };
    const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Runtime.enable');
    const page = {
      consoleErrors,
      async evaluate(expr) {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
        return r.result?.result?.value;
      },
      async setViewport(w, h, mobile = false) {
        await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile, screenWidth: w, screenHeight: h });
      },
      async goto(url, readyExpr = '!!window.__flatpack && !!window.__flatpack.view', timeoutMs = 30000) {
        await send('Page.navigate', { url });
        for (let t = 0; t < timeoutMs; t += 200) {
          await sleep(200);
          if (await page.evaluate(readyExpr).catch(() => false)) return;
        }
        throw new Error(`页面 ${timeoutMs / 1000} 秒内没有加载完成：${url}`);
      },
      async screenshot(file, clip) {
        const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      },
      async close() { ws.close(); await close(); },
    };
    await page.setViewport(width, height);
    return page;
  } catch (e) {
    await close();
    throw e;
  }
}

module.exports = { sleep, startStaticServer, findBrowser, launch };
