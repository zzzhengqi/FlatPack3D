# FlatPack3D

把平板家具的纸质/PDF 装配说明书，转换成可交互的 3D 分步装配演示。

当前样例：宜家 KALLAX 置物架主体（5×5）、门嵌件（左开/右开）、双抽屉嵌件，以及"全套"（主体 + 5 门 + 5 双抽屉）。均不含上墙固定。

## 运行

```bash
python scripts/render-pages.py      # 首次：把 manuals/ 里的 PDF 渲染到 renders/（需 pip install pymupdf）
node scripts/build-kallax-body.js   # 生成 data/kallax-body.json
node scripts/build-kallax-inserts.js  # 生成门、抽屉、全套数据
node scripts/validate.js            # 用分析报告校验数据，不一致时退出码为 1
python -m http.server 8137          # 然后打开 http://localhost:8137/
node scripts/build-meta.js          # 按 data/kallax-product.json 更新 index.html 的分享信息
node scripts/make-og-image.js       # 本地服务运行时，用无头 Chrome 生成 og-image.png
```

## 目录

```
manuals/          原始说明书 PDF（已 gitignore，不入库）
renders/          PDF 逐页渲染图（已 gitignore，由 scripts/render-pages.py 生成）
refs/             商品参考图片
docs/analysis/    说明书分析报告（数据的基准）
docs/spec.md      装配数据 JSON 规范
docs/dimensions.md 尺寸来源与近似值
data/             装配数据 JSON；site.json、ui.zh.json、kallax-product.json 是界面和产品文案
scripts/          生成、校验、渲染脚本
index.html        单文件 Three.js 引擎：顶部切换"件"（主体/门/抽屉/全套）
```
