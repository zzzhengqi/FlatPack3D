#!/usr/bin/env node
// 生成 data/kallax-body.json：KALLAX 5×5 置物架主体，说明书第 1–29 步（第 25 步起分两种上墙方案；不含嵌件）。
// 零件、五金、页码都取自 docs/analysis/kallax-manuals.md；尺寸取自 docs/dimensions.md（板厚等为近似值）。
// 用法：node scripts/build-kallax-body.js
'use strict';
const fs = require('fs');
const path = require('path');

// ---- 尺寸（cm），见 docs/dimensions.md ----
const { r2, vec, W, H, D, COLS, ROWS, TO, TI, INNER, CELL, PITCH, assignFigures } = require('./lib/kallax');

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
  { id: '103693', name: '带葫芦孔的金属片', quantity: 2, kind: 'plate', scope: 'wall', variants: ['a'], shape: { type: 'box', size: [2.2, 3.0, 0.15] } },
  { id: '104321/104322', name: '长沉头内六角螺钉', quantity: 8, kind: 'screw', scope: 'body', shape: { diameter: 0.7, length: SCREW_LEN, headDiameter: 1.4 } },
  { id: '101339', name: '木销', quantity: 80, kind: 'dowel', scope: 'body', shape: { diameter: 0.8, length: 4.0 } },
  { id: '100372', name: '短十字自攻螺钉', quantity: 4, kind: 'screw', scope: 'wall', variants: ['a'], shape: { type: 'screw', diameter: 0.4, length: 1.6, headDiameter: 0.8 } },
  { id: '153550', name: '圆形自粘毡垫', quantity: 12, kind: 'pad', scope: 'body', shape: { diameter: 4.2, length: 0.3 } },
  // 角码：竖边夹在左侧板与墙之间，横边压在顶板上（定位点 = 顶板左端上沿）
  { id: '10091413', name: 'L 形金属角码', quantity: 2, kind: 'bracket', scope: 'wall', variants: ['b'],
    shape: { type: 'plates', plates: [{ size: [0.25, 5, 3], offset: [-0.125, -2.5, 0] }, { size: [6, 0.25, 3], offset: [2.75, 0.125, 0] }] } },
  // 墙固定件：一片贴在外侧板内面、一片贴在背面平面（定位点 = 侧板内面与背面的交线）
  { id: '115753', name: '合页式墙固定件', quantity: 2, kind: 'bracket', scope: 'wall', variants: ['a'],
    shape: { type: 'plates', plates: [{ size: [0.2, 4.5, 3], offset: [0.1, 0, 1.5] }, { size: [3, 4.5, 0.2], offset: [1.5, 0, 0.1] }] } },
  { id: '115754/118673/118225/119509', name: 'L 形转角盖帽', quantity: 2, kind: 'cap', scope: 'wall', variants: ['a'], shape: { type: 'box', size: [3.4, 5.2, 3.4] } },
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
// 动作：只加说明书画了箭头的。page 是箭头所在页，motionNote 写明是哪个箭头（见 docs/spec.md"动作"）
const screwIn = (id, page, tool, o = {}) => ({ type: 'screw', id, tool, page, ...o });
const WRENCH_NOTE = (p) => `动作依据：p${p} 扳手 100001 上的旋转箭头——螺钉边转边拧入，扳手跟着转。`;
const DOWEL = '101339', SCREW = '104321/104322', PAD = '153550';

// ---- 步骤（报告第 1 节步骤表，第 1–24 步）----
const steps = [
  { n: 1, pages: [8], title: '顶板 + 左侧板', pose: 'flat', tools: ['100001'], parts: ['top', 'side-left'],
    hint: '顶板与左侧板拼成直角，用 Z 形扳手拧入 2 颗长螺钉。',
    hardware: [hw(SCREW, screwsAt(-1, 1))], motions: [screwIn(SCREW, 8, '100001')], motionNote: WRENCH_NOTE(8) },
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
    hardware: [hw(SCREW, screwsAt(1, 1))], motions: [screwIn(SCREW, 21, '100001')], motionNote: WRENCH_NOTE(21) },
  { n: 19, pages: [22], title: '最后一排木销', tools: ['锤子'], parts: [], hint: '最后一排隔板的外露端敲入 8 个木销。',
    hardware: [hw(DOWEL, dowelsOnDividerEdge(5, -1))] },
  { n: 20, pages: [23], title: '底板', parts: ['bottom'], approach: [0, -1, 0], hint: '灰色底板翻上来盖住。', hardware: [] },
  { n: 21, pages: [24], title: '底板螺钉', tools: ['100001'], parts: [], hint: '底板两角各拧入 2 颗长螺钉，共 4 颗。',
    hardware: [hw(SCREW, [...screwsAt(-1, -1), ...screwsAt(1, -1)])], motions: [screwIn(SCREW, 24, '100001')], motionNote: WRENCH_NOTE(24) },
  { n: 22, pages: [25], title: '毡垫', parts: [], hint: '在底板灰色面贴 12 个毡垫。', hardware: [hw(PAD, pads())] },
  { n: 23, pages: [26], title: '抬起', pose: 'lift', parts: [], hint: '两人抬起柜体，注意手扶的位置。', hardware: [] },
  { n: 24, pages: [26], title: '竖起', pose: 'upright', parts: [],
    hint: '两人把柜体翻转竖起。接下来按摆放情况选上墙方案（p27）。', hardware: [] },
];

