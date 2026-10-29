#!/usr/bin/env node
// 对照图用的 3D 截图：每一步播完第一遍后，在循环里"最后一个动作做到一半"时截放大圆圈；没有圆圈的步骤截主画面。
// 用虚拟时钟，截图时间点确定。
// 用法：node scripts/review/capture-circles.js <输出目录> <产品 id> <piece> [variant]
// 输出 <输出目录>/<piece>[-variant]/stepNN-c0.png …，以及 index.json。一般由 scripts/review/make-review.js 调用。
'use strict';
const fs = require('fs');
const path = require('path');
const vt = require('./vtime');

const [outDir, product, piece, variant] = process.argv.slice(2);
const FRAME = 1000 / 30;
(async () => {
  const dir = path.join(outDir, `${piece}${variant ? `-${variant}` : ''}`);
  fs.mkdirSync(dir, { recursive: true });
  const { page, close } = await vt.open(vt.root, { width: 1280, height: 800, query: `product=${product}&piece=${piece}${variant ? `&variant=${variant}` : ''}` });
  const index = [];
  try {
    const ns = JSON.parse(await page.evaluate('JSON.stringify(window.__flatpack.view.seq.map((s) => s.n))'));
    for (const [j, n] of ns.entries()) {
      await page.evaluate(`window.__flatpack.go(${j}, false)`);
      await vt.advance(page, 100, FRAME);
      await vt.playStep(page, j + 1, FRAME);
      const cyc = JSON.parse(await page.evaluate('JSON.stringify(window.__flatpack.view.cycle || null)'));
      const wait = cyc ? cyc.pause + cyc.parts.slice(0, -1).reduce((a, b) => a + b, 0) + cyc.parts[cyc.parts.length - 1] * 0.55 : 300;
      await vt.advance(page, wait, FRAME);
      const rects = JSON.parse(await page.evaluate(`JSON.stringify((() => { const s = document.getElementById('stage').getBoundingClientRect();
        const c = window.__flatpack.zoom.shown().map((z) => ({ x: Math.round(s.left + z.cx - z.D / 2), y: Math.round(s.top + z.cy - z.D / 2), width: Math.round(z.D), height: Math.round(z.D) }));
        return c.length ? c : [{ x: Math.round(s.left), y: Math.round(s.top), width: Math.round(s.width), height: Math.round(s.height), main: true }]; })())`));
      const files = [];
      for (const [ci, r] of rects.entries()) {
        const f = `step${String(n).padStart(2, '0')}-${r.main ? 'main' : `c${ci}`}.png`;
        const { main, ...clip } = r;
        await page.screenshot(path.join(dir, f), clip);
        files.push(f);
      }
      index.push({ n, files, circles: rects[0].main ? 0 : rects.length });
      process.stdout.write(`${n} `);
    }
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1));
    if (page.consoleErrors.length) console.log('\n页面报错：', page.consoleErrors.slice(0, 3));
    console.log(`\n已写入 ${dir}`);
  } finally { await close(); }
})().catch((e) => { console.error(e); process.exit(1); });
