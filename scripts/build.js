#!/usr/bin/env node
// 生成一个产品的全部数据：按 manifest.json 的 build 列表依次运行构建脚本，再更新产品索引和页面头部。
// 用法：node scripts/build.js <产品 id>      例：node scripts/build.js kallax
//       node scripts/build.js --all
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const { root, listProducts } = require('./lib/products');

const run = (args) => {
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (r.status) process.exit(r.status);
};
const want = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const all = listProducts();
const list = process.argv.includes('--all') ? all : all.filter((p) => want.includes(p.id));
if (!list.length) {
  console.error(`用法：node scripts/build.js <产品 id> | --all。已有产品：${all.map((p) => p.id).join('、') || '（没有）'}`);
  process.exit(1);
}
for (const p of list) {
  console.log(`== ${p.id}`);
  for (const script of p.build || []) run([path.join(root, script)]);
}
run([path.join(root, 'scripts', 'build-index.js')]);
run([path.join(root, 'scripts', 'build-meta.js')]);
