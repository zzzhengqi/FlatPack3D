#!/usr/bin/env node
// 生成门嵌件、双抽屉嵌件和"全套"的装配数据：
//   data/kallax/door.json    门嵌件 AA-1009339-8（报告第 2 节），左开 / 右开两条路线
//   data/kallax/drawer.json  双抽屉嵌件 AA-1009361-5（报告第 3 节），2 个抽屉
//   data/kallax/set.json     主体 + 5 门 + 5 双抽屉，排布来自商品图（inputs/kallax/images/，不入库）
// 坐标：嵌件以所在格子的内腔中心为原点（x 右、y 上、z 朝前），格子深度方向与主体一致（z = ±19.5）。
// 尺寸和每一条猜测见 data/kallax/dimensions.md。
// 用法：node data/kallax/build/inserts.js
'use strict';
const fs = require('fs');
const path = require('path');
const K = require('./lib');

const { r2, vec, assignFigures } = K;

// ---- 格子（来自主体）----
const CH = K.CELL / 2;      // 16.76 格子内腔半宽/半高
const ZF = K.D / 2;         // 19.5  格子前沿
const ZB = -K.D / 2;        // -19.5 格子后沿（KALLAX 没有背板）

// ---- 嵌件（近似值，见 data/kallax/dimensions.md 第 13 条起）----
const N = 33;               // 嵌件标称 33×33（商品页）
const N2 = N / 2;
const TF = 0.7;             // 折叠外框板厚
const WS = 4.0;             // 窄边条宽
const TD = 1.6;             // 门板 / 抽屉面板厚
const GAP = 0.3;            // 外框前沿与门板背面之间的缝
const Y0 = -CH;             // 嵌件放在格子底板上
const YC = Y0 + N2;         // 嵌件高度中心 -0.26
const Z_FRONT = ZF;         // 门板 / 抽屉面板前表面与格子前沿齐平（商品图）
const Z_DOOR_BACK = Z_FRONT - TD;          // 17.9
const Z_FRAME_FRONT = Z_DOOR_BACK - GAP;   // 17.6
const DF = Z_FRAME_FRONT - ZB;             // 37.1 外框深
const FZ = (Z_FRAME_FRONT + ZB) / 2;       // 外框中心 z
const X_SIDE_IN = N2 - 2 * TF;             // 15.1 外框侧板内表面

const deg = { L: -90, R: 90 };
// 绕 y 轴转 θ（度）后的向量
const rotY = ([x, y, z], d) => {
  const t = (d * Math.PI) / 180;
  return [x * Math.cos(t) + z * Math.sin(t), y, -x * Math.sin(t) + z * Math.cos(t)];
};
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);

// 折叠外框：一块零件，5 段（+ 抽屉嵌件的 4 条预装滑轨）。unfolded = 第 1 步展开时的样子：所有段站成一排
function foldingFrame(railYs = []) {
  const pieces = [];
  const backZ = -DF / 2 + TF / 2;
  const sideOff = (s) => [s * (N2 - 1.5 * TF), 0, 0];
  const sideUnf = (s) => [s * (X_SIDE_IN + DF / 2), 0, backZ];
  const piece = (id, size, offset, unfolded) => pieces.push({ id, size: vec(...size), offset: vec(...offset), unfolded: { offset: vec(...unfolded.offset), rotation: unfolded.rotation } });

  piece('back', [N - 4 * TF, N, TF], [0, 0, backZ], { offset: [0, 0, backZ], rotation: [0, 0, 0] });
  for (const [s, k] of [[-1, 'L'], [1, 'R']]) {
    const name = s < 0 ? 'left' : 'right';
    piece(`side-${name}`, [TF, N, DF], sideOff(s), { offset: sideUnf(s), rotation: [0, deg[k], 0] });
    piece(`strip-${name}`, [TF, N, WS], [s * (N2 - TF / 2), 0, DF / 2 - WS / 2],
      { offset: [s * (X_SIDE_IN + DF + WS / 2), 0, backZ], rotation: [0, deg[k], 0] });
    railYs.forEach((y, i) => {
      const off = [s * (X_SIDE_IN - 0.325), y - YC, BOX_ZC - FZ];
      const unf = add(sideUnf(s), rotY(sub(off, sideOff(s)), deg[k]));
      piece(`rail-${name}-${i + 1}`, [0.65, 2.5, 35], off, { offset: unf, rotation: [0, deg[k], 0] });
    });
  }
  return { id: 'frame', type: 'frame', name: '折叠外框', size: vec(N, N, DF), position: vec(0, YC, FZ), pieces };
}

