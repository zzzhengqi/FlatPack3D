#!/usr/bin/env node
// 用分析报告校验装配数据：零件数、五金总数、逐步页码与五金用量、几何；"全套"另查嵌件数量与重叠。
// 产品都在 data/<id>/（有 manifest.json），每个产品对照自己的分析报告（manifest.analysis）校验。
// 用法：
//   node scripts/validate.js                     校验所有产品的装配数据、全套、Room、各语言站点文案，再跑取景截图检查
//   node scripts/validate.js --no-framing        同上，但跳过取景截图检查（不需要浏览器）
//   node scripts/validate.js --product=<id>      只校验一个产品
//   node scripts/validate.js <数据.json> [报告.md] 只校验一份（报告缺省取该文件所在产品的 analysis.md）
// 装配数据靠 source.reportSection（如 "## 2."）找到报告里对应的一节。有任何不一致就以退出码 1 结束。
'use strict';
const fs = require('fs');
const path = require('path');
const { root, listProducts, buildIndex } = require('./lib/products');

const normId = (s) => s.replace(/\s+/g, '');
const sameList = (a, b) => JSON.stringify([...a].map(String).sort()) === JSON.stringify([...b].map(String).sort());
const rel = (p) => path.relative(process.cwd(), p) || p;
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ---------------- 报告解析 ----------------
function sectionOf(md, heading) {
  const start = md.indexOf(heading);
  if (start < 0) return '';
  const next = md.indexOf('\n## ', start + heading.length);
  return md.slice(start, next < 0 ? undefined : next);
}

function tables(text) {
  const out = [];
  let cur = null, label = '';
  for (const line of text.split(/\r?\n/)) {
    const tl = line.trim();
    if (/^###\s/.test(tl) || /^\*\*.+\*\*$/.test(tl)) label = tl;
    if (tl.startsWith('|')) {
      const cells = tl.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c))) continue;
      if (!cur) { cur = { header: cells, rows: [], label }; out.push(cur); } else cur.rows.push(cells);
    } else cur = null;
  }
  return out;
}

// 五金列 → [{id, count|null}]：只认 knownIds 里的编号（报告五金表里的编号 + 成套五金的成员编号），长的先认；
// 编号后面跟"×N"就是数量，没写数量时 count 为 null。编号可以是任何写法（宜家的 6 位数字、"A"、"B2"、"M6×30"……）
const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
function hwItems(col, knownIds) {
  const items = [];
  let text = col;
  for (const id of [...knownIds].sort((a, b) => b.length - a.length)) {
    const pat = id.split(/([/+])/).map((x) => (x === '/' || x === '+' ? `\\s*${reEsc(x)}\\s*` : reEsc(x))).join('');
    const re = new RegExp(`(?<![A-Za-z0-9_/+])${pat}(?![A-Za-z0-9_/+])(?:\\s*×\\s*(\\d+))?`, 'g');
    text = text.replace(re, (m, n) => { items.push({ id, count: n ? Number(n) : null }); return ' '.repeat(m.length); });
  }
  return items;
}

function parseReport(md, heading, listLabels = []) {
  const sec = sectionOf(md, heading);
  const ts = tables(sec);
  const rep = { found: !!sec, parts: [], hw: {}, steps: {}, altPages: {}, stepTables: [] };
  for (const lb of listLabels) rep.altPages[lb] = {};
  for (const t of ts) {
    if (t.header[0] === '图示' && t.header[1] === '数量') rep.parts.push(...t.rows.map((r) => ({ label: r[0], qty: r[1] })));
    if (t.header[0] === '编号' && t.header[1] === '数量') for (const r of t.rows) rep.hw[normId(r[0])] = parseInt(r[1], 10);
    if (t.header[0] === '页' && t.header[1] === '步骤') {
      const own = { label: t.label, steps: {} };
      rep.stepTables.push(own);
      for (const r of t.rows) {
        const page = /^p(\d+)$/.exec(r[0]);
        if (!page || !/^\d+$/.test(r[1])) continue;
        for (const into of [rep.steps, own.steps]) {
          const st = (into[r[1]] = into[r[1]] || { pages: new Set(), items: [], raw: '' });
          st.pages.add(Number(page[1]));
          st.raw += ` ${r[3] || ''}`; // 五金列原文；编号在校验时按报告五金表认（hwItems）
        }
      }
    }
  }
  // 某条路线在报告里只写成列表（variants[v].reportList 给出加粗标签，例如门嵌件的"**右铰链路线**"）：
  // "- p13：第 6、7 步……"，五金与主路线相同，只核对页码
  for (const lb of listLabels) {
    const esc = lb.replace(/[.*+?^${}()|[\]\\]/g, (c) => `\\${c}`);
    const alt = new RegExp(`\\*\\*${esc}[^\\n]*\\n([\\s\\S]*?)(?:\\n\\s*\\n|$)`).exec(sec);
    if (!alt) continue;
    for (const line of alt[1].split(/\r?\n/)) {
      const m = /^- p(\d+)：(.*)$/.exec(line.trim());
      if (!m) continue;
      for (const g of m[2].matchAll(/第\s*([\d、]+)\s*步/g)) {
        for (const n of g[1].split('、')) (rep.altPages[lb][n] = rep.altPages[lb][n] || new Set()).add(Number(m[1]));
      }
    }
  }
  return rep;
}

// ---------------- 几何 ----------------
const D2R = Math.PI / 180;
function rotate([x, y, z], [rx = 0, ry = 0, rz = 0] = []) {
  // 与 three.js Euler 'XYZ' 一致：v' = Rx·Ry·Rz·v
  const c = (a) => Math.cos(a * D2R), s = (a) => Math.sin(a * D2R);
  let p = [x * c(rz) - y * s(rz), x * s(rz) + y * c(rz), z];
  p = [p[0] * c(ry) + p[2] * s(ry), p[1], -p[0] * s(ry) + p[2] * c(ry)];
  return [p[0], p[1] * c(rx) - p[2] * s(rx), p[1] * s(rx) + p[2] * c(rx)];
}
function aabb(center, size, rot, origin = [0, 0, 0]) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const p = rotate([center[0] + (sx * size[0]) / 2, center[1] + (sy * size[1]) / 2, center[2] + (sz * size[2]) / 2], rot);
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i] + origin[i]); hi[i] = Math.max(hi[i], p[i] + origin[i]); }
  }
  return [lo, hi];
}
// 一块零件（含 pieces 与变体姿态）的所有盒子，坐标为装配坐标 + offset
function partBoxes(part, variant, offset = [0, 0, 0]) {
  const v = (variant && part.variants && part.variants[variant]) || {};
  const pos = v.position || part.position;
  const rot = v.rotation || part.rotation;
  const at = pos.map((p, i) => p + offset[i]);
  const list = part.pieces ? part.pieces.map((pc) => ({ id: `${part.id}/${pc.id}`, box: aabb(pc.offset, pc.size, rot, at) }))
    : [{ id: part.id, box: aabb([0, 0, 0], part.size, rot, at) }];
  return list.map((b) => ({ ...b, part: part.id }));
}
function hostBoxes(host) {
  const [w, h, d] = host.cell, t = host.wall;
  const mk = (id, c, s) => ({ id, part: id, box: aabb(c, s) });
  return [
    mk('格子底板', [0, -h / 2 - t / 2, 0], [w + 2 * t, t, d]), mk('格子顶板', [0, h / 2 + t / 2, 0], [w + 2 * t, t, d]),
    mk('格子左壁', [-w / 2 - t / 2, 0, 0], [t, h, d]), mk('格子右壁', [w / 2 + t / 2, 0, 0], [t, h, d]),
  ];
}
const EPS = 0.01;
const overlapVol = (a, b) => [0, 1, 2].every((i) => Math.min(a[1][i], b[1][i]) - Math.max(a[0][i], b[0][i]) > EPS);
function overlaps(listA, listB = null) {
  const out = [];
  const B = listB || listA;
  for (let i = 0; i < listA.length; i++) {
    for (let j = listB ? 0 : i + 1; j < B.length; j++) {
      if (listA[i].part === B[j].part) continue;
      if (overlapVol(listA[i].box, B[j].box)) out.push(`${listA[i].id}↔${B[j].id}`);
    }
  }
  return out;
}

