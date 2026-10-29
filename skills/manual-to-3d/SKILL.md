---
name: manual-to-3d
description: 把产品的装配说明书（PDF、商品页尺寸、产品图片）做成可交互的 3D 分步装配演示网页（基于 FlatPack3D 引擎：逐步动画、五金计数、说明书对照、放大圆圈、线稿视图、中英文）。当用户给出家具或其他需要组装的产品的说明书资料，要求"做成 3D 说明书 / 3D 装配演示 / 交互式安装步骤"，或要在 FlatPack3D 仓库里新增、修改一套家具的数据时使用。不用于只问说明书内容、不需要 3D 演示的请求。
---

# manual-to-3d：把说明书做成 3D 说明书

用户把说明书资料交给你，你按下面 8 个阶段做出一套与 KALLAX 示例同等质量的 3D 说明书。每个阶段都有**完成标准**，没达到就不进入下一阶段。有两个**确认点**，到了必须停下来等用户回复。

## 开始之前

### 前提

1. **FlatPack3D 仓库**：本技能只有说明文字，不带工具；引擎（`index.html`）、校验、截图检查和命令入口 `scripts/flatpack.js` 都在 FlatPack3D 仓库里。先判断当前文件夹是不是仓库：根目录同时有 `index.html`、`scripts/flatpack.js`、`vendor/three@0.160.0/`。
   - **是**：直接在这里做。
   - **当前文件夹下已经有 `FlatPack3D/`**（以前克隆过）：进入它，不要重复克隆。
   - **都不是**：在当前文件夹里克隆 v0.1.0，然后进入 `FlatPack3D/`，后面所有命令都在那里运行：

     ```bash
     git clone --depth 1 --branch v0.1.0 https://github.com/zzzhengqi/FlatPack3D.git
     cd FlatPack3D
     ```

   - **没装 git**（`git --version` 报错）：从 Release 下载 zip 解压，解压出的文件夹叫 `FlatPack3D-0.1.0/`，进入它：

     ```bash
     # Windows PowerShell
     Invoke-WebRequest -Uri https://github.com/zzzhengqi/FlatPack3D/archive/refs/tags/v0.1.0.zip -OutFile FlatPack3D-0.1.0.zip
     Expand-Archive FlatPack3D-0.1.0.zip -DestinationPath .
     # macOS / Linux
     curl -L -o FlatPack3D-0.1.0.zip https://github.com/zzzhengqi/FlatPack3D/archive/refs/tags/v0.1.0.zip && unzip FlatPack3D-0.1.0.zip
     ```

   不要自己另写引擎，也不要把仓库里的脚本复制到别处运行。
2. **用户的资料放 `inputs/`**：说明书 PDF 放仓库里的 `inputs/<id>/`，商品图放 `inputs/<id>/images/`（`inputs/` 在 `.gitignore` 里，不会入库）。用户的资料原本在别处的（例如克隆前所在文件夹里的 `inputs/`），复制进来，不要移动或删除原件。用户自己的产品数据放 `data/<id>/`。
3. 运行环境检查，全部 ✔ 再开始：

   ```bash
   node scripts/flatpack.js doctor
   ```

   需要：Node.js ≥ 22；Python 3 和 `pip install pymupdf opencv-python pillow numpy`；本机 Chrome 或 Edge（截图检查用，可用环境变量 `CHROME_PATH` 指定）。
4. 下文的命令都写成 `flatpack <命令>`，意思是在仓库根目录运行 `node scripts/flatpack.js <命令>`。

### 规矩（整个流程都要守）

- **结论只来自资料**：说明书页面、商品页、用户给的图片。看不清的写"**不确定**"，按图推断的写"根据图示判断"，**不要凭经验补**（例如铰链装哪边、"2x"是什么意思，都要回到页面上找依据，见 `references/pitfalls.md`）。
- **资料不入库**：说明书 PDF 放 `inputs/<产品>/`，商品图放 `inputs/<产品>/images/`，页面图在 `renders/<产品>/`，对照图和视频在 `exports/`，这些目录都在 `.gitignore` 里。仓库里只放自己写的数据、构建脚本、文档和 3D 截图。
- **文字不写进代码**：界面文字在 `data/ui.*.json`，产品文字在 `data/<产品>/product.*.json`、`site*.json`、`i18n/`。
- **每个数字有来源**：尺寸写进 `dimensions.md` 并标明是资料原文、读图近似还是猜测。
- **自己验证**：每改一次就跑校验和截图检查，看截图，不要让用户替你看。
- 引擎、校验、取景检查脚本**不需要为新家具修改**。如果发现非改不可，先停下来告诉用户原因。

## 阶段 1：收资料