// 抽屉盒的 z 范围（双抽屉嵌件）
const BOX_Z0 = -17.8, BOX_Z1 = Z_DOOR_BACK;
const BOX_ZC = (BOX_Z0 + BOX_Z1) / 2;

const host = { cell: vec(K.CELL, K.CELL, K.D), wall: K.TI, note: '一个格子的内腔与四周隔板（主体近似尺寸）' };
const poses = {
  pivotLocal: vec(0, -CH - K.TI, ZB),
  pivotWorld: vec(0, 0, ZB),
  upright: { tilt: 0, label: '装在格子里' },
};
const marks = (sides) => sides.map((s) => ({ position: vec(s * (CH - 2), -CH + 0.03, Z_FRAME_FRONT), size: [3, 0.06, 0.15] }));
const at = (position, dir, attachTo, extra = {}) => ({ position: vec(...position), dir, ...(attachTo ? { attachTo } : {}), ...extra });
const hw = (id, count, placements) => ({ id, count, placements });

// 外框螺钉：从外框内侧打穿侧板和窄边条进格子侧壁，钉头朝里
const SCREW_124386_LEN = 3;
const frameScrew = (s, y, z, headX = s * X_SIDE_IN) => at([headX + s * SCREW_124386_LEN / 2, y, z], [-s, 0, 0], 'frame');

