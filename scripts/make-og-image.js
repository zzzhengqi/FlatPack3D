#!/usr/bin/env node
// 用无头 Chrome / Edge 给页面截一张 1200×630 的分享图（og:image）。
// 页面带 ?shot=1 时只显示 3D 画面和标题，标题文字取自 product 文案的 share 字段。
// 脚本自带本地静态服务，three.js 在 vendor/ 下，不需要外网，也不需要另开 http.server。
// 用法：node scripts/make-og-image.js [页面查询串] [输出文件]
// 默认：?piece=set&shot=1 → share.image（og-image.png）
'use strict';
const fs = require('fs');
const path = require('path');
const { startStaticServer, launch, sleep } = require('./lib/headless');

const root = path.resolve(__dirname, '..');
const site = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8'));
const share = JSON.parse(fs.readFileSync(path.join(root, site.product), 'utf8')).share;
const query = process.argv[2] || '?piece=set&shot=1';
const out = path.resolve(root, process.argv[3] || share.image);
const W = 1200, H = 630;

(async () => {
  const server = await startStaticServer(root);
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(server.url + query);
    await sleep(1500); // 多渲染几帧
    await page.screenshot(out, { x: 0, y: 0, width: W, height: H });
  } finally {
    await page.close();
    await server.close();
  }
  console.log(`已生成 ${path.relative(process.cwd(), out)}（${fs.statSync(out).size} 字节）`);
})().catch((e) => { console.error(e.message); process.exit(1); });
