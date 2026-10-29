# AGENTS.md

本仓库是 FlatPack3D：把装配说明书做成可交互 3D 分步演示的引擎，加上一个技能 `manual-to-3d`。

**要做"说明书 → 3D 说明书"，或在这里新增、修改一套家具，先读 `skills/manual-to-3d/SKILL.md`，按它的 8 个阶段做，两个确认点必须停下来等用户回复。**

常用命令（在仓库根目录运行）：

```bash
node skills/manual-to-3d/scripts/flatpack.js doctor               # 环境检查
node skills/manual-to-3d/scripts/flatpack.js validate             # 全部校验（数据、文案、取景截图检查）
node skills/manual-to-3d/scripts/flatpack.js validate --no-framing  # 只查数据，不需要浏览器
node skills/manual-to-3d/scripts/flatpack.js serve 8137 --open    # 本地打开页面
```

规矩：

- 说明书 PDF、说明书页面图、商品图不入库（`manuals/`、`renders/`、`refs/`、`exports/` 都在 `.gitignore` 里）。
- 结论只来自资料，看不清标"不确定"；每个尺寸在 `data/<产品>/dimensions.md` 里标明来源。
- 文字写在 JSON / Markdown 文案文件里，不写进代码；引擎（`index.html`）、校验和取景检查脚本不写任何具体家具。
- 改了 `skills/manual-to-3d/` 后运行 `node skills/manual-to-3d/scripts/flatpack.js sync-skill`，让 `.claude/skills/manual-to-3d/` 保持一致。
- 改完跑校验，看截图，再汇报。