// ======================= 门嵌件 =======================
function buildDoor() {
  const HINGE_Y = [YC - 11, YC + 11];   // 铰链高度（近似）
  const PLATE_Z = 15.0;
  const parts = [
    foldingFrame(),
    { id: 'door', type: 'door', name: '门板', size: vec(N, N, TD), position: vec(0, YC, Z_FRONT - TD / 2), variants: { right: { rotation: [0, 0, 180] } } },
  ];
  // 铰链、铰链螺钉、拉手、防撞垫都装在门板上，坐标按门板的基准姿态（左开）写；右开时门板整体转 180°
  const hinges = HINGE_Y.map((y) => at([-13.6, y, Z_DOOR_BACK - 1.0], [0, 0, -1], 'door'));
  const hingeScrews = HINGE_Y.flatMap((y) => [-1, 1].map((d) => at([-13.6 + d * 0.9, y + d * 1.6, Z_DOOR_BACK - 0.2], [0, 0, -1], 'door')));
  const knob = [at([N2 - 2.5, YC, Z_FRONT + 1.1], [0, 0, 1], 'door')];
  const knobScrew = [at([N2 - 2.5, YC, Z_DOOR_BACK + 1.25], [0, 0, -1], 'door')];
  const pads = [-1, 1].map((d) => at([N2 - 1.0, YC + d * (N2 - 1.0), Z_DOOR_BACK - 0.15], [0, 0, -1], 'door'));

  const branch = (variant, s, pages) => {
    // s：铰链所在侧（-1 左，+1 右）
    const plate = (y) => at([s * (X_SIDE_IN - 0.15), y, PLATE_Z], [-s, 0, 0], 'frame');
    const plateScrews = (y) => [-1.6, 1.6].map((d) => frameScrew(s, y + d, PLATE_Z, s * (X_SIDE_IN - 0.3)));
    const side = s < 0 ? '左' : '右', other = s < 0 ? '右' : '左';
    const st = (n, i, o) => ({ n, variant, pages: [pages[i]], tools: [], parts: [], hardware: [], ...o });
    return [
      st(3, 0, { title: `划线（${side}）`, tools: ['131351', '铅笔'], marks: marks([s]), hint: `定位片卡在格子底板前沿${side}侧，用铅笔划线（定位片别放反）。` }),
      st(4, 1, { title: `划线（${other}）`, tools: ['131351', '铅笔'], marks: marks([-s]), hint: `${other}侧同样划线。` }),
      st(5, 2, { title: '推入外框', install: ['frame'], hint: '把 U 形外框推进格子。' }),
      st(6, 3, { title: `${side}下底座`, hardware: [hw('109221', 1, [plate(HINGE_Y[0])]), hw('124386', 2, plateScrews(HINGE_Y[0]))],
        tools: ['十字螺丝刀'], motions: [{ type: 'screw', id: '124386', tool: '十字螺丝刀', page: pages[3] }],
        motionNote: `动作依据：p${pages[3]} 螺丝刀上的旋转箭头——螺钉边转边拧入。第 7、8 步的图上没有画旋转箭头，那两步不加转动。`,
        hint: `把外框压紧在${side}侧壁上、前沿对齐铅笔线，装下方铰链底座。` }),
      st(7, 4, { title: `${side}上底座`, hardware: [hw('109221', 1, [plate(HINGE_Y[1])]), hw('124386', 2, plateScrews(HINGE_Y[1]))],
        hint: `同样装上方铰链底座。` }),
      st(8, 5, { title: `${other}侧螺钉`, hardware: [hw('124386', 2, HINGE_Y.map((y) => frameScrew(-s, y, Z_FRAME_FRONT - WS / 2)))],
        hint: `${other}侧压紧外框、对齐铅笔线，直接打 2 颗螺钉。` }),
      st(9, 6, { title: '挂门', install: ['door'], approach: [s, 0, 1], hint: '铰链挂到底座上：先钩住，再按下，再拧紧。' }),
      st(10, 7, { title: '拉手', hardware: [hw('106266', 1, knob), hw('100412', 1, knobScrew)], hint: '装拉手，螺钉从门内侧拧入。',
        tools: ['十字螺丝刀'], motions: [{ type: 'screw', id: '100412', tool: '十字螺丝刀', page: pages[7] }],
        motionNote: `动作依据：p${pages[7]} 螺丝刀上的旋转箭头——拉手螺钉边转边拧入。` }),
      st(11, 8, { title: '防撞垫', hardware: [hw('107091', 1, pads)], hint: '门背面开启侧的上、下两角各贴一个防撞垫（1 片 = 2 个垫）。' }),
    ];
  };

  return {
    schema: 'flatpack3d/assembly@1',
    id: 'kallax-door',
    title: 'KALLAX 门嵌件',
    scope: '说明书第 1–11 步（两条路线）。安装在一个格子里；不含上墙固定。',
    source: { manual: 'kallax-insert-with-door-white__AA-1009339-8-100.pdf', docId: 'AA-1009339-8', analysis: 'data/kallax/analysis.md', dimensions: 'data/kallax/dimensions.md', reportSection: '## 2.' },
    manualPages: { dir: 'renders/kallax/door', pattern: 'p{NN}.png', count: 16 },
    staging: { origin: [-110, 150], width: 230 },
    explodeScale: 1.6,
    placeApproach: [0, 1, 0],
    approachDist: 25,
    meta: {
      overall: vec(N, N, Z_FRONT - ZB),
      approximate: ['嵌件外形 33×33 来自商品页；深度、板厚、门厚、铰链位置均为近似值，见 data/kallax/dimensions.md'],
    },
    // 按铰链位置命名：p9 第 9 步铰链在格子左侧外侧板上（p6–p10 路线），p14 第 9 步在右侧隔板上（p11–p15 路线），见报告第 7 节
    variantTitle: '铰链位置',
    variants: {
      left: { label: '铰链在左', note: '铰链装在格子左侧壁上，门向左打开（说明书 p6–p10；依据 p7、p9）', default: true },
      right: { label: '铰链在右', note: '铰链装在格子右侧壁上，门向右打开（说明书 p11–p15；依据 p13、p14）', reportList: '右铰链路线' },
    },
    defaultPose: 'upright',
    poses,
    host,
    partTypes: {
      frame: { name: '折叠外框', quantity: 1, report: '折叠外框' },
      door: { name: '门板', quantity: 1, report: '门板' },
    },
    parts,
    hardware: [
      { id: '100412', name: '机制螺钉（拉手用）', quantity: 1, kind: 'screw', shape: { type: 'screw', diameter: 0.5, length: 2.5, headDiameter: 1.0 } },
      { id: '106266', name: '圆柱拉手', quantity: 1, kind: 'knob', shape: { type: 'cylinder', diameter: 1.6, length: 2.2 } },
      { id: '100344', name: '短十字螺钉（铰链用）', quantity: 4, kind: 'screw', shape: { type: 'screw', diameter: 0.4, length: 1.2, headDiameter: 0.8 } },
      { id: '124386', name: '十字自攻螺钉', quantity: 6, kind: 'screw', shape: { type: 'screw', diameter: 0.4, length: SCREW_124386_LEN, headDiameter: 0.9 } },
      { id: '107091', name: '防撞垫贴片', quantity: 1, kind: 'pad', pieces: 2, unit: '片', shape: { type: 'cylinder', diameter: 1.0, length: 0.3 } },
      { id: '131351', name: 'Z 形金属定位片', quantity: 1, kind: 'tool' },
      { id: '109337', name: '杯状铰链', quantity: 2, kind: 'hinge', shape: { type: 'box', size: [3.0, 4.5, 2.0] } },
      { id: '109221', name: '铰链底座', quantity: 2, kind: 'plate', shape: { type: 'box', size: [0.3, 5.0, 1.8] } },
    ],
    overview: { n: 0, pages: [3], title: '清点零件', hint: '对照 p3 清点五金。门嵌件本身只有折叠外框和门板两件。' },
    steps: [
      { n: 1, pages: [4], title: '折叠外框', tools: [], parts: ['frame'], fold: ['frame'], bench: [-60, 0, 80], hardware: [],
        hint: '展开折叠外框，沿折缝折成 U 形，两端窄边条折到侧板外侧。' },
      { n: 2, pages: [5], title: '装铰链', parts: ['door'], bench: [55, 0, 80],
        hardware: [hw('109337', 2, hinges), hw('100344', 4, hingeScrews)], hint: '两个铰链装到门板上，每个 2 颗螺钉。之后按铰链装在哪一侧分成两条路线。',
        tools: ['十字螺丝刀'], motions: [{ type: 'screw', id: '100344', tool: '十字螺丝刀', page: 5 }],
        motionNote: '动作依据：p5 螺丝刀上的旋转箭头——铰链螺钉边转边拧入。' },
      ...branch('left', -1, [6, 6, 7, 7, 8, 8, 9, 9, 10]),
      ...branch('right', 1, [11, 12, 12, 13, 13, 14, 14, 15, 15]),
    ],
  };
}

