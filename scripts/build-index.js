#!/usr/bin/env node
// 生成 data/products.json：扫描 data/*/manifest.json，列出所有产品和默认产品。新增产品后运行一次。
// 用法：node scripts/build-index.js [--default=<产品 id>]
'use strict';
const fs = require('fs');
const path = require('path');
const { root, buildIndex } = require('./lib/products');

const arg = (process.argv.find((a) => a.startsWith('--default=')) || '').split('=')[1] || null;
const index = buildIndex({ defaultId: arg });
const out = path.join(root, 'data', 'products.json');
const text = JSON.stringify(index, null, 2) + '\n';
if (process.argv.includes('--check')) {
  const ok = fs.existsSync(out) && fs.readFileSync(out, 'utf8') === text;
  console.log(ok ? 'data/products.json 已是最新' : 'data/products.json 与 data/*/manifest.json 不一致，请运行 node scripts/build-index.js');
  process.exit(ok ? 0 : 1);
}
fs.writeFileSync(out, text);
console.log(`已写入 data/products.json：${index.products.map((p) => p.id).join('、') || '（没有产品）'}；默认 ${index.default}`);