// ---------------- 装配数据校验 ----------------
function validateAssembly(data, md, file) {
  const errors = [], passes = [];
  const check = (ok, okMsg, errMsg) => (ok ? passes.push(okMsg) : errors.push(errMsg));
  const heading = data.source && data.source.reportSection;
  const listLabels = Object.values(data.variants || {}).map((x) => x.reportList).filter(Boolean);
  const rep = parseReport(md, heading || '\u0000', listLabels);
  if (!rep.found) return { errors: [`报告里找不到 ${heading || '(未写 source.reportSection)'} 一节`], passes, summary: '' };

  const cat = Object.fromEntries(data.hardware.map((h) => [normId(h.id), h]));
  const memberOf = {};
  for (const h of data.hardware) for (const m of h.members || []) memberOf[m] = normId(h.id);
  const knownIds = () => [...Object.keys(rep.hw), ...Object.keys(memberOf)];
  // 按"每个<单位>"重复做的步骤（例如双抽屉嵌件每个抽屉做一遍）：meta.repeat = { count, unit }
  const repeatCount = data.meta && data.meta.repeat && data.meta.repeat.count;
  const repeatUnit = (data.meta && data.meta.repeat && data.meta.repeat.unit) || '';

  // 0. 页码、步骤图位置、名称与编号
  const pageCount = data.manualPages && data.manualPages.count;
  check(Number.isInteger(pageCount) && pageCount > 0, `说明书共 ${pageCount} 页`, 'manualPages.count 缺失或不是正整数');
  for (const s of [data.overview, ...data.steps].filter(Boolean)) {
    const tag = `${s.variant ? `[${s.variant}] ` : ''}第 ${s.n} 步`;
    const ok = Array.isArray(s.pages) && s.pages.length > 0 && s.pages.every((p) => Number.isInteger(p) && p >= 1 && (!pageCount || p <= pageCount));
    check(ok, `${tag}有页码 p${s.pages}`, `${tag}页码缺失或超出 1–${pageCount}：${JSON.stringify(s.pages)}`);
    if (s.figure !== undefined) {
      const f = s.figure;
      check(Array.isArray(f) && f.length === 2 && f[0] >= 0 && f[0] < f[1] && f[1] <= 1, `${tag}步骤图位置 [${f}]`, `${tag}步骤图位置无效：${JSON.stringify(f)}`);
    }
  }
  for (const v of data.variants ? Object.keys(data.variants) : [null]) {
    const seq = data.steps.filter((s) => !s.variant || s.variant === v);
    for (let a = 0; a < seq.length; a++) for (let b = a + 1; b < seq.length; b++) {
      const A = seq[a], B = seq[b];
      if (!A.pages || !B.pages || A.pages[0] !== B.pages[0]) continue;
      const fa = A.figure || [0, 1], fb = B.figure || [0, 1];
      if (Math.min(fa[1], fb[1]) - Math.max(fa[0], fb[0]) > EPS) {
        errors.push(`${v ? `[${v}] ` : ''}第 ${A.n}、${B.n} 步都在 p${A.pages[0]}，步骤图位置重叠（${JSON.stringify(fa)} / ${JSON.stringify(fb)}），点说明书图无法区分`);
      }
    }
  }
  const ids = new Set();
  const badNames = [];
  for (const p of data.parts) {
    if (typeof p.name !== 'string' || !p.name.trim()) badNames.push(`${p.id || '(无 id)'} 没有名称`);
    if (typeof p.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(p.id)) badNames.push(`零件编号无效：${JSON.stringify(p.id)}（${p.name}）`);
    else if (ids.has(p.id)) badNames.push(`零件编号重复：${p.id}`);
    ids.add(p.id);
    if (!data.partTypes[p.type] || !data.partTypes[p.type].name) badNames.push(`${p.id} 的种类 ${p.type} 没有名称`);
  }
  const hwIds = new Set();
  for (const h of data.hardware) {
    if (typeof h.name !== 'string' || !h.name.trim()) badNames.push(`五金 ${h.id} 没有名称`);
    if (typeof h.id !== 'string' || !h.id.trim()) badNames.push(`五金编号缺失（${h.name}）`);
    else if (hwIds.has(h.id)) badNames.push(`五金编号重复：${h.id}`);
    hwIds.add(h.id);
  }
  for (const s of data.steps) for (const h of s.hardware) for (const pl of h.placements) {
    const def = data.hardware.find((x) => x.id === h.id);
    if (pl.member && !(def && (def.members || []).includes(pl.member))) badNames.push(`第 ${s.n} 步 ${h.id} 的成员编号 ${pl.member} 不在 members 里`);
  }
  check(badNames.length === 0, `${data.parts.length} 块零件、${data.hardware.length} 种五金都有名称和编号`, `名称/编号问题：${badNames.join('；')}`);

  // 1. 零件
  const partCount = {};
  for (const p of data.parts) partCount[p.type] = (partCount[p.type] || 0) + 1;
  let reportPartTotal = 0;
  const usedTypes = new Set();
  for (const row of rep.parts) {
    const entry = Object.entries(data.partTypes).find(([, t]) => t.report === row.label);
    let qty = null;
    const per = /每个(\S+?)\s*(\d+)/.exec(row.qty);
    if (per) {
      if (!repeatCount) { errors.push(`报告按"每个${per[1]}"计数（${row.label}），但数据没有 meta.repeat`); continue; }
      if (repeatUnit && per[1] !== repeatUnit) errors.push(`报告按"每个${per[1]}"计数，数据 meta.repeat.unit 是"${repeatUnit}"`);
      qty = Number(per[2]) * repeatCount;
      if (entry) check(entry[1].perRepeat === Number(per[2]), `${row.label} 每个${per[1]} ${per[2]} 块`, `${row.label}：报告每个${per[1]} ${per[2]} 块，数据 perRepeat=${entry[1].perRepeat}`);
    } else qty = parseInt(row.qty, 10);
    reportPartTotal += qty;
    if (!entry) { errors.push(`报告板件"${row.label}"在数据 partTypes 里没有对应（report 字段）`); continue; }
    const [type, t] = entry;
    usedTypes.add(type);
    check(partCount[type] === qty && t.quantity === qty, `零件 ${row.label}：${qty} 块`,
      `零件 ${row.label}：报告 ${qty} 块，数据实例 ${partCount[type] || 0} 块、partTypes.quantity ${t.quantity}`);
  }
  for (const type of Object.keys(partCount)) if (!usedTypes.has(type)) errors.push(`数据里有报告没有的零件种类：${type}`);
  check(data.parts.length === reportPartTotal, `零件总数 ${reportPartTotal}`, `零件总数：报告 ${reportPartTotal}，数据 ${data.parts.length}`);

  // 2. 五金目录
  for (const [id, qty] of Object.entries(rep.hw)) {
    check(cat[id] && cat[id].quantity === qty, `五金 ${id}：${qty}`, `五金 ${id}：报告 ${qty}，数据 ${cat[id] ? cat[id].quantity : '缺失'}`);
  }
  for (const id of Object.keys(cat)) if (!(id in rep.hw)) errors.push(`数据里有报告没有的五金：${id}`);
  const reportHwTotal = Object.values(rep.hw).reduce((a, b) => a + b, 0);
  const dataHwTotal = data.hardware.reduce((a, h) => a + h.quantity, 0);
  check(reportHwTotal === dataHwTotal, `五金总数 ${reportHwTotal}`, `五金总数：报告 ${reportHwTotal}，数据 ${dataHwTotal}`);

  // 某条路线在报告里的步骤：有 variants[v].report 关键字时，只取标题含该关键字的表和不属于任何方案的表
  const keys = Object.values(data.variants || {}).map((x) => x.report).filter(Boolean);
  const stepsFor = (v) => {
    const k = v && data.variants[v].report;
    if (!keys.length) return rep.steps;
    const merged = {};
    for (const t of rep.stepTables) {
      const owner = keys.find((kk) => t.label.includes(kk));
      if (owner && owner !== k) continue;
      for (const [n, st] of Object.entries(t.steps)) {
        const m = (merged[n] = merged[n] || { pages: new Set(), items: [], raw: '' });
        for (const pg of st.pages) m.pages.add(pg);
        m.raw += st.raw;
      }
    }
    return merged;
  };
  // 报告里一步的用量（每个抽屉 / 每次）：数量 + 工具编号
  const expectStep = (n, v = null) => {
    const s = stepsFor(v)[n];
    const use = {}, tools = new Set();
    if (!s) return { use, tools };
    const setsSeen = new Set();
    for (const it of hwItems(s.raw, knownIds())) {
      if (it.count !== null) { use[it.id] = (use[it.id] || 0) + it.count; continue; }
      if (cat[it.id] && cat[it.id].kind === 'tool') { tools.add(it.id); continue; }
      if (memberOf[it.id]) { // 成套五金（如 123801 + 123802）：报告列出成员即算 1 套
        if (!setsSeen.has(memberOf[it.id])) { setsSeen.add(memberOf[it.id]); use[memberOf[it.id]] = (use[memberOf[it.id]] || 0) + 1; }
        continue;
      }
      use[it.id] = (use[it.id] || 0) + 1; // 只写编号、没写数量：按 1 件
    }
    return { use, tools };
  };

  // 3–5. 逐个变体（路线）检查
  const variants = data.variants ? Object.keys(data.variants) : [null];
  const scopeMax = Math.max(...data.steps.map((s) => s.n));
  for (const v of variants) {
    const repSteps = stepsFor(v);
    const reportNs = Object.keys(repSteps).map(Number).filter((n) => n <= scopeMax).sort((a, b) => a - b);
    const tag = v ? `[${data.variants[v].label}] ` : '';
    const seq = data.steps.filter((s) => !s.variant || s.variant === v);
    const ns = seq.map((s) => s.n);
    check(sameList(ns, reportNs) && new Set(ns).size === ns.length, `${tag}步骤 ${ns[0]}–${ns[ns.length - 1]} 与报告一一对应`,
      `${tag}步骤编号不一致：报告 [${reportNs}]，数据 [${ns}]`);
    const consumed = {};
    const placed = {};
    for (const s of seq) {
      const listLabel = v && data.variants[v].reportList;
      const repPages = (listLabel && rep.altPages[listLabel] && rep.altPages[listLabel][s.n]) || (repSteps[s.n] && repSteps[s.n].pages);
      if (repPages) check(sameList(repPages, s.pages), `${tag}第 ${s.n} 步页码 p${s.pages}`, `${tag}第 ${s.n} 步页码：报告 p${[...repPages]}，数据 p${s.pages}`);
      else if (listLabel) errors.push(`${tag}第 ${s.n} 步：报告的"${listLabel}"列表里找不到页码`);
      const repeat = s.repeat || 1;
      if (s.repeat) check(s.repeat === repeatCount, `${tag}第 ${s.n} 步按 ${s.repeat} 个${repeatUnit}重复`, `${tag}第 ${s.n} 步 repeat=${s.repeat}，与 meta.repeat.count=${repeatCount} 不符`);
      const { use, tools } = expectStep(s.n, v);
      const got = {}, removed = {};
      for (const h of s.hardware) {
        got[normId(h.id)] = (got[normId(h.id)] || 0) + h.count;
        if (h.action === 'remove') removed[normId(h.id)] = (removed[normId(h.id)] || 0) + h.count;
      }
      for (const id of new Set([...Object.keys(use), ...Object.keys(got)])) {
        const want = (use[id] || 0) * repeat;
        check(want === (got[id] || 0), `${tag}第 ${s.n} 步 ${id} ×${got[id]}`,
          `${tag}第 ${s.n} 步 ${id}：报告 ×${use[id] || 0}${repeat > 1 ? `（×${repeat} 个${repeatUnit} = ${want}）` : ''}，数据 ×${got[id] || 0}`);
        consumed[id] = (consumed[id] || 0) + (got[id] || 0) - 2 * (removed[id] || 0);
      }
      // 拧出：位置必须是之前步骤装上的同一种五金
      for (const h of s.hardware.filter((x) => x.action === 'remove')) {
        const before = seq.slice(0, seq.indexOf(s)).flatMap((x) => x.hardware.filter((y) => y.id === h.id && y.action !== 'remove').flatMap((y) => y.placements));
        const miss = h.placements.filter((pl) => !before.some((b) => b.position.every((c, i) => Math.abs(c - pl.position[i]) < 0.01)));
        check(!miss.length, `${tag}第 ${s.n} 步拧出的 ${h.id} 都是之前装上的`, `${tag}第 ${s.n} 步拧出的 ${h.id} 有 ${miss.length} 处在之前步骤里没有装过`);
      }
      // 不随包装提供的东西（例如墙用螺钉）：data.extras 里每种的 reportTag 是报告五金列里的写法（例如"墙钉（不含）"），
      // 报告写了的步骤必须有这种另购件，反之亦然
      const extraIds = (s.extras || []).map((x) => x.id);
      for (const def of (data.extras || []).filter((x) => x.reportTag)) {
        const repSays = ((repSteps[s.n] && repSteps[s.n].raw) || '').includes(def.reportTag);
        const has = extraIds.includes(def.id);
        check(repSays === has, `${tag}第 ${s.n} 步${def.name}与报告一致`,
          `${tag}第 ${s.n} 步：报告${repSays ? '写了' : '没写'}"${def.reportTag}"，数据${has ? '有' : '没有'} extras ${def.id}`);
      }
      for (const x of s.extras || []) {
        const def = (data.extras || []).find((e) => e.id === x.id);
        if (!def || !def.notIncluded) errors.push(`${tag}第 ${s.n} 步 extras ${x.id} 不在 data.extras 里或没有标 notIncluded`);
      }
      const dataTools = (s.tools || []).filter((t) => /^\d+$/.test(t));
      check(sameList(tools, dataTools), `${tag}第 ${s.n} 步工具编号 [${dataTools}]`, `${tag}第 ${s.n} 步工具编号：报告 [${[...tools]}]，数据 [${dataTools}]`);
      // 动作：只加说明书画了箭头的。依据页必须是本步的页，motionNote 要点名这一页；对象、工具、类型要对得上
      for (const m of s.motions || []) {
        const where = `${tag}第 ${s.n} 步动作 ${m.type}`;
        if (!MOTION_TYPES.includes(m.type)) { errors.push(`${where}：未知类型（可用 ${MOTION_TYPES.join(' / ')}）`); continue; }
        check(s.pages.includes(m.page), `${where} 依据 p${m.page}`, `${where}：依据页 p${m.page} 不是本步的页 p${s.pages}`);
        check(!!s.motionNote && s.motionNote.includes(`p${m.page}`), `${where} 的依据写进了 motionNote`, `${where}：motionNote 没有写明依据页 p${m.page}`);
        if (m.tool) check((s.tools || []).includes(m.tool), `${where} 的工具 ${m.tool} 在本步工具里`, `${where}：工具 ${m.tool} 不在本步 tools 里`);
        if (m.target) {
          const ts = seq.find((x) => x.n === m.target.step);
          const ok = ts && seq.indexOf(ts) < seq.indexOf(s) && (m.target.id ? ts.hardware.some((h) => h.id === m.target.id && h.action !== 'remove') : (ts.extras || []).some((x) => x.id === m.target.extra));
          check(ok, `${where} 的对象在第 ${m.target.step} 步装上`, `${where}：第 ${m.target.step} 步没有装 ${m.target.id || m.target.extra}，或那一步不在本步之前`);
          if (m.type === 'slide') check(/^[xyz]$/.test(m.axis) && m.amount > 0, `${where} 沿 ${m.axis} ±${m.amount}`, `${where}：axis / amount 不对`);
        } else {
          const key = m.id || m.extra;
          const list = m.type === 'unscrew' ? s.hardware.filter((h) => h.action === 'remove') : m.id ? s.hardware.filter((h) => h.action !== 'remove') : (s.extras || []);
          check(list.some((h) => h.id === key), `${where} 的对象 ${key} 在本步`, `${where}：本步没有${m.type === 'unscrew' ? '拧出' : '装'} ${key}`);
          const def = m.id ? cat[normId(m.id)] : (data.extras || []).find((e) => e.id === m.extra);
          const kind = def && (def.kind || (def.shape && def.shape.type));
          const want = m.type === 'turn' ? 'cam' : m.type === 'push' ? kind : 'screw';
          check(kind === want, `${where} 的对象是 ${want}`, `${where}：${key} 的种类是 ${kind}，应为 ${want}`);
          if (m.type === 'turn') check(m.angle > 0, `${where} 转 ${m.angle}°`, `${where}：没有转角 angle`);
        }
      }
      if (s.motionNote && !(s.motions || []).length) errors.push(`${tag}第 ${s.n} 步有 motionNote 但没有 motions`);
      if (s.zoomFocus) check(s.pages.includes(s.zoomFocus.page) && s.zoomFocus.index >= 0, `${tag}第 ${s.n} 步放大圆圈对准第 ${s.zoomFocus.index + 1} 个（p${s.zoomFocus.page}）`, `${tag}第 ${s.n} 步 zoomFocus 的依据页不是本步的页`);
      for (const h of s.hardware) {
        const def = cat[normId(h.id)];
        if (!def) { errors.push(`${tag}第 ${s.n} 步引用了目录里没有的五金 ${h.id}`); continue; }
        const per = def.pieces || 1;
        check(h.placements.length === h.count * per, `${tag}第 ${s.n} 步 ${h.id} 摆放 ${h.placements.length} 处`,
          `${tag}第 ${s.n} 步 ${h.id}：count ${h.count}${per > 1 ? ` × 每${def.unit || '件'} ${per} 个` : ''}，placements ${h.placements.length}`);
        for (const pl of h.placements) if (pl.attachTo && !data.parts.some((p) => p.id === pl.attachTo)) errors.push(`${tag}第 ${s.n} 步 ${h.id} attachTo 不存在：${pl.attachTo}`);
      }
      for (const id of s.parts || []) (placed[id] = placed[id] || []).push(s.n);
      for (const id of [...(s.install || []), ...(s.fold || [])]) {
        if (!placed[id]) errors.push(`${tag}第 ${s.n} 步要移动/折叠的 ${id} 还没有放入`);
      }
    }
    // 消耗总量
    for (const h of data.hardware) {
      const id = normId(h.id);
      if (h.kind === 'tool') continue;
      // 只在某些方案里用的五金（variants），其他方案里用量为 0；没有 variants 的上墙五金一律不用
      const usedHere = h.variants ? h.variants.includes(v) : h.scope !== 'wall';
      if (!usedHere) check(!consumed[id], `${tag}${id} 在本路线不使用`, `${tag}${id} 不应出现在本路线的步骤里（用量 ${consumed[id]}）`);
      else check(consumed[id] === h.quantity, `${tag}${id} 各步合计 ${h.quantity}，用完`, `${tag}${id}：各步合计 ${consumed[id] || 0}，清单 ${h.quantity}`);
    }
    const badPlace = data.parts.filter((p) => !placed[p.id] || placed[p.id].length !== 1);
    check(badPlace.length === 0, `${tag}每块零件恰好放入一次`,
      `${tag}零件放入次数不对：${badPlace.map((p) => `${p.id}(${(placed[p.id] || []).join(',') || '未放'})`).join('，')}`);
    for (const s of seq) for (const id of s.parts || []) if (!data.parts.some((p) => p.id === id)) errors.push(`${tag}第 ${s.n} 步引用了不存在的零件 ${id}`);

    // 几何
    const boxes = data.parts.flatMap((p) => partBoxes(p, v));
    const lo = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b.box[0][i])));
    const hi = [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b.box[1][i])));
    const ext = hi.map((h, i) => +(h - lo[i]).toFixed(2));
    check(ext.every((e, i) => Math.abs(e - data.meta.overall[i]) < EPS), `${tag}外包盒 ${ext.join('×')}`, `${tag}外包盒 ${ext.join('×')} ≠ meta.overall ${data.meta.overall.join('×')}`);
    const ov = overlaps(boxes);
    check(ov.length === 0, `${tag}零件之间没有重叠`, `${tag}零件重叠：${ov.join('，')}`);
    if (data.host) {
      const hv = overlaps(boxes, hostBoxes(data.host));
      check(hv.length === 0, `${tag}与格子隔板没有重叠`, `${tag}与格子隔板重叠：${hv.join('，')}`);
    }
  }

  // 重复次数要能由五金数量推出来：只在重复步骤里用到的五金，清单数 ÷ 每次用量 = 重复次数
  if (repeatCount) {
    const perRepeat = {}, elsewhere = new Set();
    for (const s of data.steps) {
      const { use } = expectStep(s.n);
      for (const [id, c] of Object.entries(use)) {
        if (s.repeat) perRepeat[id] = (perRepeat[id] || 0) + c; else elsewhere.add(id);
      }
    }
    const implied = Object.entries(perRepeat).filter(([id]) => !elsewhere.has(id)).map(([id, c]) => [id, rep.hw[id] / c]);
    const okAll = implied.length > 0 && implied.every(([, k]) => k === repeatCount);
    check(okAll, `按五金数量推得${repeatUnit}数 = ${repeatCount}（${implied.map(([id, k]) => `${id}:${k}`).join('，')}）`,
      `五金数量推出的${repeatUnit}数与 meta.repeat.count=${repeatCount} 不符：${implied.map(([id, k]) => `${id}→${k}`).join('，')}`);
  }

  const summary = `零件：报告 ${reportPartTotal} 块 / 数据 ${data.parts.length} 块；五金：报告 ${reportHwTotal} 件（${Object.keys(rep.hw).length} 种）/ 数据 ${dataHwTotal} 件`;
  return { errors, passes, summary };
}

