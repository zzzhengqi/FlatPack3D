"""把一个产品的说明书 PDF 逐页渲染成约 1000px 宽的 PNG。

读 data/<产品>/manifest.json 的 sources.manuals：每份说明书 {key, file, pages}，
从 inputs/<产品>/<file> 读 PDF（也找 inputs/<file> 和旧位置 manuals/<产品>/<file>），输出到 renders/<产品>/<key>/pNN.png（页码两位数，从 01 开始）。
PDF 和渲染结果都不入库（见 .gitignore）：页面图只在本机供对照，页面上的说明书面板发现有图就自动显示。

依赖：pip install pymupdf
用法：python scripts/render-pages.py <产品 id> [--width=1000]
      python scripts/render-pages.py kallax
"""
import json
import pathlib
import sys

import pymupdf

sys.stdout.reconfigure(encoding='utf-8')

ROOT = pathlib.Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith('--')]
width = next((int(a.split('=')[1]) for a in sys.argv[1:] if a.startswith('--width=')), 1000)
if not args:
    ids = sorted(p.parent.name for p in (ROOT / 'data').glob('*/manifest.json'))
    sys.exit(f'用法：python scripts/render-pages.py <产品 id>。已有产品：{"、".join(ids) or "（没有）"}')
pid = args[0]
manifest = json.loads((ROOT / 'data' / pid / 'manifest.json').read_text(encoding='utf-8'))
missing = 0
for m in manifest['sources']['manuals']:
    tries = [ROOT / 'inputs' / pid / m['file'], ROOT / 'inputs' / m['file'], ROOT / 'manuals' / pid / m['file']]
    pdf = next((t for t in tries if t.exists()), tries[0])
    if not pdf.exists():
        print(f'缺少 PDF：{pdf.relative_to(ROOT)}（下载地址 {m.get("url", "未登记")}）')
        missing += 1
        continue
    out = ROOT / 'renders' / pid / m['key']
    out.mkdir(parents=True, exist_ok=True)
    with pymupdf.open(pdf) as doc:
        for i, page in enumerate(doc, start=1):
            zoom = width / page.rect.width
            page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom)).save(out / f'p{i:02d}.png')
        note = '' if doc.page_count == m.get('pages') else f'（manifest 写的是 {m.get("pages")} 页，请改正）'
        print(f'{m["file"]} → renders/{pid}/{m["key"]}/（{doc.page_count} 页）{note}')
sys.exit(1 if missing else 0)
