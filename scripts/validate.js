#!/usr/bin/env node
// 用分析报告校验装配数据：零件总数、五金总数、逐步五金用量与页码、几何。
// 用法：node scripts/validate.js [数据 JSON] [分析报告 md]
// 默认：data/kallax-body.json 对照 docs/analysis/kallax-manuals.md 的"1. shelf"一节。有任何不一致就以退出码 1 结束。
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dataPath = path.resolve(process.argv[2] || path.join(root, 'data/kallax-body.json'));
const reportPath = path.resolve(process.argv[3] || path.join(root, 'docs/analysis/kallax-manuals.md'));

const errors = [];
const passes = [];
const check = (ok, okMsg, errMsg) => (ok ? passes.push(okMsg) : errors.push(errMsg));
const normId = (s) => s.replace(/\s+/g, '');
const sameList = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

// ---------- 解析报告 ----------
const md = fs.readFileSync(reportPath, 'utf8');
const sec = md.slice(md.indexOf('## 1.'), md.indexOf('## 2.'));
if (!sec.trim()) { console.error(`✘ 在 ${reportPath} 里找不到"## 1."一节`); process.exit(1); }

function tables(text) {
  const out = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith('|')) {
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c))) continue;
      if (!cur) { cur = { header: cells, rows: [] }; out.push(cur); } else cur.rows.push(cells);
    } else cur = null;
  }
  return out;
}
const secTables = tables(sec);

