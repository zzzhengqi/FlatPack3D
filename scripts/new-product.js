#!/usr/bin/env node
// 新建一个产品（一套家具）的骨架：data/<id>/ 下的清单、分析报告、尺寸来源、站点与产品文案、构建脚本、英文译文。
// 生成的是一个能跑通的"示例占位"（一张小桌：顶板 + 两块侧板 + 4 颗螺钉 A），用来确认环境和流程都正常；
// 之后按 skills/manual-to-3d/SKILL.md 的阶段，把每个文件里的示例内容换成真实资料。
// 用法：node scripts/new-product.js <id> [--title=名称] [--no-en] [--force]
//   id 用小写字母、数字和连字符，例如 hemnes-bed。会在 data/<id>/ 下建文件，并新建本机目录 inputs/<id>/（放说明书 PDF）和 inputs/<id>/images/（放商品图），都不入库。
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { root } = require('./lib/products');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3);
const id = args[0];
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  console.error('用法：node scripts/new-product.js <id> [--title=名称] [--no-en] [--force]（id 只用小写字母、数字、连字符）');
  process.exit(1);
}
const title = opt('title') || id;
const en = !process.argv.includes('--no-en');
const dir = path.join(root, 'data', id);
if (fs.existsSync(dir) && !process.argv.includes('--force')) {
  console.error(`data/${id}/ 已存在。要覆盖请加 --force`);
  process.exit(1);
}
const D = `data/${id}`;
const files = {};
const json = (o) => JSON.stringify(o, null, 2) + '\n';

// ---------- 清单：资料来源、报告、站点、构建脚本 ----------
files['manifest.json'] = json({
  schema: 'flatpack3d/manifest@1',
  id,
  title,
  analysis: `${D}/analysis.md`,
  dimensions: `${D}/dimensions.md`,
  sites: { zh: `${D}/site.json`, ...(en ? { en: `${D}/site.en.json` } : {}) },
  build: [`${D}/build/main.js`],
  sources: {
    // 示例占位：换成真实说明书。file 放在 inputs/<id>/ 下（不入库），url 是官方下载地址，pages 是总页数
    manuals: [{ key: 'main', file: `${id}-manual.pdf`, docId: 'EXAMPLE-1', url: `https://example.com/${id}-manual.pdf`, pages: 4 }],
    productPages: [{ url: 'https://example.com/product', used: '示例占位：写明从这一页取了什么（例如整体尺寸）' }],
    images: { dir: `inputs/${id}/images`, from: 'https://example.com/product', note: '商品图只在本机参考，不入库' },
  },
});

// ---------- 分析报告：表格格式要照这个写，scripts/validate.js 按它核对数据 ----------
files['analysis.md'] = `# ${title} 说明书分析

> 示例占位：把这份报告换成真实说明书的分析（见 skills/manual-to-3d/SKILL.md 阶段 2 和 references/report-format.md）。
> 规则：结论只来自资料本身；看不清或需要推断的地方标 **不确定**，或写明"根据图示判断"。

| 简称 | 文件 | 文档号 | 页数 | 来源链接 |
|---|---|---|---|---|
| main | ${id}-manual.pdf | EXAMPLE-1 | 4 | https://example.com/${id}-manual.pdf |

## 1. main：示例小桌

### 对应部件
示例：一张小桌，顶板 + 两块侧板。

### 板件清单（p1）
| 图示 | 数量 | 用途 |
|---|---|---|
| 长板 | 1 | 顶板 |
| 短板 | 2 | 左右侧板 |

### 五金清单（p1）
| 编号 | 数量 | 图示 |
|---|---|---|
| A | 4 | 螺钉 |

### 装配步骤（按页）
| 页 | 步骤 | 内容 | 用到的五金 |
|---|---|---|---|
| p2 | 1 | 顶板和左侧板拼成直角，拧 2 颗 A | A ×2 |
| p3 | 2 | 装右侧板，拧 2 颗 A | A ×2 |

## 2. 看不清或不确定的地方

1. 示例占位：逐条写出看不清的地方，标 **不确定**。
`;

// ---------- 尺寸来源：每个数字标明来源 ----------
const dimZh = `# ${title} 尺寸

> 每个数字标明来源：**资料原文**（说明书或商品页写明的，注明页码或链接）、**读图近似**（按图纸比例量的）、**猜测**。
> 资料里写明的尺寸优先，读图近似其次，猜测最后。

## 已确认尺寸

| 项目 | 数值（cm） | 来源 |
|---|---|---|
| 整体 宽 × 高 × 深 | 40 × 45 × 30 | 资料原文：示例占位（写明商品页链接或说明书页码） |

## 近似值（从说明书图纸推断）

| 项目 | 数值（cm） | 来源 |
|---|---|---|
| 板厚 | 2 | 读图近似：示例占位 |

## 猜测清单

1. 示例占位：螺钉 A 的位置（距前后边各 7）是猜的。
`;
files['dimensions.md'] = dimZh;
if (en) files['dimensions.en.md'] = `# ${title} dimensions

> English translation of dimensions.md. Every number states its source: **stated in the source** (manual page or product page), **measured from drawings**, or **guess**.

## Guess list

1. Placeholder: the positions of screws A (7 from the front and back edges) are a guess.
`;

