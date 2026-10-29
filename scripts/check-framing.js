#!/usr/bin/env node
// 取景检查：对每个件、每个路线、每一步，在几种窗口尺寸下用无头浏览器打开页面并截图，
// 检查当前画面的零件包围盒是否完整在画布内、没有被步骤卡 / 五金卡 / 按钮条挡住、也没有缩得太小。
// 每个产品（data/*/manifest.json）都查；截图存到 renders/framing/<产品>/<语言>/<尺寸>/（不入库）。有任何不合格就以退出码 1 结束。
// 自带本地静态服务，three.js 在 vendor/ 下，不需要外网。
// 用法：node scripts/check-framing.js [--product=kallax] [--lang=en] [--only=door] [--sizes=desktop,mobile]
'use strict';
const fs = require('fs');
const path = require('path');
const { startStaticServer, launch, sleep } = require('./lib/headless');
const { root, listProducts } = require('./lib/products');
const SIZES = {
  desktop: { width: 1280, height: 800 },
  laptop: { width: 1024, height: 680 },
  mobile: { width: 390, height: 844, mobile: true },
};

async function run({ lang = '', only = null, product = null, sizes = Object.keys(SIZES), quiet = false } = {}) {
  const products = listProducts().filter((p) => !product || p.id === product);
  const outRoot = path.join(root, 'renders', 'framing');
  const server = await startStaticServer(root);
  const page = await launch({ width: 1280, height: 800 });
  const failures = [];
  const narrow = []; // 放大圆圈视野不到焦点零件 3 倍的（收紧过的），记下来供复查
  let checked = 0;
  const log = (s) => { if (!quiet) console.log(s); };
  try {
    for (const prod of products) {
    const siteFile = prod.sites[lang || 'zh'];
    if (!siteFile) { log(`  ${prod.id}：没有 ${lang || 'zh'} 站点文件，跳过`); continue; }
    const site = JSON.parse(fs.readFileSync(path.join(root, siteFile), 'utf8'));
    const outDir = path.join(outRoot, prod.id, lang || 'zh');
    const narrowHere = [];
    for (const sizeName of sizes) {
      const size = SIZES[sizeName];
      await page.setViewport(size.width, size.height, !!size.mobile);
      for (const piece of site.pieces) {
        if (only && piece.key !== only) continue;
        const data = JSON.parse(fs.readFileSync(path.join(root, piece.url), 'utf8'));
        const variants = data.variants ? Object.keys(data.variants) : [null];
        const isSet = data.schema && /^flatpack3d\/(set|room)/.test(data.schema);
        for (const v of isSet && !data.variants ? [null] : variants) {
          const q = new URLSearchParams({ product: prod.id, piece: piece.key, ...(v ? { variant: v } : {}), ...(lang ? { lang } : {}) });
          await page.goto(`${server.url}?${q}`);
          // 页面脚本里有 await（读 JSON），load 事件之后才挂上 __flatpack，等它就绪
          for (let k = 0; k < 100 && !(await page.evaluate('!!(window.__flatpack && window.__flatpack.view)')); k++) await sleep(100);
          const steps = isSet ? [null] : [data.overview.n, ...data.steps.filter((s) => !s.variant || s.variant === v).map((s) => s.n)];
          for (const n of steps) {
            if (n !== null) await page.evaluate(`(() => { const f = window.__flatpack; f.go(f.view.seq.findIndex((s) => s.n === ${n}) + 1, false); })()`);
            await page.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))))');
            const rep = await page.evaluate('window.__flatpack.framingReport()');
            const name = `${prod.id}/${piece.key}${v ? `-${v}` : ''}${n === null ? '' : `-step${String(n).padStart(2, '0')}`}`;
            const file = path.join(outDir, sizeName, `${name.split('/')[1]}.png`);
            await page.screenshot(file);
            checked++;
            if (rep.problems.length) failures.push({ size: sizeName, name, problems: rep.problems, file });
            for (const f of rep.fields || []) if (f < 3) { narrow.push({ size: sizeName, name, field: f }); narrowHere.push({ size: sizeName, name, field: f }); }
          }
          log(`  ${sizeName} ${prod.id} ${piece.key}${v ? ` [${v}]` : ''}：${steps.length} 张`);
        }
      }
    }
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'narrow-fields.json'), JSON.stringify(narrowHere, null, 1));
    }
    if (page.consoleErrors.length) failures.push({ size: '-', name: '页面脚本报错', problems: [...new Set(page.consoleErrors)].slice(0, 5) });
  } finally {
    await page.close();
    await server.close();
  }
  return { checked, failures, outDir: outRoot, products: products.map((p) => p.id) };
}

module.exports = { run, SIZES };

if (require.main === module) {
  const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
  run({ lang: arg('lang') || '', only: arg('only') || null, product: arg('product') || null, sizes: arg('sizes') ? arg('sizes').split(',') : Object.keys(SIZES) })
    .then(({ checked, failures, outDir }) => {
      console.log(`\n取景检查：${checked} 张截图（${path.relative(process.cwd(), outDir)}）`);
      if (!failures.length) { console.log('✔ 全部合格'); return; }
      console.log(`✘ ${failures.length} 张不合格：`);
      for (const f of failures) console.log(`  - [${f.size}] ${f.name}：${f.problems.join('；')}`);
      process.exit(1);
    })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
