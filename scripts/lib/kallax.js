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

module.exports = { r2, vec, W, H, D, COLS, ROWS, TO, TI, INNER, CELL, PITCH, cellCenter };
