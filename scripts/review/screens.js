#!/usr/bin/env node
// 示例截图：隐藏说明书面板（截图里不会出现说明书页面图），播到指定步骤的动作中途，截整个页面。
// 用虚拟时钟，截图时间点确定。
// 用法：node scripts/review/screens.js <输出目录> <产品 id> <件[:路线]:步骤> ... [--width=1280 --height=800 --lang=en]
//   例：node scripts/review/screens.js skills/manual-to-3d/examples/kallax/screens kallax body:a:18 body:a:27 door:left:6 set room:a
//   只写件名（set、room）就截这一件的初始画面。
'use strict';
const fs = require('fs');
const path = require('path');
const vt = require('./vtime');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const [outDir, product, ...shots] = args;
const W = Number(opt('width', 1280)), H = Number(opt('height', 800)), lang = opt('lang', '');
const FRAME = 1000 / 30;

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const shot of shots) {
    const [piece, a, b] = shot.split(':');
    const step = b !== undefined ? Number(b) : a !== undefined && /^\d+$/.test(a) ? Number(a) : null;
    const variant = b !== undefined ? a : a !== undefined && !/^\d+$/.test(a) ? a : null;
    const q = new URLSearchParams({ product, piece, ...(variant ? { variant } : {}), ...(lang ? { lang } : {}) });
    const { page, close } = await vt.open(vt.root, { width: W, height: H, query: q.toString() });
    try {
      await page.evaluate("document.getElementById('toggleManual').click()");
      await vt.advance(page, 200, FRAME);
      if (step !== null) {
        const k = await page.evaluate(`window.__flatpack.view.seq.findIndex((s) => s.n === ${step}) + 1`);
        if (!k) throw new Error(`${shot}：没有第 ${step} 步`);
        await page.evaluate(`window.__flatpack.go(${k - 1}, false)`);
        await vt.advance(page, 100, FRAME);
        await vt.playStep(page, k, FRAME);
        const cyc = JSON.parse(await page.evaluate('JSON.stringify(window.__flatpack.view.cycle || null)'));
        const wait = cyc ? cyc.pause + cyc.parts.slice(0, -1).reduce((x, y) => x + y, 0) + cyc.parts[cyc.parts.length - 1] * 0.55 : 900;
        await vt.advance(page, wait, FRAME);
      } else await vt.advance(page, 1200, FRAME);
      const file = path.join(outDir, `${shot.replace(/:/g, '-')}${lang ? `.${lang}` : ''}.png`);
      await page.screenshot(file, { x: 0, y: 0, width: W, height: H });
      console.log(`已截 ${path.relative(process.cwd(), file)}`);
      if (page.consoleErrors.length) console.log('页面报错：', page.consoleErrors.slice(0, 3));
    } finally { await close(); }
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
