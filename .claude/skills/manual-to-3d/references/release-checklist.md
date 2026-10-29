# 发布前检查清单

逐条打勾。命令都在仓库根目录运行，`flatpack` = `node skills/manual-to-3d/scripts/flatpack.js`。

## 资料不入库

- [ ] `git ls-files | grep -iE '\.(pdf|jpe?g|webp)$|^renders/|^manuals/|^refs/|^exports/'` 没有输出。
- [ ] `git log --all --name-only --pretty=format: | sort -u | grep -iE '\.(pdf|png|jpe?g|webp)$'` 只有自己生成的 3D 截图（`data/*/og-image*.png`、`skills/manual-to-3d/examples/*/screens/*.png`）和 `brand/` 里的标识。历史里一旦进过说明书页面图或商品图，要先清理历史再发布。
- [ ] `.gitignore` 里有 `manuals/`、`renders/`、`refs/`、`exports/`。
- [ ] 截图类文件（分享图、示例截图）里看不到说明书页面：截图前隐藏说明书面板，或确认本机没有页面图。

## 校验

- [ ] `flatpack validate` 全部 ✔：所有产品的数据、全套、Room、各语言站点文案，产品索引最新，技能两份一致，取景截图检查（中文三种尺寸、英文桌面和手机）。
- [ ] `flatpack framing --lang=en --sizes=laptop` 也合格（笔记本宽度的英文界面最挤）。
- [ ] 每个产品都做过阶段 6 的对照图，用户看过。

## 文案和声明

- [ ] 每个产品的 `about.disclaimer` 写明与厂家无关、未经认可、商标归属；`about.trademarks` 列全。
- [ ] 每份说明书在 `about.links.items` 里有官方链接，与 `manifest.json` 的 `sources.manuals` 一致；商品页链接在 `about.links.source`。
- [ ] 近似说明指向 `dimensions.md` 的猜测清单；英文版写明部件英文名是描述性译名。
- [ ] 安全提示（有的话）只转述说明书和商品页能支持的内容，注明页码。
- [ ] 分享图（`flatpack og <id>`）和页面头部（`node scripts/build-meta.js`）是最新的。

## 仓库

- [ ] README 写明：做什么、怎么打开、怎么用技能、资料不入库、标识的权利。
- [ ] 代码许可证（LICENSE）由仓库所有者决定并添加；第三方库的许可证保留（`vendor/three@0.160.0/LICENSE`）。
- [ ] `brand/README.md` 写明标识的来源和权利（标识不随代码许可证授权）。
- [ ] 改过 `skills/manual-to-3d/` 后运行 `flatpack sync-skill`，`.claude/skills/manual-to-3d/` 与它一致。
- [ ] 换行符统一（`git add --renormalize .` 后没有改动）。
- [ ] 没有临时产品（例如测试时 `flatpack new` 建的示例）：`ls data/` 里只有要发布的产品，`data/products.json` 与之一致。
