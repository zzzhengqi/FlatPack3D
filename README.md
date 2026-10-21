# FlatPack3D

把平板家具的纸质/PDF 装配说明书，转换成可交互的 3D 分步装配演示。

当前样例：宜家 KALLAX 置物架主体（5×5，含两种上墙固定方案）、门嵌件（铰链在左 / 铰链在右）、双抽屉嵌件、"全套"（主体 + 5 门 + 5 双抽屉），以及靠墙摆放的 Room 视图。界面有中文和英文。

> **安全提示**：说明书的第一条警告（p2）是家具倾倒可能造成严重甚至致命的压伤，必须用附带的上墙固定配件把柜体固定在墙上。墙用螺钉和螺塞不随包装提供，要按墙体材质另购。本演示只是示意，实际安装请以宜家说明书为准。

## 快速打开（Windows）

双击项目根目录的 **`start.bat`**：它会启动本地服务（端口 8137，被占用时自动换一个）并用默认浏览器打开页面。
需要 Node.js 22 或以上（没有 Node 时退回用 Python 的 `http.server`）。关闭弹出的命令行窗口即停止服务。
中文页是 `http://localhost:8137/`，英文页是 `http://localhost:8137/en/`，两页右上角可以互相切换。

## 运行

```bash
python scripts/render-pages.py        # 首次：把 manuals/ 里的 PDF 渲染到 renders/（需 pip install pymupdf）
node scripts/build-kallax-body.js     # 生成 data/kallax-body.json
node scripts/build-kallax-inserts.js  # 生成门、抽屉、全套数据
node scripts/validate.js              # 校验：数据对照分析报告、中英文案对齐、逐步截图检查取景；不一致时退出码为 1
node scripts/serve.js 8137 --open      # 本地服务并打开浏览器（start.bat 就是调用它）
node scripts/build-meta.js            # 按中英文产品文案生成 index.html 和 en/index.html 的分享信息
node scripts/make-og-image.js         # 用无头 Chrome 生成 og-image.png、og-image.en.png（自带本地服务）
```

- **离线可用**：three.js r160 和 OrbitControls 放在 `vendor/three@0.160.0/`（MIT 许可，见该目录的 LICENSE），页面不引用任何外网资源。页面要用 `fetch` 读 JSON，所以仍需本地 HTTP 服务打开，不能直接双击 `index.html`（`file://`）。
- **校验需要浏览器**：`validate.js` 最后一步会用本机的 Chrome / Edge（无头模式）截图检查取景，截图存到 `renders/framing/`。没有浏览器或只想查数据时用 `node scripts/validate.js --no-framing`；单独跑取景检查用 `node scripts/check-framing.js [--lang=en] [--only=door] [--sizes=desktop,mobile]`。

## 地址参数

| 参数 | 例子 | 说明 |
|---|---|---|
| `piece` | `?piece=door` | 件：`body` 主体、`door` 门嵌件、`drawer` 抽屉嵌件、`set` 全套、`room` 靠墙摆放 |
| `variant` | `?piece=door&variant=right` | 路线：门嵌件 `left` 铰链在左、`right` 铰链在右；主体和 Room `a` 墙固定件、`b` L 形角码 |
| `step` | `?piece=body&step=12` | 直接定位到说明书第 12 步；`0` 是清点零件。切换步骤时地址栏会跟着更新 |
| `lang` | `?lang=en` | 界面语言；不写为中文。英文也可以直接打开 `en/` 页面，右上角可切换 |

## 操作

- **自动取景**：切步骤时自动把当前零件放进画面空白处；拖动或缩放画面后暂停（按钮显示"已暂停"），按 `R` 或"全景"恢复。
- **Room 视图**（"靠墙摆放"）：地面加一面墙，全套靠墙放，墙上用青色轮廓标出柜体和固定件的最终位置（轮廓会透过柜体显示）。`W`/`S` 前后、`A`/`D` 左右移动，`Q`/`E` 左右转向，鼠标照常旋转缩放。
- 其他快捷键见页面右上角"快捷键"：`[` `]` 上一步/下一步、`0`–`9` 跳步、空格播放当前步、`C` 连播、`X` 爆炸视图、`N` 零件标签、`L` 线稿视图。

## 关于"内部代号"

说明书只给五金编号（如 101339 木销），**没有给木板件编号**。点 3D 里的木板时显示的"内部代号"（如 `divider-r3-2`、`drawer1-front`）是本项目数据里的 `id`，只用来在数据、校验和界面之间对应零件，不是宜家件号。

## 目录

```
manuals/          原始说明书 PDF（已 gitignore，不入库）
renders/          PDF 逐页渲染图、取景检查截图（已 gitignore，由脚本生成）
refs/             商品参考图片（不入库）
vendor/           本地化的第三方库（three.js r160）
docs/analysis/    说明书分析报告（数据的基准）
docs/spec.md      装配数据 JSON 规范
docs/dimensions.md     尺寸来源与近似值（中文，猜测清单的原文）
docs/dimensions.en.md  猜测清单的英文译文
en/index.html     英文页（由 scripts/build-meta.js 从 index.html 生成，请勿手改）
start.bat         Windows 双击启动
data/             装配数据 JSON；site*.json、ui.*.json、kallax-product*.json 是界面和产品文案；i18n/ 是装配数据的英文译文
scripts/          生成、校验、截图检查、渲染脚本
index.html        单文件 Three.js 引擎：顶部切换"件"（主体/门/抽屉/全套）
```
