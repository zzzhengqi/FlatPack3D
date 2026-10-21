#!/usr/bin/env node
// 用无头 Chrome / Edge 给页面截一张 1200×630 的分享图（og:image）。
// 页面带 ?shot=1 时只显示 3D 画面和标题，标题文字取自 product 文案的 share 字段。
// 脚本自带本地静态服务，three.js 在 vendor/ 下，不需要外网，也不需要另开 http.server。
// 用法：node scripts/make-og-image.js            生成中英文两张（og-image.png、og-image.en.png）
//       node scripts/make-og-image.js <页面路径> <输出文件>   只生成一张，例如 'en/?piece=set&shot=1' og-image.en.png
'use strict';
const fs = require('fs');
const path = require('path');
const { startStaticServer, launch, sleep } = require('./lib/headless');

const root = path.resolve(__dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const jobs = process.argv[2]
  ? [{ query: process.argv[2], out: path.resolve(root, process.argv[3] || 'og-image.png') }]
  : [['data/site.json', ''], ['data/site.en.json', 'en/']].map(([site, dir]) => ({ query: `${dir}?piece=set&shot=1`, out: path.resolve(root, read(read(site).product).share.image) }));
const W = 1200, H = 630;

(async () => {
  const server = await startStaticServer(root);
  const page = await launch({ width: W, height: H });
  try {
    for (const { query, out } of jobs) {
      await page.goto(server.url + query);
      await sleep(1500); // 多渲染几帧
      await page.screenshot(out, { x: 0, y: 0, width: W, height: H });
      console.log(`已生成 ${path.relative(process.cwd(), out)}（${fs.statSync(out).size} 字节）`);
    }
  } finally {
    await page.close();
    await server.close();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