// 板件清单：| 图示 | 数量 | 用途 |
const TYPE_BY_NAME = [['长层板', 'shelf'], ['隔板', 'divider'], ['侧板', 'side'], ['底板', 'bottom'], ['顶板', 'top']];
const reportParts = {};
const boardTable = secTables.find((t) => t.header[0] === '图示' && t.header[1] === '数量');
for (const row of boardTable ? boardTable.rows : []) {
  const head = row[2].replace(/\*\*/g, '').split(/[（(，,]/)[0];
  const hit = TYPE_BY_NAME.find(([k]) => head.endsWith(k));
  if (!hit) { errors.push(`报告板件行无法识别：${row.join(' | ')}`); continue; }
  reportParts[hit[1]] = (reportParts[hit[1]] || 0) + Number(row[1]);
}

// 五金清单：| 编号 | 数量 | 图示 |
const reportHw = {};
const hwTable = secTables.find((t) => t.header[0] === '编号' && t.header[1] === '数量');
for (const row of hwTable ? hwTable.rows : []) reportHw[normId(row[0])] = Number(row[1]);

// 步骤表：| 页 | 步骤 | 内容 | 用到的五金 |，只取本数据覆盖的步骤
const reportSteps = {};
for (const t of secTables.filter((t) => t.header[0] === '页' && t.header[1] === '步骤')) {
  for (const row of t.rows) {
    const page = /^p(\d+)$/.exec(row[0]);
    const n = /^\d+$/.test(row[1]) ? Number(row[1]) : null;
    if (!page || n === null) continue;
    const s = (reportSteps[n] = reportSteps[n] || { pages: new Set(), hw: {}, tools: new Set(), rows: 0 });
    s.rows++;
    s.pages.add(Number(page[1]));
    const col = row[3] || '';
    for (const m of col.matchAll(/(\d{5,}(?:\s*\/\s*\d{5,})*)\s*×\s*(\d+)/g)) {
      const id = normId(m[1]);
      s.hw[id] = (s.hw[id] || 0) + Number(m[2]);
    }
    const noCounts = col.replace(/(\d{5,}(?:\s*\/\s*\d{5,})*)\s*×\s*\d+/g, '');
    for (const m of noCounts.matchAll(/\b(\d{6,})\b/g)) s.tools.add(m[1]);
  }
}

// ---------- 读数据 ----------
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const stepNs = data.steps.map((s) => s.n);
const scopeMax = Math.max(...stepNs);

// 1. 零件
const partCount = {};
for (const p of data.parts) partCount[p.type] = (partCount[p.type] || 0) + 1;
const reportPartTotal = Object.values(reportParts).reduce((a, b) => a + b, 0);
check(reportPartTotal > 0, `报告板件清单解析到 ${Object.keys(reportParts).length} 种`, '报告里没有解析到板件清单');
for (const [type, qty] of Object.entries(reportParts)) {
  check(partCount[type] === qty, `零件 ${type}：${qty} 块`, `零件 ${type}：报告 ${qty} 块，数据 ${partCount[type] || 0} 块`);
  check(data.partTypes[type] && data.partTypes[type].quantity === qty, `partTypes.${type}.quantity = ${qty}`,
    `partTypes.${type}.quantity 与报告不符（报告 ${qty}）`);
}
for (const type of Object.keys(partCount)) {
  if (!(type in reportParts)) errors.push(`数据里有报告没有的零件种类：${type}`);
}
check(data.parts.length === reportPartTotal, `零件总数 ${reportPartTotal}`, `零件总数：报告 ${reportPartTotal}，数据 ${data.parts.length}`);

// 2. 五金目录
const hwById = Object.fromEntries(data.hardware.map((h) => [normId(h.id), h]));
check(Object.keys(reportHw).length > 0, `报告五金清单解析到 ${Object.keys(reportHw).length} 种`, '报告里没有解析到五金清单');
for (const [id, qty] of Object.entries(reportHw)) {
  const h = hwById[id];
  check(h && h.quantity === qty, `五金 ${id}：${qty}`, `五金 ${id}：报告 ${qty}，数据 ${h ? h.quantity : '缺失'}`);
}
for (const id of Object.keys(hwById)) if (!(id in reportHw)) errors.push(`数据里有报告没有的五金：${id}`);
const reportHwTotal = Object.values(reportHw).reduce((a, b) => a + b, 0);
const dataHwTotal = data.hardware.reduce((a, h) => a + h.quantity, 0);
check(reportHwTotal === dataHwTotal, `五金总数 ${reportHwTotal}`, `五金总数：报告 ${reportHwTotal}，数据 ${dataHwTotal}`);

// 3. 逐步对照
const inScope = Object.keys(reportSteps).map(Number).filter((n) => n <= scopeMax).sort((a, b) => a - b);
check(sameList(inScope, stepNs), `步骤 1–${scopeMax} 与报告一一对应`,
  `步骤编号不一致：报告 [${inScope}]，数据 [${stepNs}]`);
for (const s of data.steps) {
  const rep = reportSteps[s.n];
  if (!rep) continue;
  check(sameList(rep.pages, s.pages), `第 ${s.n} 步页码 p${s.pages}`, `第 ${s.n} 步页码：报告 p${[...rep.pages]}，数据 p${s.pages}`);
  const used = {};
  for (const h of s.hardware) used[normId(h.id)] = (used[normId(h.id)] || 0) + h.count;
  const keys = new Set([...Object.keys(rep.hw), ...Object.keys(used)]);
  for (const id of keys) {
    check(rep.hw[id] === used[id], `第 ${s.n} 步 ${id} ×${used[id]}`,
      `第 ${s.n} 步 ${id}：报告 ×${rep.hw[id] || 0}，数据 ×${used[id] || 0}`);
  }
  const dataTools = s.tools.filter((t) => /^\d+$/.test(t));
  check(sameList(rep.tools, dataTools), `第 ${s.n} 步工具编号 [${dataTools}]`,
    `第 ${s.n} 步工具编号：报告 [${[...rep.tools]}]，数据 [${dataTools}]`);
  for (const h of s.hardware) {
    check(h.count === h.placements.length, `第 ${s.n} 步 ${h.id} 摆放 ${h.count} 处`,
      `第 ${s.n} 步 ${h.id}：count ${h.count}，placements ${h.placements.length}`);
    if (!hwById[normId(h.id)]) errors.push(`第 ${s.n} 步引用了目录里没有的五金 ${h.id}`);
  }
}

// 4. 消耗总量
const consumed = {};
for (const s of data.steps) for (const h of s.hardware) consumed[normId(h.id)] = (consumed[normId(h.id)] || 0) + h.count;
for (const h of data.hardware) {
  const id = normId(h.id);
  if (h.kind === 'tool') continue;
  if (h.scope === 'wall') check(!consumed[id], `上墙五金 ${id} 本次未使用`, `上墙五金 ${id} 不应出现在本数据的步骤里`);
  else check(consumed[id] === h.quantity, `${id} 各步合计 ${h.quantity}，用完`, `${id}：各步合计 ${consumed[id] || 0}，清单 ${h.quantity}`);
}

// 5. 零件放置
const partIds = new Set(data.parts.map((p) => p.id));
const placedIn = {};
for (const s of data.steps) for (const id of s.parts) {
  if (!partIds.has(id)) errors.push(`第 ${s.n} 步引用了不存在的零件 ${id}`);
  (placedIn[id] = placedIn[id] || []).push(s.n);
}
const badPlace = data.parts.filter((p) => !placedIn[p.id] || placedIn[p.id].length !== 1);
check(badPlace.length === 0, '每块零件恰好放入一次',
  `零件放入次数不对：${badPlace.map((p) => `${p.id}(${(placedIn[p.id] || []).join(',') || '未放'})`).join('，')}`);
for (const s of data.steps) for (const h of s.hardware) for (const pl of h.placements) {
  if (pl.attachTo && !partIds.has(pl.attachTo)) errors.push(`第 ${s.n} 步 ${h.id} attachTo 不存在：${pl.attachTo}`);
}

// 6. 几何
const EPS = 0.01;
const box = (p) => p.size.map((s, i) => [p.position[i] - s / 2, p.position[i] + s / 2]);
const all = data.parts.map(box);
const ext = [0, 1, 2].map((i) => Math.max(...all.map((b) => b[i][1])) - Math.min(...all.map((b) => b[i][0])));
check(ext.every((e, i) => Math.abs(e - data.meta.overall[i]) < EPS), `外包盒 ${ext.map((e) => +e.toFixed(2)).join('×')}`,
  `外包盒 ${ext.map((e) => +e.toFixed(2)).join('×')} ≠ meta.overall ${data.meta.overall.join('×')}`);
const overlaps = [];
for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
  if ([0, 1, 2].every((i) => Math.min(all[a][i][1], all[b][i][1]) - Math.max(all[a][i][0], all[b][i][0]) > EPS)) {
    overlaps.push(`${data.parts[a].id}↔${data.parts[b].id}`);
  }
}
check(overlaps.length === 0, '零件之间没有重叠', `零件重叠：${overlaps.join('，')}`);

// ---------- 输出 ----------
const rel = (p) => path.relative(process.cwd(), p);
console.log(`数据：${rel(dataPath)}\n报告：${rel(reportPath)}（第 1 节，步骤 1–${scopeMax}）\n`);
console.log(`零件：报告 ${reportPartTotal} 块 / 数据 ${data.parts.length} 块`);
console.log(`五金：报告 ${reportHwTotal} 件（${Object.keys(reportHw).length} 种）/ 数据 ${dataHwTotal} 件`);
console.log(`通过 ${passes.length} 项检查`);
if (errors.length) {
  console.error(`\n✘ 发现 ${errors.length} 处不一致：`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('\n✔ 全部一致');
