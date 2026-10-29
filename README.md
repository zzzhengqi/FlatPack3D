<p><img src="brand/steam-icon-128.png" width="64" height="64" alt="蒸汽 ZHENGQI"></p>

# FlatPack3D

中文 | [English](README.en.md)

> **v0.1.1 预览版，欢迎反馈问题**：[提 Issue](https://github.com/zzzhengqi/FlatPack3D/issues)。

## 三步开始

1. **新建一个空文件夹**，在里面建 `inputs/`，放入说明书 PDF（可选：商品图；商品页链接写进 `inputs/links.txt`）。
2. **复制下面这段话发给你的 Agent**（Claude Code、Codex 等），在这个文件夹里打开它：

   ```text
   请帮我把这个文件夹里的产品说明书做成可交互的 3D 说明书。
   - 资料在 inputs/ 文件夹里（说明书 PDF，可能还有商品图片和商品页链接）。
   - 工具和流程在这里：https://github.com/zzzhengqi/FlatPack3D/blob/v0.1.1/AGENTS.md
     请先读它，严格按里面的流程做。
     如果你打不开网页，就用 git 下载 https://github.com/zzzhengqi/FlatPack3D 的 v0.1.1 版本，再读里面的 AGENTS.md。
   - 需要安装软件，或流程要求我确认的地方，先停下来问我。
   - 做完告诉我怎么打开查看。
   ```

3. **Agent 会在两个确认点停下来问你**（零件和五金数量、说明书与 3D 的对照图），照实回答即可。

Agent 会把工具下载到这个文件夹的 `FlatPack3D/` 子目录，缺软件（Node.js、Python、Chrome/Edge）时先问你再装。你的说明书和图片只留在这个文件夹里，不会提交到任何仓库。

## 这是什么

把家具的纸质 / PDF 装配说明书，做成可交互的 3D 分步装配演示：逐步动画、五金计数、说明书对照、放大圆圈（线稿风格，像说明书的放大图）、线稿视图、中英文界面。

仓库里有两样东西：

1. **引擎和工具**：单文件 Three.js 页面 `index.html`，以及构建、校验、截图检查、对照图脚本（`scripts/`，命令入口 `scripts/flatpack.js`）。引擎与具体家具无关。
2. **技能 `manual-to-3d`**：把"说明书 → 3D 说明书"的完整流程写成 Agent 能照着做的说明（`skills/manual-to-3d/`）。技能只有说明文字，用的工具都在本仓库里；Agent 发现当前文件夹不是本仓库时，会先把 v0.1.1 下载到子目录 `FlatPack3D/`。

示例产品：宜家 KALLAX 置物架（5×5，两种上墙方案）+ 门嵌件（铰链在左 / 在右）+ 双抽屉嵌件 + 全套 + 靠墙摆放（Room 视图）。见 `skills/manual-to-3d/examples/kallax/`。

> **说明书和商品图不在仓库里。** 说明书 PDF、说明书页面图、商品图版权归原厂。你自己的说明书 PDF 和商品图放在 `inputs/`（在 `.gitignore` 里，不会入库）。没有页面图时，页面左侧的说明书面板显示页码和官方 PDF 链接，其余功能照常；在本机渲染页面图后自动显示图片。

> **安全提示（KALLAX）**：说明书的第一条警告（p2）是家具倾倒可能造成严重甚至致命的压伤，必须用附带的上墙固定配件把柜体固定在墙上；墙用螺钉和螺塞不随包装提供，要按墙体材质另购。本演示只是示意，实际安装请以官方说明书为准。

## Claude Code 安装技能（可选）

"三步开始"不需要这一步。想在任何文件夹里直接说"用 manual-to-3d 把 inputs/ 里的说明书做成 3D 说明书"，就把技能复制到用户主目录下的 `.claude/skills/`。在克隆下来的仓库目录里运行：

```powershell
# Windows PowerShell
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null
Copy-Item -Recurse -Force skills\manual-to-3d "$HOME\.claude\skills\"
```

```bash
# macOS / Linux
mkdir -p ~/.claude/skills && cp -R skills/manual-to-3d ~/.claude/skills/
```

在仓库目录里打开 Claude Code 时，不复制也能用（仓库自带 `.claude/skills/manual-to-3d/`）。其他 Agent（Codex、Cursor、Gemini CLI 等）不用安装，让它先读仓库根目录的 `AGENTS.md`。

## 开发者：克隆整个仓库

需要：[Node.js](https://nodejs.org/) 22 或以上；Python 3 和 `pip install pymupdf opencv-python pillow numpy`（渲染说明书页面、对照图）；本机 Chrome 或 Edge（截图检查）。

```bash
git clone --depth 1 --branch v0.1.1 https://github.com/zzzhengqi/FlatPack3D.git
cd FlatPack3D
node scripts/flatpack.js doctor
```

没装 git：下载 [v0.1.1 的 zip](https://github.com/zzzhengqi/FlatPack3D/archive/refs/tags/v0.1.1.zip)，解压后进入 `FlatPack3D-0.1.1/`。要参与开发就克隆 `main` 分支（去掉 `--depth 1 --branch v0.1.1`）。

## 打开看看

- **Windows**：双击 `start.bat`（启动本地服务 8137 端口，被占用时自动换一个，并打开浏览器）。
- **任何系统**：`node scripts/flatpack.js serve 8137 --open`。

页面要用 `fetch` 读 JSON，不能直接双击 `index.html`。中文页 `http://localhost:8137/`，英文页 `http://localhost:8137/en/`。

| 地址参数 | 例子 | 说明 |
|---|---|---|
| `product` | `?product=kallax` | 产品；不写打开 `data/products.json` 的默认产品 |
| `piece` | `?piece=door` | 件：KALLAX 有 `body`、`door`、`drawer`、`set`、`room` |
| `variant` | `?piece=door&variant=right` | 路线（KALLAX 门嵌件 `left` / `right`，主体和 Room `a` / `b`） |
| `step` | `?piece=body&step=12` | 定位到说明书第 12 步；`0` 是清点零件 |
| `lang` | `?lang=en` | 界面语言；也可以直接打开 `en/` |

快捷键见页面右上角"快捷键"。拖动或缩放画面会暂停自动取景（单击不会），按 `R` 或"全景"恢复。

## 常用命令

都在仓库根目录运行：

```bash
node scripts/flatpack.js doctor                    # 检查环境：Node 22+、Python 包、Chrome/Edge
node scripts/flatpack.js new my-shelf --title=书架   # 新建产品骨架 data/my-shelf/，本机目录 inputs/my-shelf/
node scripts/flatpack.js render my-shelf            # 渲染 inputs/my-shelf/ 下的 PDF
node scripts/flatpack.js build my-shelf             # 运行构建脚本，生成装配数据
node scripts/flatpack.js validate --product=my-shelf   # 对照分析报告校验 + 取景检查
node scripts/flatpack.js review my-shelf            # 说明书 ↔ 3D 对照图
```

新家具只需要在 `data/<产品>/` 下放数据和构建脚本，引擎、校验、取景检查都不用改。

## 目录

```
index.html, en/index.html   引擎（en/ 由 scripts/build-meta.js 生成）
vendor/three@0.160.0/       three.js r160（MIT，见目录里的 LICENSE），离线可用
data/products.json          产品索引（scripts/build-index.js 生成）
data/ui.zh.json, ui.en.json 引擎界面文案
data/<产品>/                产品数据：清单、分析报告、尺寸来源、构建脚本、装配数据、文案、译文、分享图
scripts/                    工具：命令入口 flatpack.js、构建、校验、取景检查、渲染说明书页面、分享图、对照图与视频（review/）
skills/manual-to-3d/        技能：SKILL.md、references/、examples/
.claude/skills/manual-to-3d/  技能的副本（在仓库里打开 Claude Code 时自动识别；改技能后运行 flatpack.js sync-skill）
brand/                      蒸汽 / ZHENGQI 标识（不在 MIT 许可范围内，见 LICENSE）
inputs/ renders/ exports/   本机目录，不入库：你的说明书和商品图、渲染出的页面图、对照图和视频
```

## 关于"内部代号"

说明书只给五金编号，大多不给板件编号。点 3D 里的零件时显示的"内部代号"（如 `divider-r3-2`）是本项目数据里的 `id`，不是厂家件号。

## 许可

代码以 [MIT 许可](LICENSE) 发布。`brand/` 里的蒸汽 / ZHENGQI 标识不在 MIT 许可范围内，未经许可不得使用；`vendor/three@0.160.0/` 是 three.js 自己的 MIT 许可。

## 声明

本项目与 IKEA 无关，未经 IKEA 认可；KALLAX 和 IKEA 是 Inter IKEA Systems B.V. 的商标。示例数据是根据公开的装配说明书自己整理的，说明书原件请从官方链接下载（见 `data/kallax/manifest.json`）。

by 蒸汽（ZHENGQI）
