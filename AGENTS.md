# AGENTS.md

本仓库是 FlatPack3D：把装配说明书做成可交互 3D 分步演示的引擎，加上一个技能 `manual-to-3d`。

**要做"说明书 → 3D 说明书"，或在这里新增、修改一套家具，先读 `skills/manual-to-3d/SKILL.md`，按它的"前提"和 8 个阶段做，两个确认点必须停下来等用户回复。**

## 用户的文件夹里只有 inputs/ 时（从网页或链接读到这里）

用户请你把当前文件夹 `inputs/` 里的说明书做成 3D 说明书，而当前文件夹不是本仓库时，按顺序做：

1. **下载工具 v0.1.1 到当前文件夹的子目录 `FlatPack3D/`**。当前文件夹下已经有 `FlatPack3D/`（根上有 `index.html`、`scripts/flatpack.js`、`vendor/three@0.160.0/`）就直接用，不要重复下载。

   ```bash
   git clone --depth 1 --branch v0.1.1 https://github.com/zzzhengqi/FlatPack3D.git FlatPack3D
   ```

   没装 git 时不用装，下载 zip（https://github.com/zzzhengqi/FlatPack3D/archive/refs/tags/v0.1.1.zip），解压后把 `FlatPack3D-0.1.1/` 改名为 `FlatPack3D/`。命令见 SKILL.md"前提"第 1 条。都下载不了就停下来告诉用户。
2. **读 `FlatPack3D/skills/manual-to-3d/SKILL.md`**，之后严格按它做。之后的命令都在 `FlatPack3D/` 里运行。
3. **检查环境**：`node --version`（要 22 或以上），再 `node scripts/flatpack.js doctor`。缺什么（Node.js、Python、Python 包、Chrome/Edge）先把用途和安装命令列给用户，**用户同意后再装**，直到 doctor 全部 ✔。
4. **复制用户资料**：在阶段 1 建好产品骨架后，把 `../inputs/` 里的说明书 PDF 复制到 `inputs/<id>/`，商品图复制到 `inputs/<id>/images/`，`links.txt` 复制到 `inputs/<id>/links.txt`。只复制，不移动、不删除原件。
5. **做 8 个阶段**。两个确认点（阶段 2 的零件和五金数量、阶段 6 的对照图）必须停下来等用户回复。
6. **交付**：按 SKILL.md 阶段 8，把新产品设为默认产品、跑完校验，告诉用户怎么打开查看（Windows 双击 `FlatPack3D/start.bat`；或在 `FlatPack3D/` 里运行 `node scripts/flatpack.js serve 8137 --open`）。

## 在仓库里工作

常用命令（在仓库根目录运行）：

```bash
node scripts/flatpack.js doctor                 # 环境检查
node scripts/flatpack.js validate               # 全部校验（数据、文案、取景截图检查）
node scripts/flatpack.js validate --no-framing  # 只查数据，不需要浏览器
node scripts/flatpack.js serve 8137 --open      # 本地打开页面
```

规矩：

- 用户的说明书 PDF 放 `inputs/<产品>/`，商品图放 `inputs/<产品>/images/`；产品数据放 `data/<产品>/`。说明书 PDF、说明书页面图、商品图不入库（`inputs/`、`renders/`、`exports/` 都在 `.gitignore` 里）。
- 结论只来自资料，看不清标"不确定"；每个尺寸在 `data/<产品>/dimensions.md` 里标明来源。
- 文字写在 JSON / Markdown 文案文件里，不写进代码；引擎（`index.html`）、校验和取景检查脚本不写任何具体家具。
- 需要安装软件，或流程要求用户确认的地方，先停下来问用户。
- 改了 `skills/manual-to-3d/` 后运行 `node scripts/flatpack.js sync-skill`，让 `.claude/skills/manual-to-3d/` 保持一致。
- 改完跑校验，看截图，再汇报。
