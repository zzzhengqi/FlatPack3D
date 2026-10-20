#!/usr/bin/env node
// 生成 data/kallax-body.json：KALLAX 5×5 置物架主体，说明书第 1–24 步（不含上墙固定、不含嵌件）。
// 零件、五金、页码都取自 docs/analysis/kallax-manuals.md；尺寸取自 docs/dimensions.md（板厚等为近似值）。
// 用法：node scripts/build-kallax-body.js
'use strict';
const fs = require('fs');
const path = require('path');

// ---- 尺寸（cm），见 docs/dimensions.md ----
const { r2, vec, W, H, D, COLS, ROWS, TO, TI, INNER, CELL, PITCH } = require('./lib/kallax');

const xDivider = (j) => -INNER / 2 + j * PITCH - TI / 2;      // j = 1..4，从左数
const yShelf = (k) => INNER / 2 - k * PITCH + TI / 2;          // k = 1..4，从上数
const yRow = (r) => INNER / 2 - (r - 1) * PITCH - CELL / 2;    // r = 1..5，从上数
const DOWEL_Z = [-10, 10];              // 隔板每条边 2 个木销的前后位置（猜测）
const SHELF_END_Z = [-15, -5, 5, 15];   // 长层板每端 4 个木销（猜测：32 ÷ 4 块 ÷ 2 端）
const SCREW_Z = [-10, 10];              // 每个角 2 颗长螺钉（猜测）
const SCREW_LEN = 10;

// ---- 零件 ----
const partTypes = {
  side: { name: '侧板', quantity: 2, report: '厚长板，面上有成组孔位' },
  shelf: { name: '长层板', quantity: 4, report: '较薄长板，两端有销孔' },
  bottom: { name: '底板', quantity: 1, report: '长板，表面涂灰' },
  top: { name: '顶板', quantity: 1, report: '长板，白色' },
  divider: { name: '隔板', quantity: 20, report: '小方板' },
};

const parts = [];
parts.push({ id: 'top', type: 'top', name: '顶板', size: vec(W, TO, D), position: vec(0, H / 2 - TO / 2, 0) });
parts.push({ id: 'bottom', type: 'bottom', name: '底板（灰面朝下）', size: vec(W, TO, D), position: vec(0, -(H / 2 - TO / 2), 0), faces: { '-y': 'gray' } });
parts.push({ id: 'side-left', type: 'side', name: '左侧板（第 1 步）', size: vec(TO, INNER, D), position: vec(-(W / 2 - TO / 2), 0, 0) });
parts.push({ id: 'side-right', type: 'side', name: '右侧板（第 17 步）', size: vec(TO, INNER, D), position: vec(W / 2 - TO / 2, 0, 0) });
for (let k = 1; k <= 4; k++) {
  parts.push({ id: `shelf-${k}`, type: 'shelf', name: `长层板 ${k}（从上数）`, size: vec(INNER, TI, D), position: vec(0, yShelf(k), 0) });
}
for (let r = 1; r <= ROWS; r++) {
  for (let j = 1; j <= COLS - 1; j++) {
    parts.push({ id: `divider-r${r}-${j}`, type: 'divider', name: `隔板 第${r}排-${j}`, size: vec(TI, CELL, D), position: vec(xDivider(j), yRow(r), 0) });
  }
}
const rowIds = (r) => [1, 2, 3, 4].map((j) => `divider-r${r}-${j}`);

// ---- 五金目录（报告第 1 节五金清单，含本次不用的上墙五金）----
const hardware = [
  { id: '100001', name: 'Z 形内六角扳手', quantity: 1, kind: 'tool', scope: 'body' },
  { id: '103693', name: '带葫芦孔的金属片', quantity: 2, kind: 'other', scope: 'wall' },
  { id: '104321/104322', name: '长沉头内六角螺钉', quantity: 8, kind: 'screw', scope: 'body', shape: { diameter: 0.7, length: SCREW_LEN, headDiameter: 1.4 } },
  { id: '101339', name: '木销', quantity: 80, kind: 'dowel', scope: 'body', shape: { diameter: 0.8, length: 4.0 } },
  { id: '100372', name: '短十字自攻螺钉', quantity: 4, kind: 'other', scope: 'wall' },
  { id: '153550', name: '圆形自粘毡垫', quantity: 12, kind: 'pad', scope: 'body', shape: { diameter: 4.2, length: 0.3 } },
  { id: '10091413', name: 'L 形金属角码', quantity: 2, kind: 'other', scope: 'wall' },
  { id: '115753', name: '合页式墙固定件', quantity: 2, kind: 'other', scope: 'wall' },
  { id: '115754/118673/118225/119509', name: 'L 形转角盖帽', quantity: 2, kind: 'other', scope: 'wall' },
];

