<p><img src="brand/steam-icon-128.png" width="64" height="64" alt="蒸汽 ZHENGQI"></p>

# FlatPack3D

把家具的纸质 / PDF 装配说明书，做成可交互的 3D 分步装配演示：逐步动画、五金计数、说明书对照、放大圆圈（线稿风格，像说明书的放大图）、线稿视图、中英文界面。

仓库里有两样东西：

1. **引擎**：单文件 Three.js 页面 `index.html`，以及校验、截图检查、对照图脚本。引擎与具体家具无关。
2. **技能 `manual-to-3d`**：把"说明书 → 3D 说明书"的完整流程写成 Agent 能照着做的技能（`skills/manual-to-3d/`）。把产品说明书交给 Agent，它按 8 个阶段、两个人工确认点做出同等质量的 3D 说明书。

示例产品：宜家 KALLAX 置物架（5×5，两种上墙方案）+ 门嵌件（铰链在左 / 在右）+ 双抽屉嵌件 + 全套 + 靠墙摆放（Room 视图）。见 `skills/manual-to-3d/examples/kallax/`。

> **说明书和商品图不在仓库里。** 说明书 PDF、说明书页面图、商品图版权归原厂，只放在本机的 `manuals/`、`renders/`、`refs/`（都在 `.gitignore` 里）。没有页面图时，页面左侧的说明书面板显示页码和官方 PDF 链接，其余功能照常；在本机渲染页面图后自动显示图片。

> **安全提示（KALLAX）**：说明书的第一条警告（p2）是家具倾倒可能造成严重甚至致命的压伤，必须用附带的上墙固定配件把柜体固定在墙上；墙用螺钉和螺塞不随包装提供，要按墙体材质另购。本演示只是示意，实际安装请以官方说明书为准。

## 打开看看

- **Windows**：双击 `start.bat`（启动本地服务 8137 端口，被占用时自动换一个，并打开浏览器）。
- **任何系统**：`node scripts/serve.js 8137 --open`（需要 Node.js 22 或以上）。

页面要用 `fetch` 读 JSON，不能直接双击 `index.html`。中文页 `http://localhost:8137/`，英文页 `http://localhost:8137/en/`。

| 地址参数 | 例子 | 说明 |
|---|---|---|
| `product` | `?product=kallax` | 产品；不写打开 `data/products.json` 的默认产品 |
| `piece` | `?piece=door` | 件：KALLAX 有 `body`、`door`、`drawer`、`set`、`room` |
| `variant` | `?piece=door&variant=right` | 路线（KALLAX 门嵌件 `left` / `right`，主体和 Room `a` / `b`） |
| `step` | `?piece=body&step=12` | 定位到说明书第 12 步；`0` 是清点零件 |
| `lang` | `?lang=en` | 界面语言；也可以直接打开 `en/` |

快捷键见页面右上角"快捷键"。拖动或缩放画面会暂停自动取景（单击不会），按 `R` 或"全景"恢复。

## 用技能做一套新的 3D 说明书

Claude Code 会自动识别 `.claude/skills/manual-to-3d/`；其他 Agent 从根目录的 `AGENTS.md` 进入。人也可以照着 `skills/manual-to-3d/SKILL.md` 做。

```bash
node skills/manual-to-3d/scripts/flatpack.js doctor                    # 检查环境：Node 22+、Python 包、Chrome/Edge
node skills/manual-to-3d/scripts/flatpack.js new my-shelf --title=书架   # 新建产品骨架 data/my-shelf/
node skills/manual-to-3d/scripts/flatpack.js render my-shelf            # 渲染 manuals/my-shelf/ 下的 PDF
node skills/manual-to-3d/scripts/flatpack.js build my-shelf             # 运行构建脚本，生成装配数据
node skills/manual-to-3d/scripts/flatpack.js validate --product=my-shelf   # 对照分析报告校验 + 取景检查
node skills/manual-to-3d/scripts/flatpack.js review my-shelf            # 说明书 ↔ 3D 对照图
```

新家具只需要在 `data/<产品>/` 下放数据和构建脚本，引擎、校验、取景检查都不用改。

## 目录

```
index.html, en/index.html   引擎（en/ 由 scripts/build-meta.js 生成）
vendor/three@0.160.0/       three.js r160（MIT，见目录里的 LICENSE），离线可用
data/products.json          产品索引（scripts/build-index.js 生成）
data/ui.zh.json, ui.en.json 引擎界面文案
data/kallax/                示例产品：清单、分析报告、尺寸来源、构建脚本、装配数据、文案、译文、分享图
scripts/                    引擎工具：构建、校验、取景检查、渲染说明书页面、分享图、对照图与视频（review/）
skills/manual-to-3d/        技能：SKILL.md、references/、scripts/、examples/
.claude/skills/manual-to-3d/  技能的副本（供 Claude Code 自动识别；改技能后运行 flatpack.js sync-skill）
brand/                      蒸汽 / ZHENGQI 标识（权利见 brand/README.md）
manuals/ renders/ refs/ exports/   本机目录，不入库
```

## 关于"内部代号"

说明书只给五金编号，大多不给板件编号。点 3D 里的零件时显示的"内部代号"（如 `divider-r3-2`）是本项目数据里的 `id`，不是厂家件号。

## 声明

本项目与 IKEA 无关，未经 IKEA 认可；KALLAX 和 IKEA 是 Inter IKEA Systems B.V. 的商标。示例数据是根据公开的装配说明书自己整理的，说明书原件请从官方链接下载（见 `data/kallax/manifest.json`）。

by 蒸汽（ZHENGQI）
