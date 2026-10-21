#!/usr/bin/env node
// 本地静态服务：在项目根目录提供页面，默认端口 8137（被占用时自动换一个空闲端口）。
// 用法：node scripts/serve.js [端口] [--open]   --open 时用系统默认浏览器打开
'use strict';
const path = require('path');
const { spawn } = require('child_process');
const { startStaticServer } = require('./lib/headless');

const root = path.resolve(__dirname, '..');
const port = Number(process.argv.find((a) => /^\d+$/.test(a)) || 8137);

function open(url) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
}

(async () => {
  let server;
  try { server = await startStaticServer(root, port); }
  catch { server = await startStaticServer(root, 0); } // 端口被占用
  const url = server.url.replace('127.0.0.1', 'localhost');
  console.log(`FlatPack3D 本地服务已启动：${url}（中文） ${url}en/（English）`);
  console.log('关闭这个窗口或按 Ctrl+C 即停止。');
  if (process.argv.includes('--open')) open(url);
})();