const MOTION_TYPES = ['screw', 'unscrew', 'turn', 'slide', 'tighten', 'push'];

// ---------------- 全套校验 ----------------
function validateRoom(room, baseDir) {
  const errors = [], passes = [];
  const check = (ok, okMsg, errMsg) => (ok ? passes.push(okMsg) : errors.push(errMsg));
  const set = readJson(path.join(baseDir, room.set));
  const body = readJson(path.join(baseDir, set.body));
  const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;
  const boxes = body.parts.flatMap((p) => partBoxes(p, null));
  const lo = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b.box[0][i])));
  const hi = [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b.box[1][i])));
  for (const v of Object.keys(room.variants)) {
    if (!body.variants || !body.variants[v]) { errors.push(`Room 方案 ${v} 在主体数据里不存在`); continue; }
    const wall = body.room && body.room.walls[v];
    if (!wall) { errors.push(`主体数据没有方案 ${v} 的墙`); continue; }
    const items = room.outlines[v] || [];
    const cab = items.find((o) => o.kind === 'cabinet');
    if (!cab) { errors.push(`[${v}] 没有柜体轮廓`); continue; }
    // 轮廓所在平面 = 墙面（墙盒朝柜体的那一面）
    const axis = 'xyz'.indexOf(cab.plane);
    const face = wall.center[axis] + wall.size[axis] / 2;
    check(items.every((o) => o.plane === cab.plane && near(o.at, face, 0.2)), `[${v}] 轮廓都画在墙面上（${cab.plane} = ${face.toFixed(2)}）`, `[${v}] 轮廓不在墙面上：墙面 ${cab.plane} = ${face.toFixed(2)}`);
    // 柜体轮廓 = 柜体在墙面上的投影（含毡垫 0.4）
    const a = cab.plane === 'z' ? 0 : 2;
    const ok = near(cab.rect[0], lo[a]) && near(cab.rect[2], hi[a]) && near(cab.rect[1], lo[1], 0.6) && near(cab.rect[3], hi[1]);
    check(ok, `[${v}] 柜体轮廓与柜体外形一致`, `[${v}] 柜体轮廓 ${cab.rect} 与柜体外形 ${[lo[a], lo[1], hi[a], hi[1]].map((x) => x.toFixed(1))} 不一致`);
    // 固定件轮廓：每个本方案的固定件定位点都落在某个轮廓里
    const fixIds = new Set(items.filter((o) => o.kind === 'fixing').map((o) => o.id));
    const placements = body.steps.filter((st) => st.variant === v).flatMap((st) => st.hardware.filter((h) => fixIds.has(h.id) && h.action !== 'remove').flatMap((h) => h.placements));
    const inside = (pt) => items.some((o) => o.kind === 'fixing' && pt[a] >= o.rect[0] - 0.01 && pt[a] <= o.rect[2] + 0.01 && pt[1] >= o.rect[1] - 0.01 && pt[1] <= o.rect[3] + 0.01);
    check(placements.length > 0 && placements.every((pl) => inside(pl.position)), `[${v}] ${placements.length} 个固定件都有轮廓`, `[${v}] 有固定件不在任何轮廓里，或没有固定件轮廓`);
  }
  return { errors, passes, summary: `方案 ${Object.keys(room.variants).join('、')}；轮廓 ${Object.values(room.outlines).flat().length} 个` };
}

