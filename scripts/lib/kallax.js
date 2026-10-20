// KALLAX 共用尺寸（cm），来源见 docs/dimensions.md。主体和嵌件的生成脚本都从这里取数。
'use strict';

const r2 = (n) => Math.round(n * 100) / 100;
const vec = (x, y, z) => [r2(x), r2(y), r2(z)];

// 主体
const W = 182, H = 182, D = 39;   // 已确认（商品页）
const COLS = 5, ROWS = 5;         // 已确认（商品页）
const TO = 4.0;                   // 外框板厚，近似值
const TI = 1.6;                   // 内板厚，近似值
const INNER = W - 2 * TO;                      // 174
const CELL = (INNER - (COLS - 1) * TI) / COLS;  // 33.52
const PITCH = CELL + TI;

// 第 c 列、第 r 行（都从 1 起，r 从上数）格子内腔的中心，z 取深度中点
const cellCenter = (c, r) => vec(-INNER / 2 + (c - 1) * PITCH + CELL / 2, INNER / 2 - (r - 1) * PITCH - CELL / 2, 0);

// 步骤图在说明书页面上的竖直范围（0 = 页顶，1 = 页底），用于"点说明书图跳到步骤"。
// 规则来自逐页阅读：一页两步时，前一步在上半页、后一步在下半页；一页一步时占整页（不写 figure）。
// overrides：{ 'variant:n' 或 'n': [y0, y1] }，用于页面上还有缩略图或信息框的情况。
function assignFigures(steps, overrides = {}) {
  const groups = {};
  for (const s of steps) {
    const key = `${s.variant || ''}|${s.pages[0]}`;
    (groups[key] = groups[key] || []).push(s);
  }
  for (const list of Object.values(groups)) {
    if (list.length === 2) { list[0].figure = [0, 0.5]; list[1].figure = [0.5, 1]; }
    else if (list.length > 2) throw new Error(`第 ${list.map((s) => s.n)} 步在同一页超过两步，需要手写 figure`);
  }
  for (const s of steps) {
    const o = overrides[`${s.variant}:${s.n}`] || overrides[String(s.n)];
    if (o && (!s.variant || overrides[`${s.variant}:${s.n}`])) s.figure = o;
  }
  return steps;
}
module.exports = { r2, vec, W, H, D, COLS, ROWS, TO, TI, INNER, CELL, PITCH, cellCenter, assignFigures };
