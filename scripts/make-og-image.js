#!/usr/bin/env node
// 用无头 Chrome / Edge 给页面截一张 1200×630 的分享图（og:image）。
// 页面带 ?shot=1 时只显示 3D 画面和标题，标题文字取自 product 文案的 share 字段。
// 通过 Chrome 调试协议等页面真正渲染好（three.js 从 CDN 加载）再截图；需要 Node 22+（自带 WebSocket）。
// 先在项目根目录启动本地服务（python -m http.server 8137），再运行：
//   node scripts/make-og-image.js [页面地址] [输出文件]
// 默认：http://localhost:8137/?piece=set&shot=1 → share.image（og-image.png）
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const site = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8'));
const share = JSON.parse(fs.readFileSync(path.join(root, site.product), 'utf8')).share;
const url = process.argv[2] || 'http://localhost:8137/?piece=set&shot=1';
const out = path.resolve(root, process.argv[3] || share.image);
const W = 1200, H = 630, PORT = 9333;

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const browserPath = candidates.find((p) => fs.existsSync(p));
if (!browserPath) { console.error('找不到 Chrome 或 Edge，可用环境变量 CHROME_PATH 指定'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 用临时配置目录，不碰日常使用的浏览器配置
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'flatpack3d-og-'));
  const proc = spawn(browserPath, [
    '--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--user-data-dir=${profile}`, `--window-size=${W},${H}`, `--remote-debugging-port=${PORT}`, 'about:blank',
  ], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 50 && !target; i++) {
      await sleep(200);
      try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* 还没起来 */ }
    }
    if (!target) throw new Error('浏览器调试端口没有响应');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url });
    // 等引擎加载完成（window.__flatpack 出现）并多渲染几帧
    let ready = false;
    for (let i = 0; i < 150 && !ready; i++) { await sleep(200); ready = await evaluate('!!window.__flatpack && !!window.__flatpack.view'); }
    if (!ready) throw new Error(`页面 30 秒内没有加载完成：${url}`);
    await sleep(1500);
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    ws.close();
  } finally {
    proc.kill();
    await sleep(300);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
  console.log(`已生成 ${path.relative(process.cwd(), out)}（${fs.statSync(out).size} 字节）`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