function validateSet(set, baseDir) {
  const errors = [], passes = [];
  const check = (ok, okMsg, errMsg) => (ok ? passes.push(okMsg) : errors.push(errMsg));
  const body = readJson(path.join(baseDir, set.body));
  const bodyBoxes = body.parts.flatMap((p) => partBoxes(p, null)).map((b) => ({ ...b, id: `主体/${b.id}`, part: `body:${b.part}` }));
  const bLo = [0, 1, 2].map((i) => Math.min(...bodyBoxes.map((b) => b.box[0][i])));
  const bHi = [0, 1, 2].map((i) => Math.max(...bodyBoxes.map((b) => b.box[1][i])));
  const counts = {};
  const cells = new Set();
  const insertBoxes = [];
  for (const ins of set.inserts) {
    const data = readJson(path.join(baseDir, ins.data));
    counts[ins.id] = (counts[ins.id] || 0) + ins.placements.length;
    if (data.variants && !data.variants[ins.variant]) errors.push(`${ins.id}：变体 ${ins.variant} 不存在`);
    for (const pl of ins.placements) {
      const key = pl.cell.join(',');
      if (cells.has(key)) errors.push(`格子 (${key}) 放了不止一个嵌件`);
      cells.add(key);
      const [c, r] = pl.cell;
      if (!(c >= 1 && c <= body.meta.grid[0] && r >= 1 && r <= body.meta.grid[1])) errors.push(`${ins.id} 格子 (${key}) 超出 ${body.meta.grid.join('×')}`);
      const bx = data.parts.flatMap((p) => partBoxes(p, ins.variant || null, pl.origin))
        .map((b) => ({ ...b, id: `${ins.id}@(${key})/${b.id}`, part: `${ins.id}@${key}:${b.part}` }));
      for (const b of bx) {
        const inside = [0, 1, 2].every((i) => b.box[0][i] >= bLo[i] - EPS && b.box[1][i] <= bHi[i] + EPS);
        if (!inside) errors.push(`${b.id} 超出主体外形`);
      }
      insertBoxes.push(...bx);
    }
  }
  // 应有的嵌件数量写在 set.expected（来源要在 layoutSource / notes 里说明）
  const expected = set.expected || {};
  if (!set.expected) errors.push('全套数据缺少 expected（每种嵌件应有的数量）');
  for (const [id, n] of Object.entries(expected)) {
    check(counts[id] === n, `全套 ${id} 嵌件 ${n} 个`, `全套 ${id} 嵌件：应为 ${n}，数据 ${counts[id] || 0}`);
  }
  for (const id of Object.keys(counts)) if (!(id in expected)) errors.push(`全套里有未预期的嵌件种类：${id}`);
  const withBody = overlaps(insertBoxes, bodyBoxes);
  check(withBody.length === 0, '嵌件与主体板件没有重叠', `嵌件与主体板件重叠：${withBody.slice(0, 12).join('，')}${withBody.length > 12 ? ` 等 ${withBody.length} 处` : ''}`);
  const between = overlaps(insertBoxes).filter((s) => s.split('↔').map((x) => x.split('/')[0]).reduce((a, b) => a !== b));
  check(between.length === 0, '嵌件之间没有重叠', `嵌件之间重叠：${between.slice(0, 12).join('，')}`);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { errors, passes, summary: `嵌件：${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' + ')} = ${total} 个，占 ${cells.size} 格` };
}