// ======================= 双抽屉嵌件 =======================
function buildDrawer() {
  const DRAWERS = 2;
  const FRONT_H = (N - GAP) / 2;                       // 16.35
  const BOX_W = 2 * (X_SIDE_IN - 1.3);                // 27.6：两侧各让出两条滑轨 0.65 + 0.65
  const BOX_H = 13;
  const TS = 1.2;                                      // 抽屉侧板 / 背板厚
  const TB = 0.3;                                      // 抽屉底板厚
  const XS = BOX_W / 2 - TS / 2;                       // 侧板中心 x
  const fronts = [Y0 + N - FRONT_H / 2, Y0 + FRONT_H / 2]; // 1 = 上，2 = 下
  const boxBottom = (d) => fronts[d - 1] - FRONT_H / 2 + 1.0;
  const boxZ = (BOX_Z0 + BOX_Z1) / 2, boxD = BOX_Z1 - BOX_Z0;

  const parts = [foldingFrame([1, 2].map((d) => boxBottom(d) + 1.25))];
  const ids = { front: [], sides: [], bottom: [], back: [] };
  for (let d = 1; d <= DRAWERS; d++) {
    const yb = boxBottom(d);
    const p = (id, type, name, size, pos) => { parts.push({ id: `drawer${d}-${id}`, type, name: `抽屉${d}${name}`, size: vec(...size), position: vec(...pos) }); return `drawer${d}-${id}`; };
    ids.front.push(p('front', 'front', '面板', [N, FRONT_H, TD], [0, fronts[d - 1], Z_FRONT - TD / 2]));
    ids.sides.push(p('side-left', 'side', '左侧板', [TS, BOX_H, boxD], [-XS, yb + BOX_H / 2, boxZ]));
    ids.sides.push(p('side-right', 'side', '右侧板', [TS, BOX_H, boxD], [XS, yb + BOX_H / 2, boxZ]));
    ids.bottom.push(p('bottom', 'bottom', '底板', [BOX_W - 2 * TS, TB, boxD], [0, yb + 1.0 + TB / 2, boxZ]));
    ids.back.push(p('back', 'back', '背板', [BOX_W - 2 * TS, BOX_H - 1.3, TS], [0, yb + 1.3 + (BOX_H - 1.3) / 2, BOX_Z0 + TS / 2]));
  }
  const perDrawer = (fn) => [1, 2].flatMap((d) => fn(d, boxBottom(d) + BOX_H / 2, boxBottom(d), fronts[d - 1]));
  const sides2 = [[-1, 'left'], [1, 'right']];

  const bolts = perDrawer((d, yc) => sides2.map(([s]) => at([s * XS, yc + 3, Z_DOOR_BACK - 1.75], [0, 0, 1], `drawer${d}-front`)));
  const dowels = perDrawer((d, yc) => sides2.map(([s]) => at([s * XS, yc - 3, Z_DOOR_BACK], [0, 0, 1], `drawer${d}-front`)));
  const cams = perDrawer((d, yc) => sides2.map(([s, n]) => at([s * XS, yc + 3, Z_DOOR_BACK - 1.75], [-s, 0, 0], `drawer${d}-side-${n}`)));
  const nails = perDrawer((d, yc) => sides2.map(([s, n]) => at([s * (BOX_W / 2 - 1.5), yc + 1, BOX_Z0 + TS / 2], [s, 0, 0], `drawer${d}-side-${n}`)));
  const rails = perDrawer((d, yc, yb) => sides2.map(([s, n]) => at([s * (BOX_W / 2 + 0.325), yb + 1.25, boxZ], [s, 0, 0], `drawer${d}-side-${n}`, { member: s < 0 ? '123801' : '123802' })));
  const railScrews = perDrawer((d, yc, yb) => sides2.flatMap(([s, n]) => [-10, 10].map((z) => at([s * (BOX_W / 2 + 0.65 - 0.75), yb + 1.25, z], [s, 0, 0], `drawer${d}-side-${n}`))));
  const knobs = perDrawer((d, yc, yb, yf) => [at([0, yf, Z_FRONT + 1.1], [0, 0, 1], `drawer${d}-front`)]);
  const knobScrews = perDrawer((d, yc, yb, yf) => [at([0, yf, Z_DOOR_BACK + 1.25], [0, 0, -1], `drawer${d}-front`)]);
  const pads = perDrawer((d, yc, yb, yf) => sides2.map(([s]) => at([s * (N2 - 1.0), yf + FRONT_H / 2 - 1.5, Z_DOOR_BACK - 0.15], [0, 0, -1], `drawer${d}-front`)));
  const BENCH = [55, 0, 85];
  const st = (n, pages, o) => ({ n, pages, tools: [], parts: [], hardware: [], ...o });

  return {
    schema: 'flatpack3d/assembly@1',
    id: 'kallax-drawer',
    title: 'KALLAX 双抽屉嵌件',
    scope: '说明书第 1–15 步。2 个抽屉；安装在一个格子里；不含上墙固定。',
    source: { manual: 'kallax-insert-with-2-drawers-white__AA-1009361-5-100.pdf', docId: 'AA-1009361-5', analysis: 'data/kallax/analysis.md', dimensions: 'data/kallax/dimensions.md', reportSection: '## 3.' },
    manualPages: { dir: 'renders/kallax/drawers', pattern: 'p{NN}.png', count: 12 },
    staging: { origin: [-110, 150], width: 230 },
    explodeScale: 1.6,
    placeApproach: [0, 1, 0],
    approachDist: 25,
    meta: {
      overall: vec(N, N, Z_FRONT - ZB),
      repeat: { count: DRAWERS, unit: '抽屉' },
      approximate: ['嵌件外形 33×33 来自商品页；抽屉各部分尺寸均为近似值，见 data/kallax/dimensions.md'],
    },
    defaultPose: 'upright',
    poses,
    host,
    partTypes: {
      frame: { name: '折叠外框', quantity: 1, report: '折叠外框' },
      front: { name: '抽屉面板', quantity: DRAWERS, perRepeat: 1, report: '抽屉面板' },
      side: { name: '抽屉侧板', quantity: 2 * DRAWERS, perRepeat: 2, report: '抽屉侧板' },
      bottom: { name: '抽屉底板', quantity: DRAWERS, perRepeat: 1, report: '抽屉底板（薄板）' },
      back: { name: '抽屉背板', quantity: DRAWERS, perRepeat: 1, report: '抽屉背板' },
    },
    parts,
    hardware: [
      { id: '110519', name: '带倒刺圆头钉', quantity: 4, kind: 'screw', drive: 'hammer', shape: { type: 'screw', diameter: 0.5, length: 3.0, headDiameter: 1.0 } },
      { id: '118331', name: '偏心件连接杆', quantity: 4, kind: 'screw', shape: { type: 'screw', diameter: 0.6, length: 3.5, headDiameter: 1.0 } },
      { id: '100412', name: '机制螺钉（拉手用）', quantity: 2, kind: 'screw', shape: { type: 'screw', diameter: 0.5, length: 2.5, headDiameter: 1.0 } },
      { id: '124386', name: '十字自攻螺钉', quantity: 4, kind: 'screw', shape: { type: 'screw', diameter: 0.4, length: SCREW_124386_LEN, headDiameter: 0.9 } },
      { id: '100365', name: '短十字螺钉（滑轨用）', quantity: 8, kind: 'screw', shape: { type: 'screw', diameter: 0.4, length: 1.5, headDiameter: 0.9 } },
      { id: '101345', name: '木销', quantity: 4, kind: 'dowel', shape: { type: 'cylinder', diameter: 0.8, length: 3.0 } },
      { id: '119030', name: '偏心件', quantity: 4, kind: 'cam', shape: { type: 'cylinder', diameter: 1.5, length: 1.0 } },
      { id: '106266', name: '圆柱拉手', quantity: 2, kind: 'knob', shape: { type: 'cylinder', diameter: 1.6, length: 2.2 } },
      { id: '123482', name: 'Z 形金属定位片', quantity: 1, kind: 'tool' },
      { id: '107091', name: '防撞垫贴片', quantity: 2, kind: 'pad', pieces: 2, unit: '片', shape: { type: 'cylinder', diameter: 1.0, length: 0.3 } },
      { id: '123801+123802', name: '抽屉侧滑轨（左+右）', quantity: 2, kind: 'rail', pieces: 2, unit: '套', members: ['123801', '123802'], shape: { type: 'box', size: [0.65, 2.5, 34] } },
    ],
    overview: { n: 0, pages: [3], title: '清点零件', hint: '对照 p3 清点五金。五金按 2 个抽屉配齐：每个抽屉的第 2–9 步各做一遍。' },
    steps: [
      st(1, [4], { title: '折叠外框', parts: ['frame'], fold: ['frame'], bench: [-60, 0, 85], hint: '展开折叠外框（侧板上已装好滑轨），折成 U 形。' }),
      st(2, [5], { title: '面板装连接杆', repeat: DRAWERS, parts: ids.front, bench: BENCH, hardware: [hw('118331', 4, bolts)],
        tools: ['螺丝刀'], motions: [{ type: 'screw', id: '118331', tool: '螺丝刀', page: 5 }], motionNote: '动作依据：p5 螺丝刀上的旋转箭头——连接杆边转边拧入。',
        hint: '抽屉面板内面朝上平放，拧入 2 根连接杆。两个抽屉各做一次。' }),
      st(3, [5], { title: '插侧板', repeat: DRAWERS, parts: ids.sides, bench: BENCH, approach: [0, 0, -1], hardware: [hw('101345', 4, dowels)],
        hint: '敲入 2 个木销，把两块侧板竖着插到面板上。' }),
      st(4, [6], { title: '偏心件', repeat: DRAWERS, hardware: [hw('119030', 4, cams)], hint: '侧板孔里装偏心件，用一字螺丝刀转紧。',
        tools: ['一字螺丝刀'], motions: [{ type: 'turn', id: '119030', tool: '一字螺丝刀', angle: 180, page: 6 }],
        motionNote: '动作依据：p6 右侧放大圆圈里螺丝刀上的弯箭头——偏心件原地转紧（转角说明书没写，取半圈）。' }),
      st(5, [6], { title: '底板', repeat: DRAWERS, parts: ids.bottom, bench: BENCH, approach: [0, 0, -1], hint: '底板沿槽滑进去。' }),
      st(6, [7], { title: '背板', repeat: DRAWERS, parts: ids.back, bench: BENCH, approach: [0, 0, -1], hint: '背板压下来，卡进侧板顶端的缺口。' }),
      st(7, [7], { title: '钉背板', repeat: DRAWERS, tools: ['锤子'], hardware: [hw('110519', 4, nails)], hint: '侧板与背板之间用钉子敲入固定。' }),
      st(8, [8], { title: '抽屉滑轨', repeat: DRAWERS, hardware: [hw('123801+123802', 2, rails), hw('100365', 8, railScrews)],
        hint: '装左（123801）、右（123802）滑轨，每条 2 颗螺钉。',
        tools: ['螺丝刀'], motions: [{ type: 'screw', id: '100365', tool: '螺丝刀', page: 8 }], motionNote: '动作依据：p8 第 8 步放大圆圈里螺丝刀上的旋转箭头——螺钉边转边拧入。' }),
      st(9, [8], { title: '拉手和防撞垫', repeat: DRAWERS, hardware: [hw('106266', 2, knobs), hw('100412', 2, knobScrews), hw('107091', 2, pads)],
        hint: '拉手螺钉从面板内侧拧入；面板背面上角贴防撞垫（1 片 = 2 个垫）。',
        tools: ['螺丝刀'], motions: [{ type: 'screw', id: '100412', tool: '螺丝刀', page: 8 }], motionNote: '动作依据：p8 第 9 步螺丝刀上的旋转箭头——拉手螺钉边转边拧入。' }),
      st(10, [9], { title: '划线（左）', tools: ['123482', '铅笔'], marks: marks([-1]), hint: '定位片卡在格子底板前沿左侧，用铅笔划线。' }),
      st(11, [9], { title: '划线（右）', tools: ['123482', '铅笔'], marks: marks([1]), hint: '右侧同样划线。' }),
      st(12, [10], { title: '推入外框', install: ['frame'], hint: '把 U 形外框推进格子。' }),
      st(13, [11], { title: '左侧螺钉', hardware: [hw('124386', 2, [-8, 8].map((y) => frameScrew(-1, YC + y, Z_FRAME_FRONT - WS / 2)))],
        hint: '左侧压紧外框、对齐铅笔线，打 2 颗螺钉。',
        tools: ['螺丝刀'], motions: [{ type: 'screw', id: '124386', tool: '螺丝刀', page: 11 }],
        motionNote: '动作依据：p11 第 13 步螺丝刀上的旋转箭头——螺钉边转边拧入。第 14 步的图上没有画旋转箭头，那一步不加转动。' }),
      st(14, [11], { title: '右侧螺钉', hardware: [hw('124386', 2, [-8, 8].map((y) => frameScrew(1, YC + y, Z_FRAME_FRONT - WS / 2)))],
        hint: '右侧同样操作。' }),
      st(15, [12], { title: '推入抽屉', install: [...ids.front, ...ids.sides, ...ids.bottom, ...ids.back], hint: '两个抽屉放到滑轨上推进去。' }),
    ],
  };
}