// ---- 五金摆放 ----
const dowelsOnDividerEdge = (r, edge) => // edge: +1 上边，-1 下边
  rowIds(r).flatMap((id, i) => DOWEL_Z.map((z) => ({
    position: vec(xDivider(i + 1), yRow(r) + edge * CELL / 2, z), axis: 'y', attachTo: id,
  })));
const dowelsUnderShelf = (k) => // 长层板下表面，给下一排隔板
  [1, 2, 3, 4].flatMap((j) => DOWEL_Z.map((z) => ({
    position: vec(xDivider(j), yShelf(k) - TI / 2, z), axis: 'y', attachTo: `shelf-${k}`,
  })));
const dowelsShelfEnds = () =>
  [1, 2, 3, 4].flatMap((k) => [-1, 1].flatMap((s) => SHELF_END_Z.map((z) => ({
    position: vec(s * INNER / 2, yShelf(k), z), axis: 'x', attachTo: `shelf-${k}`,
  }))));
// 螺钉从顶/底板外表面打入侧板端部，钉头与外表面齐平
const screwsAt = (xSign, ySign) => SCREW_Z.map((z) => ({
  position: vec(xSign * (W / 2 - TO / 2), ySign * (H / 2 - SCREW_LEN / 2), z), axis: 'y',
}));
// 毡垫：每块侧板和每列隔板正下方各一对（猜测）
const padXs = [-(W / 2 - TO / 2), ...[1, 2, 3, 4].map(xDivider), W / 2 - TO / 2];
const pads = () => padXs.flatMap((x) => [-15, 15].map((z) => ({
  position: vec(x, -H / 2 - 0.15, z), axis: 'y', attachTo: 'bottom',
})));

const hw = (id, placements) => ({ id, count: placements.length, placements });
const DOWEL = '101339', SCREW = '104321/104322', PAD = '153550';

