#!/usr/bin/env node
// 生成各语言页面的分享信息（<title>、description、og:*、twitter:card、hreflang 互链）：
//   index.html      中文页：只替换 "meta:start" 与 "meta:end" 两行注释之间的内容
//   en/index.html   英文页：由 index.html 复制，换成英文分享信息，加 <base href="../">（数据和脚本都从根目录读）
//                   和 <meta name="flatpack-lang" content="en">（页面据此读产品的英文站点文件）
// 文字取自默认产品（data/products.json 的 default）各语言站点文件指向的产品文案。
// 爬虫不执行脚本，所以这些标签必须是静态的；文字本身仍以各语言的产品文案 JSON 为准。
// 用法：node scripts/build-meta.js          写文件
//       node scripts/build-meta.js --check  只比较，不一致时退出码为 1（validate.js 会调用）
'use strict';
const fs = require('fs');
const path = require('path');
const { root, readJson: read, getProduct } = require('./lib/products');

const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const RE = /(<!-- meta:start[^\n]*-->\n)[\s\S]*?(\n<!-- meta:end -->)/;

// 引擎支持的语言页：中文是 index.html，英文是 en/index.html；站点文件取默认产品的
const LANG_PAGES = [{ code: 'zh', page: 'index.html', dir: '' }, { code: 'en', page: 'en/index.html', dir: 'en/' }];
function langs() {
  const p = getProduct(null);
  return LANG_PAGES.filter((l) => p.sites[l.code]).map((l) => ({ ...l, site: p.sites[l.code] }));
}

function metaBlock(lang, all) {
  const share = read(read(lang.site).product).share;
  const abs = (u) => (share.siteUrl ? new URL(u, share.siteUrl).href : u);
  // 英文页有 <base href="../">，所以两页的相对链接都按根目录写
  const alt = all.map((l) => {
    const rel = l.dir || './';
    return `<link rel="alternate" hreflang="${l.code === 'zh' ? 'zh-CN' : l.code}" href="${share.siteUrl ? new URL(l.dir, share.siteUrl).href : rel}">`;
  });
  return [
    `<title>${attr(share.title)}</title>`,
    `<meta name="description" content="${attr(share.description)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${attr(share.title)}">`,
    `<meta property="og:description" content="${attr(share.description)}">`,
    `<meta property="og:image" content="${attr(abs(share.image))}">`,
    `<meta property="og:image:alt" content="${attr(share.imageAlt)}">`,
    ...(share.siteUrl ? [`<meta property="og:url" content="${attr(new URL(lang.dir, share.siteUrl).href)}">`] : []),
    '<meta name="twitter:card" content="summary_large_image">',
    ...alt,
  ].join('\n');
}

function build() {
  const base = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (!RE.test(base)) throw new Error('index.html 里找不到 meta:start / meta:end 注释');
  const all = langs();
  const zh = all.find((l) => l.code === 'zh'), en = all.find((l) => l.code === 'en');
  if (!zh) throw new Error('默认产品没有中文站点文件（manifest.json 的 sites.zh）');
  const out = {};
  out['index.html'] = base.replace(RE, (m, a, b) => a + metaBlock(zh, all) + b);
  if (!en) return out;
  // 英文页：同一份页面，换分享信息、语言、根路径
  out['en/index.html'] = out['index.html']
    .replace(RE, (m, a, b) => a + metaBlock(en, all) + b)
    .replace('<html lang="zh-CN">', '<html lang="en">')
    .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="../">\n<meta name="flatpack-lang" content="en">\n<!-- 由 scripts/build-meta.js 从 index.html 生成，请勿手改 -->');
  return out;
}

if (require.main === module) {
  const out = build();
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [file, html] of Object.entries(out)) {
    const p = path.join(root, file);
    const cur = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
    if (cur === html) continue;
    if (check) { console.error(`${file} 与文案不一致，请运行 node scripts/build-meta.js`); stale++; continue; }
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, html);
    console.log(`已更新 ${file}`);
  }
  if (check && stale) process.exit(1);
  if (!check) console.log('分享信息已是最新');
}

module.exports = { build };
