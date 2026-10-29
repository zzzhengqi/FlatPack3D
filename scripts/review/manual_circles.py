# 在说明书页图上找放大圆圈：按步骤的 figure 竖直范围，在 pages[0] 上用霍夫圆检测找半径 60–300 px 的大圆
# 用法：python scripts/review/manual_circles.py <仓库根目录> <产品 id> <piece> <variant|-> <输出目录>
# 输出 <输出目录>/<piece>[-<variant>]/manual-stepNN.png 和 manual.json（每步：页、找到的是圆圈还是整步图）
# 一般不单独运行，由 scripts/review/make-review.js 调用。需要先用 scripts/render-pages.py 渲染页面图。
import json, os, sys
import cv2
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
# OpenCV 在 Windows 上读写不了带中文的路径：先读成字节再解码，写也先编码成字节
def imread(p):
    return cv2.imdecode(np.fromfile(p, dtype=np.uint8), cv2.IMREAD_COLOR) if os.path.exists(p) else None
def imwrite(p, img):
    ok, buf = cv2.imencode(os.path.splitext(p)[1] or '.png', img)
    if ok:
        buf.tofile(p)
root, product, piece, variant, outdir = sys.argv[1:6]
manifest = json.load(open(os.path.join(root, 'data', product, 'manifest.json'), encoding='utf-8'))
site = json.load(open(os.path.join(root, manifest['sites'].get('zh') or list(manifest['sites'].values())[0]), encoding='utf-8'))
url = next(x['url'] for x in site['pieces'] if x['key'] == piece)
data = json.load(open(os.path.join(root, url), encoding='utf-8'))
pages_dir = os.path.join(root, data['manualPages']['dir'])
seq = [s for s in data['steps'] if not s.get('variant') or s.get('variant') == (None if variant == '-' else variant)]
dest = os.path.join(outdir, piece + ('' if variant == '-' else '-' + variant))
os.makedirs(dest, exist_ok=True)
info = []
cache = {}

def circles_on(page):
    if page in cache:
        return cache[page]
    img = imread(os.path.join(pages_dir, 'p%02d.png' % page))
    if img is None:
        # 本机没有渲染这一页：画一张写着页码的空白图，对照图照样能出（左边提示去渲染）
        print(f'缺少页面图 {data["manualPages"]["dir"]}/p{page:02d}.png（先运行 python scripts/render-pages.py {product}）')
        img = np.full((1414, 1000, 3), 255, np.uint8)
        cv2.putText(img, f'p{page:02d} missing', (220, 700), cv2.FONT_HERSHEY_SIMPLEX, 2.4, (90, 90, 90), 4)
        cache[page] = (img, [])
        return cache[page]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 1.5)
    found = cv2.HoughCircles(blur, cv2.HOUGH_GRADIENT, dp=1.2, minDist=120, param1=120, param2=60, minRadius=60, maxRadius=300)
    out = []
    if found is not None:
        for x, y, r in found[0]:
            # 圆周上要真的有黑线：沿圆周采样，暗像素占比高才算
            ang = np.linspace(0, 2 * np.pi, 180, endpoint=False)
            xs = np.clip((x + r * np.cos(ang)).astype(int), 0, gray.shape[1] - 1)
            ys = np.clip((y + r * np.sin(ang)).astype(int), 0, gray.shape[0] - 1)
            def at(rr):
                xs = np.clip((x + rr * np.cos(ang)).astype(int), 0, gray.shape[1] - 1)
                ys = np.clip((y + rr * np.sin(ang)).astype(int), 0, gray.shape[0] - 1)
                return np.array([gray[max(0, yy - 2):yy + 3, max(0, xx - 2):xx + 3].min() for xx, yy in zip(xs, ys)])
            # 真正的放大圆圈：圆周上一圈细黑线，线的内外两侧大多是白的（网格线、板边不满足）
            ring, inner, outer = at(r), at(r - 7), at(r + 7)
            thin = np.mean((ring < 110) & (inner > 180) & (outer > 180))
            dark = np.mean(ring < 110)
            if thin > 0.3:
                out.append((float(x), float(y), float(r), float(thin)))
    cache[page] = (img, out)
    return cache[page]

for s in seq:
    page = s['pages'][0]
    img, cs = circles_on(page)
    h, w = img.shape[:2]
    fy = s.get('figure') or [0, 1]
    inside = [c for c in cs if fy[0] * h - 20 <= c[1] <= fy[1] * h + 20]
    name = 'manual-step%02d.png' % s['n']
    if inside:
        x, y, r, _ = max(inside, key=lambda c: c[2])
        m = int(r * 1.12)
        x0, y0, x1, y1 = max(0, int(x - m)), max(0, int(y - m)), min(w, int(x + m)), min(h, int(y + m))
        kind = 'circle'
    else:
        x0, y0, x1, y1 = 0, int(fy[0] * h), w, int(fy[1] * h)
        kind = 'figure'
    imwrite(os.path.join(dest, name), img[y0:y1, x0:x1])
    info.append({'n': s['n'], 'page': page, 'kind': kind, 'file': name, 'circles': len(inside)})
json.dump(info, open(os.path.join(dest, 'manual.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(piece, variant, ' '.join('%d:%s' % (i['n'], i['kind'][0]) for i in info))