// ---------------- 站点文案校验 ----------------
// 界面文字都要在文案文件里；分享信息与 index.html 一致；PDF 链接覆盖每份说明书；近似清单能从 dimensions.md 取到
function validateSite(site, baseDir, ctx) {
  const BASE_SITE = ctx.baseSite; // 其他语言的站点文案都要与它逐项对齐
  const errors = [], passes = [];
  const check = (ok, okMsg, errMsg) => (ok ? passes.push(okMsg) : errors.push(errMsg));
  const at = (p) => path.resolve(baseDir, p);
  const exists = (p) => fs.existsSync(at(p));
  check(exists(site.ui), `界面文案 ${site.ui}`, `界面文案文件不存在：${site.ui}`);
  check(exists(site.product), `产品文案 ${site.product}`, `产品文案文件不存在：${site.product}`);
  if (errors.length) return { errors, passes, summary: '' };
  const ui = readJson(at(site.ui));
  const product = readJson(at(site.product));
  const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');

  // index.html 里用到的文案键都要在界面文案里
  const keys = new Set([...html.matchAll(/data-(?:t|title)="([A-Za-z0-9_]+)"/g), ...html.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)].map((m) => m[1]));
  const missing = [...keys].filter((k) => !(k in ui));
  check(missing.length === 0, `index.html 用到的 ${keys.size} 个文案键都在 ${site.ui}`, `${site.ui} 缺少文案键：${missing.join('，')}`);
  check(Array.isArray(ui.shortcutList) && ui.shortcutList.length >= 8, `快捷键说明 ${ui.shortcutList.length} 条`, '界面文案缺少 shortcutList');

  // 每份装配数据的说明书都要有官方链接，文档号一致
  const links = (product.about && product.about.links && product.about.links.items) || [];
  for (const piece of site.pieces) {
    check(exists(piece.url), `件"${piece.label}"数据 ${piece.url}`, `件"${piece.label}"的数据文件不存在：${piece.url}`);
    if (!exists(piece.url)) continue;
    const d = readJson(at(piece.url));
    if (!d.source || !d.source.manual) continue;
    const link = links.find((l) => path.basename(new URL(l.url).pathname) === d.source.manual);
    check(link && link.docId === d.source.docId && /^https:\/\//.test(link.url), `${d.source.docId} 有官方 PDF 链接`,
      `${d.source.manual}（${d.source.docId}）在 ${site.product} 里没有对应的官方 PDF 链接，或文档号不一致`);
    // 说明书要登记在 manifest.sources.manuals 里；页面图目录 = renders/<产品>/<key>，页数一致
    const m = ((ctx.manifest.sources && ctx.manifest.sources.manuals) || []).find((x) => x.file === d.source.manual);
    check(m && m.docId === d.source.docId && m.url === (link && link.url), `${d.source.manual} 登记在 manifest.json`, `${d.source.manual} 没有登记在 ${ctx.manifest.dir}/manifest.json 的 sources.manuals 里，或文档号、链接与产品文案不一致`);
    if (m && d.manualPages) {
      const dir = `renders/${ctx.manifest.id}/${m.key}`;
      check(d.manualPages.dir === dir && d.manualPages.count === m.pages, `${piece.key} 的页面图目录 ${dir}、${m.pages} 页`, `${piece.key} 的 manualPages 应为 dir=${dir}、count=${m.pages}，数据是 dir=${d.manualPages.dir}、count=${d.manualPages.count}`);
    }
  }

  // 分享信息
  const sh = product.share || {};
  check(sh.title && sh.description && sh.image, '分享标题、描述、图片都已填写', '产品文案 share 缺少 title / description / image');
  check(sh.image && exists(sh.image), `分享图 ${sh.image} 存在`, `分享图不存在：${sh.image}（运行 node scripts/make-og-image.js 生成）`);
  // index.html 的 <head> 是静态的，只写基准语言（爬虫不执行脚本）；其他语言的标题由页面运行时设置
  if (ctx.isDefault && path.resolve(baseDir, site.__file || '') === path.resolve(baseDir, BASE_SITE)) {
    const metaOk = html.includes(`<title>${sh.title}</title>`) && html.includes(`<meta name="description" content="${sh.description}">`) && html.includes(`content="${sh.image}"`);
    check(metaOk, 'index.html 的 <title>、description、og:image 与文案一致', 'index.html 的分享信息与产品文案不一致（运行 node scripts/build-meta.js）');
  }

  // 近似清单来源、声明
  const ap = product.about && product.about.approximate;
  const md = ap && exists(ap.source) ? fs.readFileSync(at(ap.source), 'utf8') : '';
  const sec = md ? sectionOf(md, ap.heading) : '';
  const items = (sec.match(/^\d+\.\s/gm) || []).length;
  check(items > 0, `近似清单可从 ${ap && ap.source} 取到 ${items} 条`, `近似清单取不到：${ap ? `${ap.source} 里没有 "${ap.heading}" 或没有编号条目` : '缺少 about.approximate'}`);
  // 安全提示（说明书里有安全警告时写）：要注明出自哪一页（safety.page），正文里写 p<页>
  if (product.safety) {
    const sf = product.safety;
    check(sf.title && sf.text && sf.short && Number.isInteger(sf.page) && sf.text.includes(`p${sf.page}`), `有安全提示（转述说明书 p${sf.page} 的警告）`, '产品文案 safety 要有 title / page / text / short，且 text 里写明 p<page>');
  }
  if (ctx.isDefault && path.resolve(baseDir, site.__file || '') === path.resolve(baseDir, BASE_SITE)) {
    const built = require('./build-meta').build();
    const stale = Object.entries(built).filter(([f, html]) => !fs.existsSync(at(f)) || fs.readFileSync(at(f), 'utf8') !== html).map(([f]) => f);
    check(!stale.length, `各语言页面头部与文案一致（${Object.keys(built).join('、')}）`, `${stale.join('、')} 与文案不一致（运行 node scripts/build-meta.js）`);
  }
  // 版权和商标声明：about.trademarks 列出的每个名字都要在 about.disclaimer 里出现
  const disc = (product.about && product.about.disclaimer) || '';
  const tms = (product.about && product.about.trademarks) || [];
  check(disc.trim() && tms.length && tms.every((x) => disc.includes(x)), `有商标声明（${tms.join('、')}）`, '缺少 about.disclaimer，或 about.trademarks 为空，或声明里没有写到 trademarks 里的名字');
  // 语言切换列表
  const langs = site.languages || [];
  check(langs.some((l) => l.code === site.langCode), `语言列表含本语言 ${site.langCode}`, `languages 里没有本语言 ${site.langCode}`);

  // 其他语言：与基准语言逐项对齐，不多不少
  const baseSite = readJson(at(BASE_SITE));
  if (at(BASE_SITE) !== at(site.__file || '')) {
    const baseUi = readJson(at(baseSite.ui));
    const extra = Object.keys(ui).filter((k) => !(k in baseUi)), lack = Object.keys(baseUi).filter((k) => !(k in ui));
    check(!extra.length && !lack.length, `界面文案键与 ${baseSite.ui} 一致`, `界面文案键与 ${baseSite.ui} 不一致：缺少 [${lack}]，多出 [${extra}]`);
    check(ui.shortcutList.length === baseUi.shortcutList.length, '快捷键说明条数一致', `快捷键说明条数 ${ui.shortcutList.length} ≠ ${baseUi.shortcutList.length}`);
    const ph = (v) => [...String(v).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    const badPh = Object.keys(baseUi).filter((k) => typeof baseUi[k] === 'string' && k in ui && ph(baseUi[k]) !== ph(ui[k]));
    check(!badPh.length, '界面文案占位符一致', `界面文案占位符与中文不一致：${badPh.join('，')}`);

    const bp = readJson(at(baseSite.product));
    const shape = (pr) => JSON.stringify({
      exact: pr.about.exact.items.length, notes: pr.about.notes.length,
      ex: pr.explainers.items.map((it) => it.points.length),
      safety: pr.safety ? Object.keys(pr.safety).sort().concat(pr.safety.page) : null, trademarks: pr.about.trademarks,
      links: pr.about.links.items.map((l) => [l.url, l.docId, l.article]), source: pr.about.links.source.url,
    });
    check(shape(product) === shape(bp), `产品文案结构与 ${baseSite.product} 一致`, `产品文案结构与 ${baseSite.product} 不一致（条目数、讲解要点数或链接不同）`);
    const nums = (file, heading) => { const t = sectionOf(fs.readFileSync(at(file), 'utf8'), heading); return (t.match(/^(\d+)\.\s/gm) || []).map((x) => parseInt(x, 10)).join(','); };
    const a = nums(bp.about.approximate.source, bp.about.approximate.heading), b = nums(ap.source, ap.heading);
    check(a === b, `近似清单编号与 ${bp.about.approximate.source} 一致（${b.split(',').length} 条）`, `近似清单编号与中文不一致：中文 [${a}]，本语言 [${b}]`);
    check(site.pieces.map((x) => x.key + x.url).join() === baseSite.pieces.map((x) => x.key + x.url).join(), '件列表与基准一致', '件列表（key、数据文件）与基准语言不一致');
  }

  // 装配数据译文：每个要显示的名称和说明都要有，不能有数据里没有的键
  for (const piece of site.pieces.filter((x) => x.i18n)) {
    if (!exists(piece.i18n)) { errors.push(`译文文件不存在：${piece.i18n}`); continue; }
    const d = readJson(at(piece.url)), o = readJson(at(piece.i18n));
    const miss = [], unknown = [];
    const need = (cond, what) => { if (!cond) miss.push(what); };
    need(o.title, 'title');
    if (d.variantTitle) need(o.variantTitle, 'variantTitle');
    if (d.note) need(o.note, 'note');
    if (d.notes) need(o.notes && o.notes.length === d.notes.length, 'notes');
    for (const x of d.extras || []) need(o.extras && o.extras[x.id] && o.extras[x.id].name, `extras.${x.id}`);
    if (d.schema && d.schema.startsWith('flatpack3d/room')) for (const k of Object.keys(d.variants)) need(o.variants && o.variants[k] && o.variants[k].label && o.variants[k].note, `variants.${k}`);
    if (d.schema && d.schema.startsWith('flatpack3d/set')) need(o.layoutSource, 'layoutSource');
    else if (d.schema && d.schema.startsWith('flatpack3d/room')) { /* Room 只有标题、说明和方案名 */ }
    else {
      need(o.scope, 'scope');
      need(o.overview && o.overview.title && o.overview.hint, 'overview');
      for (const st of d.steps) {
        const k = st.variant ? `${st.variant}:${st.n}` : String(st.n);
        need(o.steps && o.steps[k] && o.steps[k].title && o.steps[k].hint, `steps.${k}`);
        // 动作依据的译文也要点名同样的页
        if (st.motionNote) need(o.steps && o.steps[k] && o.steps[k].motionNote && (st.motions || []).every((m) => o.steps[k].motionNote.includes(`p${m.page}`)), `steps.${k}.motionNote`);
      }
      for (const pt of d.parts) need(o.parts && o.parts[pt.id], `parts.${pt.id}`);
      for (const k of Object.keys(d.partTypes)) need(o.partTypes && o.partTypes[k] && o.partTypes[k].name, `partTypes.${k}`);
      for (const h of d.hardware) { need(o.hardware && o.hardware[h.id] && o.hardware[h.id].name, `hardware.${h.id}`); if (h.unit) need(o.hardware && o.hardware[h.id] && o.hardware[h.id].unit, `hardware.${h.id}.unit`); }
      for (const k of Object.keys(d.variants || {})) need(o.variants && o.variants[k] && o.variants[k].label, `variants.${k}`);
      for (const [k, v] of Object.entries(d.poses || {})) if (v && v.label) need(o.poses && o.poses[k] && o.poses[k].label, `poses.${k}`);
      const words = new Set(d.steps.flatMap((st) => st.tools || []).filter((x) => !/^\d+$/.test(x)));
      for (const wd of words) need(o.tools && o.tools[wd], `tools.${wd}`);
      const stepKeys = new Set(d.steps.map((st) => (st.variant ? `${st.variant}:${st.n}` : String(st.n))));
      for (const k of Object.keys(o.steps || {})) if (!stepKeys.has(k)) unknown.push(`steps.${k}`);
      for (const k of Object.keys(o.parts || {})) if (!d.parts.some((pt) => pt.id === k)) unknown.push(`parts.${k}`);
      for (const k of Object.keys(o.hardware || {})) if (!d.hardware.some((h) => h.id === k)) unknown.push(`hardware.${k}`);
    }
    check(!miss.length && !unknown.length, `${piece.i18n} 译文完整`,
      `${piece.i18n}：${miss.length ? `缺少 ${miss.slice(0, 12).join('、')}${miss.length > 12 ? ` 等 ${miss.length} 项` : ''}` : ''}${unknown.length ? `；数据里没有的键 ${unknown.join('、')}` : ''}`);
  }
  return { errors, passes, summary: `界面文案 ${Object.keys(ui).length} 项；官方 PDF 链接 ${links.length} 个；近似清单 ${items} 条` };
}