做什么：
1. 新建产品骨架（`id` 用小写字母、数字、连字符，例如 `hemnes-bed`）：

   ```bash
   flatpack new <id> --title=产品名称
   ```

   它会生成一个能跑通的示例占位（一张小桌），并生成分享图、更新产品索引。先运行 `flatpack validate --product=<id>`，应当全部通过——这说明环境正常。之后每个文件里的示例内容都要换掉。

   打开页面看：`flatpack serve 8137 --open`，地址后加 `?product=<id>`（要让它成为默认产品：`node scripts/build-index.js --default=<id>`）。

   > 从这里开始到阶段 4 换掉示例件之前，校验会因为示例占位和真实资料对不上而报错，这是正常的。
2. 把说明书 PDF 放到 `inputs/<id>/`，商品图放到 `inputs/<id>/images/`（`flatpack new` 已经建好这两个目录）。
3. 在 `data/<id>/manifest.json` 的 `sources` 里登记每份资料（格式见 `references/spec.md`"产品目录"一节）：
   - `manuals[]`：`key`（短名，例如 `shelf`）、`file`（PDF 文件名）、`docId`（说明书上的文档号，没有就写版本或日期）、`url`（官方下载地址）、`pages`（总页数）。
   - `productPages[]`：商品页地址和 `used`（从这一页取了什么，例如"整体尺寸"）。
   - `images`：商品图目录和来源页。
4. 渲染页面图：

   ```bash
   flatpack render <id>            # 约 1000 px 宽；看细节时加 --width=2000
   ```

完成标准：
- [ ] 每份资料都有来源链接（用户只给了文件、没给链接的，问用户要；问不到就写"用户提供，来源未知"）。
- [ ] `flatpack render <id>` 没有报"缺少 PDF"，打印的页数与 `pages` 一致。
- [ ] 删掉 `manifest.json` 里的示例占位条目。

## 阶段 2：只读分析

逐页看页面图（`renders/<id>/<key>/pNN.png`），写 `data/<id>/analysis.md`。格式要严格按 `references/report-format.md`，校验脚本靠这些表格核对数据。

每份说明书一节（`## 1. <key>：名称`），写：
- **零件清单**：说明书的零件清单页（没有就从步骤图认），每种零件的样子和数量。
- **五金清单**：编号（照说明书原样写，宜家是 6 位数字，其他品牌可能是 A、B、M6×30）和数量。
- **按页的装配步骤**：每一步的页码、内容、用到的五金和数量（"编号 ×N"）、工具。有多条路线（左开/右开、两种上墙方案）就分表。
- **不确定点**：一条一条列出。
- **箭头**：哪一步画了旋转箭头、双向箭头、直箭头，在哪一页（阶段 5 的动作只能加在画了箭头的地方）。

看不清的页用 `flatpack render <id> --width=2000` 重新渲染再看，并在报告里写明"按 2 倍分辨率复查"。

### ▶ 确认点 1（必须停下）

把**零件清单表和五金清单表**（连同说明书零件清单所在的页码）给用户，请用户对照说明书的零件清单页确认编号和数量。**等用户回复再继续。** 用户指出的错误改进报告，并在报告里注明"用户确认（日期）"。

完成标准：
- [ ] 报告的每个结论都能指到页码；不确定的都标了"不确定"。
- [ ] 用户确认了零件和五金的数量。

## 阶段 3：尺寸

写 `data/<id>/dimensions.md`，方法见 `references/dimensions-method.md`。顺序：**资料原文**（说明书或商品页写明的尺寸，注明页码或链接）优先，**读图近似**（按已知尺寸和图纸比例量）其次，**猜测**最后。

- 结构：`## 已确认尺寸`、`## 近似值（…）`、`## 猜测清单`（编号条目，页面底部会原样显示）。
- 非宜家说明书常常写了尺寸和板件规格（例如"侧板 600×300×18"），这类数字一律当"资料原文"用，不要再用读图去改。

完成标准：
- [ ] 构建脚本里用到的每个尺寸，都能在 `dimensions.md` 里找到来源。
- [ ] 猜测清单编号连续；如果有英文版，`dimensions.en.md` 的编号一一对应。

## 阶段 4：数据

写 `data/<id>/build/*.js`，生成每个"件"的装配数据 `data/<id>/<件>.json`（规范见 `references/spec.md`，完整例子见 `examples/kallax/README.md` 和 `data/kallax/build/`），在 `site.json` 的 `pieces` 里列出这些件，在 `manifest.json` 的 `build` 里列出构建脚本。

```bash
flatpack build <id>
flatpack validate --product=<id> --no-framing
```

有英文站点时，新加的件在阶段 7 补译文之前，站点校验会报译文缺失。这一阶段可以只校验装配数据：

```bash
flatpack validate data/<id>/<件>.json        # 只核对这一件与分析报告
```

新加一个件要做四件事：构建脚本里生成 `data/<id>/<件>.json`；`site.json`（和 `site.en.json`，带 `i18n` 路径）的 `pieces` 里加一项；`manifest.json` 的 `build` 里列出构建脚本；分析报告里有对应的一节。

