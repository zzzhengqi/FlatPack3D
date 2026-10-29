// 产品（一套家具）的发现与读取：每个产品是 data/<id>/ 目录，里面有 manifest.json。
// 引擎、校验、取景检查都只通过这里找产品，不写死任何一个产品。
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const readJson = (p) => JSON.parse(fs.readFileSync(path.isAbsolute(p) ? p : path.join(root, p), 'utf8'));

// data/*/manifest.json，按目录名排序
function listProducts() {
  const dataDir = path.join(root, 'data');
  return fs.readdirSync(dataDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(dataDir, e.name, 'manifest.json')))
    .map((e) => e.name).sort()
    .map((id) => ({ ...readJson(`data/${id}/manifest.json`), dir: `data/${id}` }));
}

// data/products.json 的内容：页面靠它知道有哪些产品、默认打开哪个、各语言的站点文件
function buildIndex({ defaultId = null } = {}) {
  const products = listProducts();
  const file = path.join(root, 'data', 'products.json');
  const prev = fs.existsSync(file) ? readJson(file) : {};
  const ids = products.map((p) => p.id);
  const def = (defaultId && ids.includes(defaultId) && defaultId) || (ids.includes(prev.default) && prev.default) || ids[0] || null;
  return {
    schema: 'flatpack3d/products@1',
    note: '由 scripts/build-index.js 按 data/*/manifest.json 生成，请勿手改',
    default: def,
    products: products.map((p) => ({ id: p.id, title: p.title, sites: p.sites })),
  };
}

function getProduct(id) {
  const all = listProducts();
  const p = id ? all.find((x) => x.id === id) : all.find((x) => x.id === buildIndex().default);
  if (!p) throw new Error(`找不到产品 ${id || '(默认)'}：data/${id || '?'}/manifest.json 不存在`);
  return p;
}

module.exports = { root, readJson, listProducts, buildIndex, getProduct };
