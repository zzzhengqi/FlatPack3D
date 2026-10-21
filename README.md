# FlatPack3D

把平板家具的纸质/PDF 装配说明书，转换成可交互的 3D 分步装配演示。

当前样例：宜家 KALLAX 置物架主体（5×5）、门嵌件（左开/右开）、双抽屉嵌件，以及"全套"（主体 + 5 门 + 5 双抽屉）。均不含上墙固定。界面有中文和英文。

## 运行

```bash
python scripts/render-pages.py        # 首次：把 manuals/ 里的 PDF 渲染到 renders/（需 pip install pymupdf）
node scripts/build-kallax-body.js     # 生成 data/kallax-body.json
node scripts/build-kallax-inserts.js  # 生成门、抽屉、全套数据
node scripts/validate.js              # 校验：数据对照分析报告、中英文案对齐、逐步截图检查取景；不一致时退出码为 1
python -m http.server 8137            # 然后打开 http://localhost:8137/
node scripts/build-meta.js            # 按 data/kallax-product.json 更新 index.html 的分享信息
node scripts/make-og-image.js         # 用无头 Chrome 生成 og-image.png（自带本地服务）
```

- **离线可用**：three.js r160 和 OrbitControls 放在 `vendor/three@0.160.0/`（MIT 许可，见该目录的 LICENSE），页面不引用任何外网资源。页面要用 `fetch` 读 JSON，所以仍需本地 HTTP 服务打开，不能直接双击 `index.html`（`file://`）。
- **校验需要浏览器**：`validate.js` 最后一步会用本机的 Chrome / Edge（无头模式）截图检查取景，截图存到 `renders/framing/`。没有浏览器或只想查数据时用 `node scripts/validate.js --no-framing`；单独跑取景检查用 `node scripts/check-framing.js [--lang=en] [--only=door] [--sizes=desktop,mobile]`。

## 地址参数

| 参数 | 例子 | 说明 |
|---|---|---|
| `piece` | `?piece=door` | 件：`body` 主体、`door` 门嵌件、`drawer` 抽屉嵌件、`set` 全套 |
| `variant` | `?piece=door&variant=right` | 路线（门嵌件：`left` 左开、`right` 右开） |
| `step` | `?piece=body&step=12` | 直接定位到说明书第 12 步；`0` 是清点零件。切换步骤时地址栏会跟着更新 |
| `lang` | `?lang=en` | 界面语言；不写为中文。右上角也可以切换 |

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
data/             装配数据 JSON；site*.json、ui.*.json、kallax-product*.json 是界面和产品文案；i18n/ 是装配数据的英文译文
scripts/          生成、校验、截图检查、渲染脚本
index.html        单文件 Three.js 引擎：顶部切换"件"（主体/门/抽屉/全套）
```