// ---- 步骤（报告第 1 节步骤表，第 1–24 步）----
const steps = [
  { n: 1, pages: [8], title: '顶板 + 左侧板', pose: 'flat', tools: ['100001'], parts: ['top', 'side-left'],
    hint: '顶板与左侧板拼成直角，用 Z 形扳手拧入 2 颗长螺钉。',
    hardware: [hw(SCREW, screwsAt(-1, 1))] },
  { n: 2, pages: [9], title: '第 1 排隔板装木销', tools: ['锤子'], parts: [],
    hint: '第 1 排 4 块隔板，每块一侧边敲入 2 个木销。',
    hardware: [hw(DOWEL, dowelsOnDividerEdge(1, +1))] },
  { n: 3, pages: [10], title: '第 1 排隔板', parts: rowIds(1), hint: '把 4 块隔板插到顶板上。', hardware: [] },
  { n: 4, pages: [11], title: '长层板装木销', tools: ['锤子'], parts: [],
    hint: '4 块长层板两端敲入木销，共 32 个。',
    hardware: [hw(DOWEL, dowelsShelfEnds())] },
  { n: 5, pages: [12], title: '第 1 块长层板', parts: ['shelf-1'], hint: '长层板压到隔板上，并插进左侧板。', hardware: [] },
  { n: 6, pages: [13], title: '第 2 排木销', tools: ['锤子'], parts: [], hint: '在第 1 块层板上为下一排隔板敲入 8 个木销。',
    hardware: [hw(DOWEL, dowelsUnderShelf(1))] },
  { n: 7, pages: [13], title: '第 2 排隔板', parts: rowIds(2), hint: '装第 2 排 4 块隔板。', hardware: [] },
  { n: 8, pages: [14], title: '第 2 块长层板', parts: ['shelf-2'], hint: '第 2 块长层板压到隔板上，插进左侧板。', hardware: [] },
  { n: 9, pages: [14], title: '第 3 排木销', tools: ['锤子'], parts: [], hint: '在第 2 块层板上敲入 8 个木销。',
    hardware: [hw(DOWEL, dowelsUnderShelf(2))] },
  { n: 10, pages: [15], title: '第 3 排隔板', parts: rowIds(3), hint: '装第 3 排 4 块隔板。', hardware: [] },
  { n: 11, pages: [15], title: '第 3 块长层板', parts: ['shelf-3'], hint: '第 3 块长层板压到隔板上，插进左侧板。', hardware: [] },
  { n: 12, pages: [16], title: '第 4 排木销', tools: ['锤子'], parts: [], hint: '在第 3 块层板上敲入 8 个木销。',
    hardware: [hw(DOWEL, dowelsUnderShelf(3))] },
  { n: 13, pages: [17], title: '第 4 排隔板', parts: rowIds(4), hint: '装第 4 排 4 块隔板。', hardware: [] },
  { n: 14, pages: [17], title: '第 4 块长层板', parts: ['shelf-4'], hint: '第 4 块长层板压到隔板上，插进左侧板。', hardware: [] },
  { n: 15, pages: [18], title: '第 5 排木销', tools: ['锤子'], parts: [], hint: '在第 4 块层板上敲入 8 个木销。',
    hardware: [hw(DOWEL, dowelsUnderShelf(4))] },
  { n: 16, pages: [19], title: '第 5 排隔板', parts: rowIds(5), hint: '装最后一排 4 块隔板。', hardware: [] },
  { n: 17, pages: [20], title: '右侧板', parts: ['side-right'], approach: [1, 0, 0],
    hint: '第二块侧板翻过来，套到所有长层板端部，注意孔位方向。', hardware: [] },
  { n: 18, pages: [21], title: '右上角螺钉', tools: ['100001'], parts: [], hint: '右侧板与顶板的角拧入 2 颗长螺钉。',
    hardware: [hw(SCREW, screwsAt(1, 1))] },
  { n: 19, pages: [22], title: '最后一排木销', tools: ['锤子'], parts: [], hint: '最后一排隔板的外露端敲入 8 个木销。',
    hardware: [hw(DOWEL, dowelsOnDividerEdge(5, -1))] },
  { n: 20, pages: [23], title: '底板', parts: ['bottom'], approach: [0, -1, 0], hint: '灰色底板翻上来盖住。', hardware: [] },
  { n: 21, pages: [24], title: '底板螺钉', tools: ['100001'], parts: [], hint: '底板两角各拧入 2 颗长螺钉，共 4 颗。',
    hardware: [hw(SCREW, [...screwsAt(-1, -1), ...screwsAt(1, -1)])] },
  { n: 22, pages: [25], title: '毡垫', parts: [], hint: '在底板灰色面贴 12 个毡垫。', hardware: [hw(PAD, pads())] },
  { n: 23, pages: [26], title: '抬起', pose: 'lift', parts: [], hint: '两人抬起柜体，注意手扶的位置。', hardware: [] },
  { n: 24, pages: [26], title: '竖起', pose: 'upright', parts: [],
    hint: '两人把柜体翻转竖起。下一步是上墙固定（本次不做）。', hardware: [] },
];
for (const s of steps) { s.tools = s.tools || []; }

const data = {
  schema: 'flatpack3d/assembly@1',
  id: 'kallax-body',
  title: 'KALLAX 置物架主体（5×5）',
  scope: '说明书第 1–24 步：框体组装与竖起。不含上墙固定（p27–p35）和任何嵌件。',
  source: {
    manual: 'kallax-shelving-unit-white__AA-2334148-2-100.pdf',
    docId: 'AA-2334148-2',
    analysis: 'docs/analysis/kallax-manuals.md',
    dimensions: 'docs/dimensions.md',
    reportSection: '## 1.',
  },
  manualPages: { dir: 'renders/shelf', pattern: 'p{NN}.png' },
  staging: { origin: [-191, 40], width: 400 },
  explodeScale: 0.6,
  meta: {
    overall: [W, H, D],
    grid: [COLS, ROWS],
    approximate: [
      `外框板厚 ${TO}、内板厚 ${TI}、格子内径 ${r2(CELL)}：由整体尺寸反推的近似值`,
      '顶/底板盖住侧板端面、长层板插在两侧板之间：根据第 1/18/21 步螺钉位置推断',
      '木销、螺钉、毡垫的位置和尺寸：猜测',
    ],
  },
  poses: {
    pivotLocal: vec(0, -H / 2, -D / 2),
    pivotWorld: vec(0, 0.4, -D / 2),
    flat: { tilt: -90, label: '平放（背面朝下）' },
    lift: { tilt: -72, label: '抬起' },
    upright: { tilt: 0, label: '竖立' },
  },
  partTypes,
  parts,
  hardware,
  overview: { n: 0, pages: [5, 6, 7], title: '清点零件', hint: '对照 p5–p7 清点板件和五金。本次只用到框体五金，上墙五金先放一边。' },
  steps,
};

const out = path.join(__dirname, '..', 'data', 'kallax-body.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(`已写入 ${path.relative(process.cwd(), out)}：${parts.length} 块零件，${steps.length} 步`);