// ---- 上墙固定（报告第 1 节方案 A / B 表格，第 7 节复查）----
const TOP_IN = H / 2 - TO;            // 顶板下表面 87
const SIDE_IN = W / 2 - TO;           // 侧板内表面 87
const BACK = -D / 2;                  // 背面 -19.5
const FIT_Y = TOP_IN - 3;             // 墙固定件高度（猜测）
const wallScrew = (position, dir) => ({ position: vec(...position), dir, frame: 'wall' });
// 方案 A：左上、右上两格各一个墙固定件
const fittings = [-1, 1].map((sx) => ({ position: vec(sx * SIDE_IN, FIT_Y, BACK), dir: [0, 0, 1], ...(sx > 0 ? { mirrorX: true } : {}) }));
const fittingScrews = [-1, 1].flatMap((sx) => [-1.3, 1.3].map((dy) => ({ position: vec(sx * (SIDE_IN + 0.6), FIT_Y + dy, BACK + 2.3), dir: [-sx, 0, 0] })));
const keyPlates = [-1, 1].map((sx) => ({ position: vec(sx * (SIDE_IN - 1.5), FIT_Y, BACK + 0.2 + 0.075), dir: [0, 0, 1] }));
const caps = [-1, 1].map((sx) => ({ position: vec(sx * (SIDE_IN - 1.7), FIT_Y, BACK + 1.7), dir: [0, 0, 1] }));
// 方案 B：两个角码在顶板左端，深度方向与第 1 步那两颗长螺钉对齐
const B_Z = SCREW_Z;
const brackets = B_Z.map((z) => ({ position: vec(-W / 2, H / 2, z), dir: [0, 1, 0], frame: 'wall' }));
const topLeftScrews = B_Z.map((z) => ({ position: vec(-(W / 2 - TO / 2), H / 2 - SCREW_LEN / 2, z), axis: 'y' }));
const refitScrews = B_Z.map((z) => ({ position: vec(-(W / 2 - TO / 2), H / 2 - SCREW_LEN / 2 + 0.25, z), axis: 'y' }));
const WALL_A = { center: vec(0, -H / 2 - 0.4 + 130, BACK - 0.3 - 1), size: [400, 260, 2] };
const WALL_B = { center: vec(-W / 2 - 0.25 - 0.01 - 1, -H / 2 - 0.4 + 130, 0), size: [2, 260, 300] };
const WALL_B_X = -W / 2 - 0.26;

