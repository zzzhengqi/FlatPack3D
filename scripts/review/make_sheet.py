# 对照图：每步一行，左边说明书该步的放大圆圈（没有圆圈就是整步的图），右边 3D 放大圆圈在动画中途（没有圆圈就是主画面）
# 用法：python scripts/review/make_sheet.py <说明书圆圈目录> <3D 截图目录> <输出目录>
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

mc, cs, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
H = 280
LW = 210  # 左边文字栏宽
try:
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 20)
    small = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 15)
except OSError:
    font = small = ImageFont.load_default()

def fit(im, h):
    im = im.convert('RGB')
    return im.resize((max(1, round(im.width * h / im.height)), h))

titles = {'body-a': 'KALLAX 置物架主体（墙固定件路线）', 'door-left': 'KALLAX 门嵌件（铰链在左）', 'drawer': 'KALLAX 双抽屉嵌件'}
for key, title in titles.items():
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
    sheet.save(os.path.join(out, f'{key}.png'), optimize=True)
    print(key, sheet.size)