// ======================= 全套 =======================
function buildSet() {
  // 排布来自 inputs/kallax/images/ 里的商品图（不是说明书内容）：从上数第 3 排 5 个门嵌件（拉手在右 → 左开），第 4 排 5 个双抽屉嵌件
  const row = (r) => [1, 2, 3, 4, 5].map((c) => ({ cell: [c, r], origin: K.cellCenter(c, r) }));
  return {
    schema: 'flatpack3d/set@1',
    id: 'kallax-set',
    title: 'KALLAX 全套（主体 + 5 门 + 5 双抽屉）',
    body: 'data/kallax/body.json',
    layoutSource: '商品图 …pe748007_s5.png、…pe618893_s5.png：第 3 排 5 个门（拉手在右，铰链在左）、第 4 排 5 个双抽屉，其余格子空。此排布来自商品图，不是说明书内容。',
    // 嵌件说明书 p3 ⓘ（报告第 4、6 节）：装了墙固定件的左上、右上两格如果装嵌件，要拿掉转角盖帽
    notes: ['嵌件说明书 p3 提示：柜体用墙固定件 115753 上墙时，左上、右上两格如果要装嵌件，需要拿掉那里的转角盖帽。当前排布的嵌件都在第 3、4 排，不受影响。'],
    references: [
      'inputs/kallax/images/imageye___-_imgi_1338_kallax-shelving-unit-with-10-inserts-black-brown__0754648_pe748007_s5.png',
      'inputs/kallax/images/imageye___-_imgi_1339_kallax-shelving-unit-with-10-inserts-white-stained-oak-effect__0480309_pe618893_s5.png',
    ],
    // 全套里每种嵌件应有的数量（来自任务要求；排布依据是商品图）。校验按这里核对
    expected: { door: 5, drawer: 5 },
    inserts: [
      { id: 'door', data: 'data/kallax/door.json', variant: 'left', placements: row(3) },
      { id: 'drawer', data: 'data/kallax/drawer.json', placements: row(4) },
    ],
  };
}

