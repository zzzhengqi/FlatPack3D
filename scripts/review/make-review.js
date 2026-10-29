#!/usr/bin/env node
// 视觉复查对照图：每个装配件（不含全套、Room）每一步一行，左边说明书该步的放大圆圈（没有圆圈就是整步的图），
// 右边 3D 放大圆圈在动画中途（本步没有圆圈就是主画面）。输出 exports/review/<产品>/<件>[-路线].png（exports/ 不入库）。
// 前提：已用 python scripts/render-pages.py <产品> 渲染了说明书页面图；本机有 Python + opencv-python + pillow。
// 用法：node scripts/review/make-review.js <产品 id> [件[:路线] ...] [--all-variants]
//   例：node scripts/review/make-review.js kallax                 每个件只出默认路线
//       node scripts/review/make-review.js kallax door:right body:b
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { root, readJson, getProduct } = require('../lib/products');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const prod = getProduct(args[0]);
const site = readJson(prod.sites.zh || Object.values(prod.sites)[0]);
const tmp = path.join(root, 'exports', 'review', prod.id, '_work');
const outDir = path.join(root, 'exports', 'review', prod.id);
const py = process.platform === 'win32' ? 'python' : 'python3';
const run = (cmd, a) => { const r = spawnSync(cmd, a, { cwd: root, stdio: 'inherit' }); if (r.status) process.exit(r.status); };

// 要出图的件和路线
const jobs = [];
const wanted = args.slice(1).map((x) => x.split(':'));
for (const piece of site.pieces) {
  const data = readJson(piece.url);
  if (!data.steps) continue; // 全套、Room 没有步骤
  const variants = data.variants ? Object.keys(data.variants) : [null];
  const def = variants.find((v) => v && data.variants[v].default) || variants[0];
  const pick = wanted.length ? wanted.filter(([k]) => k === piece.key).map(([, v]) => v || def) : process.argv.includes('--all-variants') ? variants : [def];
  for (const v of pick) jobs.push({ piece, data, v });
}
if (!jobs.length) { console.error('没有要出图的件。件名：' + site.pieces.map((x) => x.key).join('、')); process.exit(1); }
for (const { piece, data, v } of jobs) {
  const key = `${piece.key}${v ? `-${v}` : ''}`;
  const title = `${data.title}${v ? `（${data.variants[v].label}）` : ''}`;
  console.log(`== ${key}：${title}`);
  run(py, [path.join(__dirname, 'manual_circles.py'), root, prod.id, piece.key, v || '-', tmp]);
  run(process.execPath, [path.join(__dirname, 'capture-circles.js'), tmp, prod.id, piece.key, ...(v ? [v] : [])]);
  fs.mkdirSync(outDir, { recursive: true });
  run(py, [path.join(__dirname, 'make_sheet.py'), tmp, tmp, path.join(outDir, `${key}.png`), key, title]);
}
console.log(`对照图在 ${path.relative(process.cwd(), outDir)}`);
