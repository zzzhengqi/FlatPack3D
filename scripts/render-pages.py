"""把 manuals/ 下的说明书 PDF 逐页渲染成约 1000px 宽的 PNG，输出到 renders/{shelf,door,drawers}/pNN.png。

PDF 和渲染结果都不入库（见 .gitignore），新克隆的仓库需要先放好 PDF 再运行本脚本。
依赖：pip install pymupdf
用法：python scripts/render-pages.py
"""
import pathlib

import pymupdf

ROOT = pathlib.Path(__file__).resolve().parent.parent
NAMES = {
    "kallax-shelving-unit": "shelf",
    "kallax-insert-with-door": "door",
    "kallax-insert-with-2-drawers": "drawers",
}
WIDTH = 1000

for pdf in sorted((ROOT / "manuals").glob("*.pdf")):
    name = next((v for k, v in NAMES.items() if pdf.name.startswith(k)), None)
    if name is None:
        print(f"跳过（未识别）：{pdf.name}")
        continue
    out = ROOT / "renders" / name
    out.mkdir(parents=True, exist_ok=True)
    with pymupdf.open(pdf) as doc:
        for i, page in enumerate(doc, start=1):
            zoom = WIDTH / page.rect.width
            page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom)).save(out / f"p{i:02d}.png")
        print(f"{pdf.name} → renders/{name}/（{doc.page_count} 页）")