// ---------- 产品文案 ----------
const product = (lang) => {
  const zh = lang === 'zh';
  return {
    share: {
      title: zh ? `FlatPack3D · ${title} 3D 装配演示` : `FlatPack3D · ${title} 3D assembly guide`,
      description: zh ? `${title} 装配说明书的可交互 3D 分步演示（示例占位，换成真实描述）。` : `Interactive 3D step-by-step assembly for ${title} (placeholder description).`,
      image: `${D}/og-image${zh ? '' : '.en'}.png`,
      imageAlt: zh ? `${title} 的 3D 渲染` : `3D render of ${title}`,
      siteUrl: '',
      shotPiece: 'main',
    },
    about: {
      title: zh ? '哪些是精确的，哪些是近似的' : 'What is exact and what is approximate',
      exact: { title: zh ? '精确' : 'Exact', items: [zh ? '零件、数量、步骤顺序、五金编号：来自说明书（链接见下），由 scripts/validate.js 与分析报告逐项核对。' : 'Parts, quantities, step order and hardware labels: from the instructions (links below), checked against the analysis report by scripts/validate.js.'] },
      approximate: {
        title: zh ? '近似' : 'Approximate',
        intro: zh ? `下面每一条取自 ${D}/dimensions.md 的猜测清单。` : `Each item below is taken from the guess list in ${D}/dimensions.en.md.`,
        source: zh ? `${D}/dimensions.md` : `${D}/dimensions.en.md`,
        heading: zh ? '## 猜测清单' : '## Guess list',
      },
      notes: [],
      // 示例占位：写明与厂家无关、未经认可，以及商标归属；trademarks 里的每个名字都要在 disclaimer 里出现
      disclaimer: zh ? '本作品与 Example Co. 无关，未经其认可；Example 是 Example Co. 的商标。' : 'This work is not affiliated with or endorsed by Example Co.; Example is a trademark of Example Co.',
      trademarks: ['Example Co.'],
      links: {
        title: zh ? '官方说明书（PDF）' : 'Official instructions (PDF)',
        source: { label: zh ? '商品页（示例占位）' : 'Product page (placeholder)', url: 'https://example.com/product' },
        items: [{ label: title, article: '', docId: 'EXAMPLE-1', url: `https://example.com/${id}-manual.pdf` }],
      },
    },
    explainers: { title: zh ? '装配要点' : 'Assembly notes', items: [] },
  };
};
files['product.zh.json'] = json(product('zh'));
if (en) files['product.en.json'] = json(product('en'));

// ---------- 站点：件列表 ----------
const languages = [{ code: 'zh', label: '中文', path: './' }, ...(en ? [{ code: 'en', label: 'English', path: 'en/' }] : [])];
files['site.json'] = json({ lang: 'zh-CN', langCode: 'zh', languages, ui: 'data/ui.zh.json', product: `${D}/product.zh.json`, defaultPiece: 'main',
  pieces: [{ key: 'main', label: '示例小桌', url: `${D}/main.json` }] });
if (en) files['site.en.json'] = json({ lang: 'en', langCode: 'en', languages, ui: 'data/ui.en.json', product: `${D}/product.en.json`, defaultPiece: 'main',
  pieces: [{ key: 'main', label: 'Example table', url: `${D}/main.json`, i18n: `${D}/i18n/main.en.json` }] });
if (en) files['i18n/main.en.json'] = json({
  title: 'Example table', scope: 'Placeholder: steps 1–2.',
  overview: { title: 'Check the parts', hint: 'Check the panels and hardware against p1.' },
  partTypes: { top: { name: 'Top panel' }, side: { name: 'Side panel' } },
  parts: { top: 'Top panel', 'side-left': 'Left side panel', 'side-right': 'Right side panel' },
  hardware: { A: { name: 'Screw' } },
  poses: { upright: { label: 'Upright' } },
  steps: {
    1: { title: 'Top + left side', hint: 'Join the top panel and the left side panel at a right angle and drive in 2 screws A.' },
    2: { title: 'Right side', hint: 'Fit the right side panel and drive in 2 screws A.' },
  },
});