// ---------------- 入口 ----------------
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const onlyProduct = (flags.find((a) => a.startsWith('--product=')) || '').split('=')[1] || null;
const products = listProducts();
const defaultId = buildIndex().default;
let failed = 0;
if (!products.length) { console.error('data/ 下没有产品（data/<id>/manifest.json）'); process.exit(1); }
// 每份要校验的文件：{ file, product, md }
const jobs = [];
if (args.length) {
  const file = path.resolve(args[0]);
  const prod = products.find((x) => file.startsWith(path.join(root, x.dir) + path.sep)) || products[0];
  jobs.push({ file, prod, report: path.resolve(args[1] || path.join(root, prod.analysis)) });
} else {
  for (const prod of products.filter((x) => !onlyProduct || x.id === onlyProduct)) {
    const report = path.join(root, prod.analysis);
    const sites = Object.values(prod.sites);
    const pieces = [...new Set(sites.flatMap((f) => readJson(path.join(root, f)).pieces.map((x) => x.url)))];
    for (const f of [...pieces, ...sites]) jobs.push({ file: path.join(root, f), prod, report });
  }
  // 产品索引要与 data/*/manifest.json 一致
  const idx = path.join(root, 'data', 'products.json');
  const fresh = fs.existsSync(idx) && fs.readFileSync(idx, 'utf8') === JSON.stringify(buildIndex(), null, 2) + '\n';
  if (fresh) console.log(`✔ data/products.json：${products.map((x) => x.id).join('、')}，默认 ${defaultId}\n`);
  else { failed++; console.log('✘ data/products.json 与 data/*/manifest.json 不一致（运行 node scripts/build-index.js）\n'); }
  // 技能有两份：skills/manual-to-3d（发布用）和 .claude/skills/manual-to-3d（Claude Code 自动识别），内容必须一样
  const skillSrc = path.join(root, 'skills', 'manual-to-3d'), skillDst = path.join(root, '.claude', 'skills', 'manual-to-3d');
  if (fs.existsSync(skillSrc)) {
    const list = (d, base = d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? list(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name))])) : []);
    const a = list(skillSrc), b = list(skillDst);
    const diff = [...a.filter((f) => !b.includes(f) || !fs.readFileSync(path.join(skillSrc, f)).equals(fs.readFileSync(path.join(skillDst, f)))), ...b.filter((f) => !a.includes(f))];
    if (diff.length) { failed++; console.log(`✘ .claude/skills/manual-to-3d 与 skills/manual-to-3d 不一致：${diff.slice(0, 8).join('、')}（运行 node scripts/flatpack.js sync-skill）\n`); }
    else console.log(`✔ 技能两份一致（${a.length} 个文件）\n`);
  }
}
let lastReport = '';
for (const { file, prod, report } of jobs) {
  if (report !== lastReport) { console.log(`== 产品 ${prod.id}，报告：${rel(report)}\n`); lastReport = report; }
  if (!fs.existsSync(report)) { failed++; console.log(`✘ 报告不存在：${rel(report)}\n`); continue; }
  const md = fs.readFileSync(report, 'utf8');
  const data = readJson(file);
  if (data.pieces) data.__file = path.relative(root, file).split(path.sep).join('/');
  const ctx = { manifest: prod, baseSite: prod.sites.zh || Object.values(prod.sites)[0], isDefault: prod.id === defaultId };
  const res = data.pieces ? validateSite(data, root, ctx)
    : data.schema && data.schema.startsWith('flatpack3d/room') ? validateRoom(data, root)
    : data.schema && data.schema.startsWith('flatpack3d/set') ? validateSet(data, root) : validateAssembly(data, md, file);
  const head = `${rel(file)}${data.source && data.source.reportSection ? `（报告 ${data.source.reportSection.replace('## ', '第 ').replace('.', ' 节')}）` : ''}`;
  if (res.errors.length) {
    failed++;
    console.log(`✘ ${head}\n  ${res.summary}\n  通过 ${res.passes.length} 项，发现 ${res.errors.length} 处不一致：`);
    for (const e of res.errors) console.log(`    - ${e}`);
  } else {
    console.log(`✔ ${head}\n  ${res.summary}\n  通过 ${res.passes.length} 项检查`);
  }
  if (flags.includes('--verbose')) for (const x of res.passes) console.log(`    · ${x}`); // 列出每一项通过的检查
  console.log('');
}
(async () => {
  if (!args.length && !flags.includes('--no-framing')) {
    const { run } = require('./check-framing');
    for (const job of [{ lang: '' }, { lang: 'en', sizes: ['desktop', 'mobile'] }]) {
      const res = await run({ ...job, product: onlyProduct, quiet: true });
      const tag = `取景截图检查（${job.lang || 'zh'}）`;
      if (res.failures.length) {
        failed++;
        console.log(`✘ ${tag}：${res.checked} 张截图，${res.failures.length} 张不合格（${rel(res.outDir)}）`);
        for (const f of res.failures) console.log(`    - [${f.size}] ${f.name}：${f.problems.join('；')}`);
      } else console.log(`✔ ${tag}：${res.checked} 张截图全部合格（${rel(res.outDir)}）`);
    }
    console.log('');
  }
  if (failed) { console.error(`${failed} 项未通过`); process.exit(1); }
  console.log('全部一致');
})().catch((e) => { console.error(e.message); process.exit(1); });