完成标准：
- [ ] 校验全部 ✔：零件种类和总数、五金种类和总数都等于报告；每一步的页码、五金用量、工具编号与报告一致；所有零件的外包盒等于整体尺寸；零件之间没有重叠。
- [ ] 用 `--verbose` 看一眼通过的检查，确认核对真的在跑（例如每一步都有"页码 pN"和五金用量的条目）。

## 阶段 5：接入引擎（取景和放大圆圈）

```bash
flatpack framing --product=<id>                       # 中文：桌面、笔记本、手机三种尺寸，每一步截图
flatpack framing --product=<id> --lang=en --sizes=desktop,mobile   # 有英文时
```

- 截图在 `renders/framing/<id>/`，打开看，不要只看"全部合格"。
- 规则和阈值见 `references/framing-and-zoom.md`：本步在动的零件在主画面或放大圆圈里要够大；圆圈不能压住面板。
- 动作（`motions`）：只给说明书画了箭头的步骤写，写明依据页（`motionNote`）；没画箭头的螺钉引擎也会让它边转边拧入，但不显示工具和箭头。
- `renders/framing/<id>/<语言>/narrow-fields.json` 列出视野被收紧到不足 3 倍的圆圈，逐个看一眼。

完成标准：
- [ ] 取景检查全部合格（所有件、所有路线、中英文）。
- [ ] 看过截图：没有零件被画布边缘切掉一半、没有圆圈挡住要看的东西。

## 阶段 6：视觉复查

```bash
flatpack review <id>                  # 每个件的默认路线；要全部路线加 --all-variants
```

输出 `exports/review/<id>/<件>[-路线].png`：每步一行，左边说明书这一步的放大圆圈（找不到圆圈就是整步的图；说明书用方框而不是圆圈画放大图时也是整步的图），右边 3D 放大圆圈在动画中途的截图（没有圆圈就是主画面）。需要先 `flatpack render <id>`，缺页面图时左边是一张写着"pNN missing"的空白图。

先自己逐行看，对照 `references/pitfalls.md` 的"视觉复查要看什么"：
- 看得出是哪两块板、哪个角；螺钉、木销在孔外的那一段看得见，不是只剩一个点；
- 工具和箭头只在说明书画了的步骤出现，方向对；
- 圈里的数量标记（"2×"）与说明书一致；
- 说明书有放大圆圈的步骤，3D 也有（反之亦然）。

对不上的先改（数据、动作、视角），重新出图，直到自己看没有问题。

### ▶ 确认点 2（必须停下）

把对照图发给用户，说明你自己发现并改掉了哪些问题、还有哪些不确定。**等用户回复再继续。**

完成标准：
- [ ] 每一行都看过；改过的问题列在给用户的说明里。
- [ ] 用户看过对照图。

## 阶段 7：文案

- `product.zh.json`（有英文就加 `product.en.json`）：
  - `share`：分享标题、描述、图片（`flatpack og <id>` 生成）、`shotPiece`。
  - `about.exact` / `about.approximate`（近似说明指向 `dimensions.md` 的猜测清单）/ `notes`（例如"演示速度比真人快，说明书要求两人操作"）。
  - `about.disclaimer` 和 `about.trademarks`：**与厂家无关、未经认可，商标归谁**；`trademarks` 里的名字都要写进声明。
  - `about.links`：每份说明书的官方 PDF（与 `manifest.json` 一致）和商品页。
  - `safety`：说明书有安全警告时写，`page` 是警告所在页，`text` 里写明"p<页>"，只转述说明书和商品页能支持的内容。
- 英文：`site.en.json`、`i18n/<件>.en.json`（每个要显示的名称和说明）、`dimensions.en.md`。部件英文名是描述性译名，要在近似说明里写明"不是厂家官方叫法"。

```bash
flatpack og <id>
flatpack validate --product=<id>
```

完成标准：
- [ ] 校验全部 ✔（包括站点文案、中英文对齐、取景检查）。

## 阶段 8：发布前检查

逐条过 `references/release-checklist.md`，重点：

```bash
git status --short && git ls-files | grep -iE '\.(pdf|jpe?g|webp)$|^inputs/|^renders/|^manuals/|^refs/|^exports/'   # 后一条必须没有输出
flatpack validate                     # 所有产品、技能两份一致、产品索引最新
flatpack sync-skill --check           # 改过技能文件后先运行 flatpack sync-skill
```

完成标准：
- [ ] 清单每一条都打勾；没有说明书 PDF、说明书页面图、商品图进仓库。

## 参考

- `references/spec.md`：装配数据、产品目录的 JSON 规范和校验规则。
- `references/report-format.md`：分析报告的表格格式。
- `references/framing-and-zoom.md`：取景、放大圆圈、动作、线稿、阈值。
- `references/dimensions-method.md`：尺寸推算方法。
- `references/pitfalls.md`：本项目实际踩过的坑。
- `references/release-checklist.md`：发布前检查清单。
- `examples/kallax/`：KALLAX 置物架 + 门嵌件 + 双抽屉嵌件的完整示例（不含说明书 PDF 和页面图）。