// ---------- 构建脚本 ----------
files['build/main.js'] = `#!/usr/bin/env node
// 生成 ${D}/main.json。示例占位：一张小桌（顶板 + 两块侧板 + 4 颗螺钉 A）。
// 零件、五金、页码取自 ${D}/analysis.md；尺寸取自 ${D}/dimensions.md（每个数字的来源写在那里）。
// 用法：node ${D}/build/main.js（一般用 node scripts/build.js ${id}）
'use strict';
const fs = require('fs');
const path = require('path');

const r2 = (n) => Math.round(n * 100) / 100;
const vec = (x, y, z) => [r2(x), r2(y), r2(z)];
// 尺寸（cm），来源见 dimensions.md
const W = 40, H = 45, D = 30;   // 资料原文（示例占位）
const T = 2;                     // 板厚，读图近似（示例占位）
const L = 4;                     // 螺钉长度，猜测

const parts = [
  { id: 'top', type: 'top', name: '顶板', size: vec(W, T, D), position: vec(0, H / 2 - T / 2, 0) },
  { id: 'side-left', type: 'side', name: '左侧板', size: vec(T, H - T, D), position: vec(-(W / 2 - T / 2), -T / 2, 0) },
  { id: 'side-right', type: 'side', name: '右侧板', size: vec(T, H - T, D), position: vec(W / 2 - T / 2, -T / 2, 0) },
];
// 螺钉从顶板上表面打进侧板端部，钉头与上表面齐平（位置是猜测）
const screws = (sx) => [-7, 7].map((z) => ({ position: vec(sx * (W / 2 - T / 2), H / 2 - L / 2, z), axis: 'y' }));
const hw = (hid, placements) => ({ id: hid, count: placements.length, placements });

const data = {
  schema: 'flatpack3d/assembly@1',
  id: '${id}-main',
  title: '示例小桌',
  scope: '示例占位：说明书第 1–2 步。',
  source: { manual: '${id}-manual.pdf', docId: 'EXAMPLE-1', analysis: '${D}/analysis.md', dimensions: '${D}/dimensions.md', reportSection: '## 1.' },
  manualPages: { dir: 'renders/${id}/main', pattern: 'p{NN}.png', count: 4 },
  staging: { origin: [-70, 40], width: 140 },
  explodeScale: 0.6,
  meta: { overall: [W, H, D], approximate: ['板厚 2：读图近似（示例占位）', '螺钉位置：猜测'] },
  defaultPose: 'upright',
  poses: { pivotLocal: vec(0, -H / 2, 0), pivotWorld: vec(0, 0, 0), upright: { tilt: 0, label: '立放' } },
  partTypes: {
    top: { name: '顶板', quantity: 1, report: '长板' },
    side: { name: '侧板', quantity: 2, report: '短板' },
  },
  parts,
  hardware: [{ id: 'A', name: '螺钉', quantity: 4, kind: 'screw', shape: { type: 'screw', diameter: 0.5, length: L, headDiameter: 1.0 } }],
  overview: { n: 0, pages: [1], title: '清点零件', hint: '对照 p1 清点板件和五金。' },
  steps: [
    { n: 1, pages: [2], title: '顶板 + 左侧板', parts: ['top', 'side-left'], tools: [], hint: '顶板与左侧板拼成直角，拧入 2 颗螺钉 A。', hardware: [hw('A', screws(-1))] },
    { n: 2, pages: [3], title: '右侧板', parts: ['side-right'], approach: [1, 0, 0], tools: [], hint: '装右侧板，拧入 2 颗螺钉 A。', hardware: [hw('A', screws(1))] },
  ],
};
const out = path.join(__dirname, '..', 'main.json');
fs.writeFileSync(out, JSON.stringify(data, null, 2) + '\\n');
console.log(\`已写入 \${path.relative(process.cwd(), out)}：\${parts.length} 块零件，\${data.steps.length} 步\`);
`;

for (const [f, text] of Object.entries(files)) {
  const p = path.join(dir, f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}
for (const d of [`inputs/${id}/images`]) fs.mkdirSync(path.join(root, d), { recursive: true });
console.log(`已建 data/${id}/（${Object.keys(files).length} 个文件）和本机目录 inputs/${id}/（PDF）、inputs/${id}/images/（商品图）`);
// 生成数据、更新产品索引
const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'build.js'), id], { cwd: root, stdio: 'inherit' });
if (r.status) process.exit(r.status);
// 分享图（校验要求存在）：需要本机 Chrome / Edge；失败时提示手动生成
const og = spawnSync(process.execPath, [path.join(root, 'scripts', 'make-og-image.js'), id], { cwd: root, stdio: 'inherit' });
if (og.status) console.log(`分享图没有生成（需要本机 Chrome 或 Edge）。之后运行 node scripts/make-og-image.js ${id}`);
console.log(`
下一步：
  node scripts/flatpack.js validate --product=${id}   校验（示例占位应全部通过）
  node scripts/flatpack.js serve 8137 --open         打开页面，地址后加 ?product=${id}
然后按 skills/manual-to-3d/SKILL.md 从阶段 1 开始，把示例内容换成真实资料。`);
