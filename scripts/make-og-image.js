#!/usr/bin/env node
// 用无头 Chrome / Edge 给页面截一张 1200×630 的分享图（og:image）。
// 页面带 ?shot=1 时只显示 3D 画面和标题，标题文字取自产品文案的 share 字段；
// 截哪一件看 share.shotPiece（缺省是站点的 defaultPiece），输出到 share.image。
// 脚本自带本地静态服务，three.js 在 vendor/ 下，不需要外网，也不需要另开 http.server。
// 用法：node scripts/make-og-image.js [产品 id]           生成该产品（缺省为默认产品）各语言的分享图
//       node scripts/make-og-image.js --query='<页面参数>' <输出文件>   只生成一张
'use strict';
const fs = require('fs');
const path = require('path');
const { startStaticServer, launch, sleep } = require('./lib/headless');
const { root, readJson: read, getProduct } = require('./lib/products');

const W = 1200, H = 630;
const q = (process.argv.find((a) => a.startsWith('--query=')) || '').slice('--query='.length);
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let jobs;
if (q) jobs = [{ query: `?${q.replace(/^\?/, '')}`, out: path.resolve(root, args[0] || 'og-image.png') }];
else {
  const prod = getProduct(args[0] || null);
  jobs = Object.entries(prod.sites).map(([lang, siteFile]) => {
    const site = read(siteFile), share = read(site.product).share;
    const params = new URLSearchParams({ product: prod.id, piece: share.shotPiece || site.defaultPiece, shot: '1', ...(lang !== 'zh' ? { lang } : {}) });
    return { query: `?${params}`, out: path.resolve(root, share.image) };
  });
}

(async () => {
  const server = await startStaticServer(root);
  const page = await launch({ width: W, height: H });
  try {
    for (const { query, out } of jobs) {
      await page.goto(server.url + query);
      await sleep(1500); // 多渲染几帧
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await page.screenshot(out, { x: 0, y: 0, width: W, height: H });
      console.log(`已生成 ${path.relative(process.cwd(), out)}（${fs.statSync(out).size} 字节）`);
    }
  } finally {
    await page.close();
    await server.close();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
