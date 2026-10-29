// 虚拟时钟：页面里的 performance.now 和 requestAnimationFrame 改由脚本推进，截图时间点就是确定的，
// 不受机器快慢、同时跑几个浏览器的影响。对照图和复查视频都用它。
'use strict';
const path = require('path');
const { startStaticServer, launch } = require('../lib/headless');

// 页面加载前注入：__vtStart() 之后时间只在 __vtTick(ms) 时前进，并在那时执行一帧
const INJECT = `(() => {
  let now = 0, on = false;
  const raf = [];
  const realNow = performance.now.bind(performance);
  const realRaf = window.requestAnimationFrame.bind(window);
  performance.now = () => (on ? now : realNow());
  window.requestAnimationFrame = (cb) => { if (!on) return realRaf(cb); raf.push(cb); return raf.length; };
  window.__vtStart = () => { now = realNow(); on = true; };
  window.__vtTick = (dt) => { now += dt; for (const cb of raf.splice(0)) cb(now); return now; };
})();`;

async function open(root, { width, height, query }) {
  const server = await startStaticServer(root);
  const page = await launch({ width, height });
  await page.setViewport(width, height, false);
  await page.send('Page.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: INJECT });
  await page.goto(`${server.url}?${query}`);
  await page.evaluate('window.__vtStart()');
  // 先走几帧让画面稳定
  for (let k = 0; k < 3; k++) await page.evaluate('window.__vtTick(16)');
  const close = async () => { await page.close(); await server.close(); };
  return { page, server, close };
}

// 推进 ms 毫秒（按 frameMs 一帧），每帧后可选回调（例如截图）
async function advance(page, ms, frameMs, onFrame) {
  const n = Math.max(1, Math.round(ms / frameMs));
  for (let k = 0; k < n; k++) {
    await page.evaluate(`window.__vtTick(${frameMs})`);
    if (onFrame) await onFrame(k);
  }
  return n;
}

// 跳到第 k 步并播放；一边推进时间一边等第一遍动画播完（最长 maxMs）
async function playStep(page, k, frameMs, onFrame, maxMs = 30000) {
  await page.evaluate(`(() => { window.__stepDone = false; const f = window.__flatpack; f.go(${k}); f.view.done.then(() => { window.__stepDone = true; }); })()`);
  let t = 0, frames = 0;
  while (t < maxMs) {
    await page.evaluate(`window.__vtTick(${frameMs})`);
    if (onFrame) await onFrame(frames);
    frames++; t += frameMs;
    if (await page.evaluate('window.__stepDone')) break;
  }
  return frames;
}

module.exports = { open, advance, playStep, root: path.resolve(__dirname, '..', '..') };
