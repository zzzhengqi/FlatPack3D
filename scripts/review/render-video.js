#!/usr/bin/env node
// 复查视频：用虚拟时钟逐帧推进页面，每一步完整播放第一遍，再停留 HOLD 毫秒（停留期间放大圆圈里的动作继续循环），
// 每帧截图（JPEG），最后用 Python + OpenCV 合成 mp4（MPEG-4，本机没有 H.264 编码器）。
// 用法：node scripts/review/render-video.js <输出 mp4> <产品 id> <piece> [variant] [--width=1920 --height=1080 --fps=30 --hold=1500]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const vt = require('./vtime');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d);
const [outFile, product, piece, variant] = args;
const W = opt('width', 1920), H = opt('height', 1080), FPS = opt('fps', 30), HOLD = opt('hold', 1500);
const FRAME = 1000 / FPS;

(async () => {
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'flatpack3d-video-'));
  const { page, close } = await vt.open(vt.root, { width: W, height: H, query: `product=${product}&piece=${piece}${variant ? `&variant=${variant}` : ''}` });
  let count = 0;
  const shot = async () => {
    const r = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    fs.writeFileSync(path.join(frames, `f${String(count++).padStart(6, '0')}.jpg`), Buffer.from(r.result.data, 'base64'));
  };
  try {
    const n = await page.evaluate('window.__flatpack.view.seq.length');
    // 开头：清点零件页停留
    await page.evaluate('window.__flatpack.go(0, false)');
    await vt.advance(page, 2000, FRAME, shot);
    for (let k = 1; k <= n; k++) {
      await vt.playStep(page, k, FRAME, shot);
      await vt.advance(page, HOLD, FRAME, shot);
      process.stdout.write(`${k} `);
    }
    if (page.consoleErrors.length) console.log('\n页面报错：', page.consoleErrors.slice(0, 3));
  } finally { await close(); }
  console.log(`\n${count} 帧，${(count / FPS).toFixed(1)} 秒；合成 ${outFile}`);
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  const py = spawnSync('python', [path.join(__dirname, 'frames_to_mp4.py'), frames, path.resolve(outFile), String(FPS)], { stdio: 'inherit' });
  fs.rmSync(frames, { recursive: true, force: true });
  if (py.status) process.exit(py.status);
})().catch((e) => { console.error(e); process.exit(1); });