// ======================= Room =======================
// 地面 + 墙，全套靠墙放置；轮廓画在墙面上：柜体贴墙的那一面，以及每种方案的固定件位置
function buildRoom(body) {
  const outline = (variant) => {
    const wall = body.room.walls[variant];
    const items = [];
    const fixings = body.steps.filter((st) => st.variant === variant).flatMap((st) => st.hardware.filter((h) => h.action !== 'remove'));
    if (variant === 'a') {
      const z = wall.center[2] + wall.size[2] / 2 + 0.05;    // 墙面
      items.push({ kind: 'cabinet', plane: 'z', at: r2(z), rect: [-K.W / 2, -K.H / 2 - 0.4, K.W / 2, K.H / 2] });
      for (const pl of fixings.find((h) => h.id === '115753').placements) {
        items.push({ kind: 'fixing', id: '115753', plane: 'z', at: r2(z), rect: [pl.position[0] - (pl.mirrorX ? 3 : 0), pl.position[1] - 2.25, pl.position[0] + (pl.mirrorX ? 0 : 3), pl.position[1] + 2.25] });
      }
    } else {
      const x = wall.center[0] + wall.size[0] / 2 + 0.05;
      items.push({ kind: 'cabinet', plane: 'x', at: r2(x), rect: [-K.D / 2, -K.H / 2 - 0.4, K.D / 2, K.H / 2] });
      for (const pl of fixings.find((h) => h.id === '10091413').placements) {
        items.push({ kind: 'fixing', id: '10091413', plane: 'x', at: r2(x), rect: [pl.position[2] - 1.5, pl.position[1] - 5, pl.position[2] + 1.5, pl.position[1]] });
      }
    }
    return items.map((it) => ({ ...it, rect: it.rect.map(r2) }));
  };
  return {
    schema: 'flatpack3d/room@1',
    id: 'kallax-room',
    title: 'KALLAX 靠墙摆放（Room）',
    set: 'data/kallax/set.json',
    variantTitle: '上墙方案',
    variants: {
      a: { label: '墙固定件', note: '柜体背面贴墙（方案 A，p27–p30）', default: true },
      b: { label: 'L 形角码', note: '柜体左侧板贴墙（方案 B，p31–p35；墙在左侧是按图判断）' },
    },
    outlines: { a: outline('a'), b: outline('b') },
    outlineColor: '#00bcd4',
    eyeHeight: 160,
    note: '青色轮廓：柜体贴墙的那一面和固定件在墙上的最终位置。',
  };
}

const door = buildDoor();
// 门：p5 上半是第 2 步、下半是两条路线的缩略图；p10 上半是左开第 11 步、下半是 ⓘ 铰链调节；p11 上半是缩略图、下半是右开第 3 步
assignFigures(door.steps, { 2: [0, 0.45], 'left:11': [0, 0.45], 'right:3': [0.38, 1] });
const drawer = buildDrawer();
assignFigures(drawer.steps);
const outDir = path.join(__dirname, '..');
const body = JSON.parse(fs.readFileSync(path.join(outDir, 'body.json'), 'utf8'));
for (const [file, data] of [['door.json', door], ['drawer.json', drawer], ['set.json', buildSet()], ['room.json', buildRoom(body)]]) {
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(data, null, 2) + '\n');
  console.log(`已写入 data/kallax/${file}`);
}
