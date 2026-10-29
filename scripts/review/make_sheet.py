# 对照图：每步一行，左边说明书该步的放大圆圈（没有圆圈就是整步的图），右边 3D 放大圆圈在动画中途（没有圆圈就是主画面）
# 用法：python scripts/review/make_sheet.py <说明书圆圈目录> <3D 截图目录> <输出 png> <件名，如 body-a> <标题>
# 一般不单独运行，由 scripts/review/make-review.js 调用。
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding='utf-8')
mc, cs, out_png, key, title = sys.argv[1:6]
out = os.path.dirname(out_png)
os.makedirs(out, exist_ok=True)
H = 280
LW = 210  # 左边文字栏宽
# 中文字体：依次试 Windows、macOS、Linux 常见位置；都没有就用 Pillow 默认字体（中文会显示成方块，图本身不受影响）
FONTS = ['C:/Windows/Fonts/msyh.ttc', '/System/Library/Fonts/PingFang.ttc', '/System/Library/Fonts/STHeiti Medium.ttc',
         '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc']
font = small = None
for f in FONTS:
    try:
        font, small = ImageFont.truetype(f, 20), ImageFont.truetype(f, 15)
        break
    except OSError:
        continue
if font is None:
    font = small = ImageFont.load_default()

def fit(im, h):
    im = im.convert('RGB')
    return im.resize((max(1, round(im.width * h / im.height)), h))

for key, title in [(key, title)]:
    man = {i['n']: i for i in json.load(open(os.path.join(mc, key, 'manual.json'), encoding='utf-8'))}
    shots = {i['n']: i for i in json.load(open(os.path.join(cs, key, 'index.json'), encoding='utf-8'))}
    rows = []
    for n in sorted(man):
        m = man[n]
        left = fit(Image.open(os.path.join(mc, key, m['file'])), H)
        rights = [fit(Image.open(os.path.join(cs, key, f)), H) for f in shots[n]['files']]
        label = Image.new('RGB', (LW, H), 'white')
        d = ImageDraw.Draw(label)
        d.text((12, 12), f'第 {n} 步', fill='black', font=font)
        d.text((12, 44), f'说明书 p{m["page"]}', fill='#555', font=small)
        d.text((12, 66), '放大圆圈' if m['kind'] == 'circle' else '无圆圈，整步图', fill='#555', font=small)
        d.text((12, 100), f'3D：{len(rights)} 个圆圈' if shots[n]['circles'] else '3D：无圆圈，主画面', fill='#555', font=small)
        w = LW + max(left.width, 420) + 20 + sum(r.width + 10 for r in rights)
        row = Image.new('RGB', (w, H + 12), 'white')
        row.paste(label, (0, 6))
        row.paste(left, (LW, 6))
        x = LW + max(left.width, 420) + 20
        for r in rights:
            row.paste(r, (x, 6)); x += r.width + 10
        ImageDraw.Draw(row).line([(0, H + 11), (w, H + 11)], fill='#ccc')
        rows.append(row)
    W = max(r.width for r in rows)
    head = Image.new('RGB', (W, 56), 'white')
    ImageDraw.Draw(head).text((12, 14), f'{title}：左 = 说明书，右 = 3D 放大圆圈（动画中途）', fill='black', font=font)
    sheet = Image.new('RGB', (W, 56 + sum(r.height for r in rows)), 'white')
    sheet.paste(head, (0, 0))
    y = 56
    for r in rows:
        sheet.paste(r, (0, y)); y += r.height
    sheet.save(out_png, optimize=True)
    print(key, sheet.size)