steps.push(
  { n: 25, variant: 'a', pages: [27], title: '装墙固定件', parts: [], tools: ['螺丝刀'],
    motions: [screwIn('100372', 27, '螺丝刀')], motionNote: '动作依据：p27 螺丝刀上的旋转箭头——螺钉边转边拧入。',
    hint: '柜体立在地上、背面贴墙时用这个方案。在左上、右上两格的顶板下沿各装 1 个墙固定件，每个 2 颗螺钉。',
    hardware: [hw('115753', fittings), hw('100372', fittingScrews)] },
  { n: 26, variant: 'a', pages: [28], title: '固定到墙上', tools: ['水平尺'], parts: [],
    hint: '用水平尺校正。墙用螺钉要用圆头，穿过葫芦孔片和固定件的大孔打进墙里。墙用螺钉和螺塞不随包装提供，要按墙体材质另购。',
    hardware: [hw('103693', keyPlates)],
    extras: [{ id: 'wall-screw', placements: [-1, 1].map((sx) => wallScrew([sx * (SIDE_IN - 1.5), FIT_Y, BACK + 0.35 - 2.5], [0, 0, 1])) }] },
  { n: 27, variant: 'a', pages: [29], title: '调整并拧紧', parts: [], tools: ['螺丝刀'], hint: '葫芦孔片可以左右、上下调整位置，调好后拧紧。', hardware: [],
    motions: [
      { type: 'slide', target: { step: 26, id: '103693' }, axis: 'x', amount: 0.5, page: 29 },
      { type: 'slide', target: { step: 26, id: '103693' }, axis: 'y', amount: 0.5, page: 29 },
      { type: 'tighten', target: { step: 26, extra: 'wall-screw' }, tool: '螺丝刀', page: 29 },
    ],
    // p29 的放大圆圈引线指向右上角那一格
    zoomFocus: { index: 1, page: 29 },
    motionNote: '动作依据：p29 放大圆圈里葫芦孔片上方的左右双向箭头、左侧的上下双向箭头，先左右、再上下调整；再按螺丝刀上的旋转箭头拧紧。' },
  { n: 28, variant: 'a', pages: [30], title: '盖帽', parts: [], hint: '盖上 2 个转角盖帽。', hardware: [hw('115754/118673/118225/119509', caps)],
    motions: [{ type: 'push', id: '115754/118673/118225/119509', page: 30 }], motionNote: '动作依据：p30 放大圆圈里盖帽旁边的直箭头——把盖帽推到固定件上。' },

  { n: 25, variant: 'b', pages: [31], title: '放角码、划线', parts: [],
    hint: '把 2 个角码放在顶板左端，孔对准顶板上的螺钉孔，用铅笔在墙上划出角码的位置。',
    tools: ['铅笔'], hardware: [hw('10091413', brackets)],
    marks: B_Z.map((z) => ({ position: vec(WALL_B_X - 0.03, H / 2, z), size: [0.06, 0.15, 4], frame: 'wall' })) },
  { n: 26, variant: 'b', pages: [32], title: '角码固定到墙上', pose: 'awayB', parts: [],
    hint: '角码用圆头墙用螺钉固定到墙上的划线处。墙用螺钉和螺塞不随包装提供，要按墙体材质另购。',
    tools: ['螺丝刀'], motions: [{ type: 'screw', extra: 'wall-screw', tool: '螺丝刀', page: 32 }],
    motionNote: '动作依据：p32 螺丝刀上的旋转箭头——墙用螺钉边转边拧入。p32 的整机图里柜体与左边的墙分开。',
    hardware: [], extras: [{ id: 'wall-screw', placements: B_Z.map((z) => wallScrew([-W / 2 - 2.5, H / 2 - 3, z], [1, 0, 0])) }] },
  { n: 27, variant: 'b', pages: [33], title: '拧出 2 颗长螺钉', tools: ['100001'], parts: [],
    hint: '用 Z 形扳手从顶板左端拧出 2 颗长螺钉（第 1 步装的那两颗）。',
    hardware: [{ id: SCREW, count: 2, action: 'remove', placements: topLeftScrews }],
    motions: [{ type: 'unscrew', id: SCREW, tool: '100001', page: 33 }],
    motionNote: '动作依据：p33 扳手上的旋转箭头（方向与 p35 拧入时相反）和两个向上的箭头——螺钉边转边退出。' },
  { n: 28, variant: 'b', pages: [34], title: '推到角码下', pose: 'upright', parts: [], hint: '把柜体推向墙，让角码卡在顶板上。', hardware: [] },
  { n: 29, variant: 'b', pages: [35], title: '拧回螺钉', tools: ['100001'], parts: [], hint: '把 2 颗长螺钉穿过角码拧回顶板。', hardware: [hw(SCREW, refitScrews)],
    motions: [screwIn(SCREW, 35, '100001')], motionNote: WRENCH_NOTE(35) },
);
// （steps 在下方补上上墙步骤后统一处理）

for (const s of steps) { s.tools = s.tools || []; s.hardware = s.hardware || []; }
assignFigures(steps);

const data = {
  schema: 'flatpack3d/assembly@1',
  id: 'kallax-body',
  title: 'KALLAX 置物架主体（5×5）',
  scope: '说明书第 1–29 步：框体组装、竖起和上墙固定（两种方案）。不含嵌件。',
  source: {
    manual: 'kallax-shelving-unit-white__AA-2334148-2-100.pdf',
    docId: 'AA-2334148-2',
    analysis: 'docs/analysis/kallax-manuals.md',
    dimensions: 'docs/dimensions.md',
    reportSection: '## 1.',
  },
  manualPages: { dir: 'renders/shelf', pattern: 'p{NN}.png', count: 36 },
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
    awayB: { tilt: 0, shift: [25, 0, 0], label: '竖立，离开墙面' },
  },
  variantTitle: '上墙方案',
  variants: {
    a: { label: '墙固定件', note: '方案 A：墙固定件 115753，柜体立在地上、背面贴墙（p27–p30）', report: '方案 A', default: true },
    b: { label: 'L 形角码', note: '方案 B：L 形角码 10091413，按图判断为左侧板贴墙（p31–p35）', report: '方案 B' },
  },
  // 第 25 步起显示墙；墙的位置按方案不同（装配坐标，柜体竖立后）
  room: { fromStep: 25, walls: { a: WALL_A, b: WALL_B } },
  // 不随包装提供、说明书要求另购的东西（不计入五金清单）
  extras: [{ id: 'wall-screw', name: '墙用螺钉（不含）', note: '不随包装提供，按墙体材质另购（说明书 p2）', notIncluded: true, shape: { type: 'screw', diameter: 0.5, length: 5, headDiameter: 1.0 } }],
  partTypes,
  parts,
  hardware,
  overview: { n: 0, pages: [5, 6, 7], title: '清点零件', hint: '对照 p5–p7 清点板件和五金。上墙五金按所选方案只用其中一套。' },
  steps,
};

const out = path.join(__dirname, '..', 'data', 'kallax-body.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data, null, 2) + '\n');
console.log(`已写入 ${path.relative(process.cwd(), out)}：${parts.length} 块零件，${steps.length} 步`);
