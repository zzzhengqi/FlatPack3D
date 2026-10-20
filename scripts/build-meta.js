#!/usr/bin/env node
// 按 data/site.json → product 文案里的 share 字段，重写 index.html <head> 里的分享信息
// （<title>、description、og:*、twitter:card）。只替换 "meta:start" 与 "meta:end" 两行注释之间的内容。
// 爬虫不执行脚本，所以这些标签必须是静态的；文字本身仍以 JSON 为准。
// 用法：node scripts/build-meta.js
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const site = JSON.parse(fs.readFileSync(path.join(root, 'data/site.json'), 'utf8'));
const share = JSON.parse(fs.readFileSync(path.join(root, site.product), 'utf8')).share;
const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const abs = (u) => (share.siteUrl ? new URL(u, share.siteUrl).href : u);

const block = [
  `<title>${attr(share.title)}</title>`,
  `<meta name="description" content="${attr(share.description)}">`,
  '<meta property="og:type" content="website">',
  `<meta property="og:title" content="${attr(share.title)}">`,
  `<meta property="og:description" content="${attr(share.description)}">`,
  `<meta property="og:image" content="${attr(abs(share.image))}">`,
  `<meta property="og:image:alt" content="${attr(share.imageAlt)}">`,
  ...(share.siteUrl ? [`<meta property="og:url" content="${attr(share.siteUrl)}">`] : []),
  '<meta name="twitter:card" content="summary_large_image">',
].join('\n');

const file = path.join(root, 'index.html');
const html = fs.readFileSync(file, 'utf8');
const re = /(<!-- meta:start[^\n]*-->\n)[\s\S]*?(\n<!-- meta:end -->)/;
if (!re.test(html)) { console.error('index.html 里找不到 meta:start / meta:end 注释'); process.exit(1); }
fs.writeFileSync(file, html.replace(re, `$1${block}$2`));
console.log(`已更新 index.html 的分享信息：${share.title}${share.siteUrl ? '' : '（share.siteUrl 为空，og:image 用相对路径）'}`);
