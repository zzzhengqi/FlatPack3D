#!/usr/bin/env node
// manual-to-3d 技能的命令入口：找到 FlatPack3D 仓库，调用仓库里的脚本。
// 用法：node skills/manual-to-3d/scripts/flatpack.js <命令> [参数]
//   doctor                                   检查前提（Node、Python 包、浏览器、仓库文件）
//   new <id> [--title=名称] [--no-en]          新建产品骨架 data/<id>/（能跑通的示例占位）
//   render <id> [--width=1000]               把 manuals/<id>/ 下的 PDF 渲染成 renders/<id>/<key>/pNN.png
//   build <id>                               运行产品的构建脚本，更新产品索引和页面头部
//   validate [--product=<id>] [--no-framing] [--verbose]   数据校验（默认最后跑取景检查）
//   framing [--product=<id>] [--lang=en] [--sizes=desktop,laptop,mobile] [--only=<件>]   取景和放大圆圈检查
//   review <id> [件[:路线] ...] [--all-variants]   视觉复查对照图 → exports/review/<id>/
//   og <id>                                  生成分享图
//   serve [端口] [--open]                     本地服务（默认 8137），地址加 ?product=<id>
//   video <输出.mp4> <id> <件> [路线]          复查视频（1920×1080，30fps）
//   sync-skill [--check]                     把 skills/manual-to-3d 复制到 .claude/skills/manual-to-3d（或只检查是否一致）
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// 仓库根目录：从当前目录和本脚本所在目录往上找，有 index.html、scripts/validate.js、vendor/three@* 的那一层
function findRoot() {
  for (const start of [process.cwd(), __dirname]) {
    for (let d = path.resolve(start); ; d = path.dirname(d)) {
      if (fs.existsSync(path.join(d, 'index.html')) && fs.existsSync(path.join(d, 'scripts', 'validate.js')) && fs.existsSync(path.join(d, 'vendor'))) return d;
      if (path.dirname(d) === d) break;
    }
  }
  return null;
}
const root = findRoot();
const [cmd, ...rest] = process.argv.slice(2);
const py = process.platform === 'win32' ? 'python' : 'python3';
const run = (exe, args) => { const r = spawnSync(exe, args, { cwd: root, stdio: 'inherit' }); process.exit(r.status === null ? 1 : r.status); };
const node = (script, args) => run(process.execPath, [path.join(root, script), ...args]);

if (!root) {
  console.error('找不到 FlatPack3D 仓库（要有 index.html、scripts/validate.js、vendor/）。请在仓库目录里运行，或先克隆 FlatPack3D 仓库。');
  process.exit(1);
}

function doctor() {
  const rows = [];
  const ok = (name, good, hint) => rows.push([good ? '✔' : '✘', name, good ? '' : hint]);
  const major = Number(process.versions.node.split('.')[0]);
  ok(`Node.js ${process.versions.node}`, major >= 22, '需要 Node.js 22 或以上（脚本用到内置 WebSocket 和 fetch）');
  const pyv = spawnSync(py, ['--version'], { encoding: 'utf8' });
  ok(`Python（${py}）`, pyv.status === 0, `找不到 ${py}；PDF 渲染和对照图需要 Python 3`);
  for (const [mod, pip] of [['pymupdf', 'pymupdf'], ['cv2', 'opencv-python'], ['PIL', 'pillow'], ['numpy', 'numpy']]) {
    const r = spawnSync(py, ['-c', `import ${mod}`], { encoding: 'utf8' });
    ok(`Python 包 ${pip}`, r.status === 0, `pip install ${pip}`);
  }
  let browser = null;
  try { browser = require(path.join(root, 'scripts', 'lib', 'headless.js')).findBrowser(); } catch { /* 旧版没有导出 */ }
  ok(`Chrome / Edge${browser ? `：${browser}` : ''}`, !!browser, '取景检查、截图要用本机 Chrome 或 Edge（可用环境变量 CHROME_PATH 指定）');
  ok('vendor/three@0.160.0', fs.existsSync(path.join(root, 'vendor', 'three@0.160.0', 'build', 'three.module.js')), '仓库不完整：缺 three.js');
  ok('data/products.json', fs.existsSync(path.join(root, 'data', 'products.json')), '运行 node scripts/build-index.js');
  const gi = fs.existsSync(path.join(root, '.gitignore')) ? fs.readFileSync(path.join(root, '.gitignore'), 'utf8') : '';
  ok('.gitignore 挡住 manuals/ renders/ refs/ exports/', ['manuals/', 'renders/', 'refs/', 'exports/'].every((x) => gi.includes(x)), '在 .gitignore 里加上 manuals/、renders/、refs/、exports/（说明书和商品图不能入库）');
  for (const [a, b, c] of rows) console.log(`${a} ${b}${c ? `  → ${c}` : ''}`);
  console.log(`仓库：${root}`);
  process.exit(rows.some((r) => r[0] === '✘') ? 1 : 0);
}

function syncSkill(check) {
  const src = path.join(root, 'skills', 'manual-to-3d');
  const dst = path.join(root, '.claude', 'skills', 'manual-to-3d');
  const list = (d, base = d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? list(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name))])) : [];
  const a = list(src).sort(), b = list(dst).sort();
  const diff = [...a.filter((f) => !b.includes(f) || !fs.readFileSync(path.join(src, f)).equals(fs.readFileSync(path.join(dst, f)))), ...b.filter((f) => !a.includes(f))];
  if (check) {
    console.log(diff.length ? `✘ .claude/skills/manual-to-3d 与 skills/manual-to-3d 不一致：${diff.join('、')}（运行 sync-skill）` : '✔ .claude/skills/manual-to-3d 与 skills/manual-to-3d 一致');
    process.exit(diff.length ? 1 : 0);
  }
  fs.rmSync(dst, { recursive: true, force: true });
  for (const f of a) { fs.mkdirSync(path.dirname(path.join(dst, f)), { recursive: true }); fs.copyFileSync(path.join(src, f), path.join(dst, f)); }
  console.log(`已复制 ${a.length} 个文件到 .claude/skills/manual-to-3d`);
}

switch (cmd) {
  case 'doctor': doctor(); break;
  case 'new': node('scripts/new-product.js', rest); break;
  case 'render': run(py, [path.join(root, 'scripts', 'render-pages.py'), ...rest]); break;
  case 'build': node('scripts/build.js', rest); break;
  case 'validate': node('scripts/validate.js', rest); break;
  case 'framing': node('scripts/check-framing.js', rest); break;
  case 'review': node('scripts/review/make-review.js', rest); break;
  case 'og': node('scripts/make-og-image.js', rest); break;
  case 'serve': node('scripts/serve.js', rest.length ? rest : ['8137']); break;
  case 'video': node('scripts/review/render-video.js', rest); break;
  case 'sync-skill': syncSkill(rest.includes('--check')); break;
  default:
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter((l) => l.startsWith('//')).slice(1, 15).map((l) => l.slice(3)).join('\n'));
    process.exit(cmd ? 1 : 0);
}
