# 把一个目录里按名字排序的 JPEG 帧合成 mp4（MPEG-4 Part 2，mp4v；OpenCV 自带，不需要另装 ffmpeg）
# 用法：python scripts/review/frames_to_mp4.py <帧目录> <输出 mp4> <fps>
import glob, os, sys
import cv2
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

src, out, fps = sys.argv[1], sys.argv[2], float(sys.argv[3])
files = sorted(glob.glob(os.path.join(src, '*.jpg')))
if not files:
    sys.exit('没有帧')
# OpenCV 在 Windows 上读不了带中文的路径：先读成字节再解码
read = lambda f: cv2.imdecode(np.fromfile(f, dtype=np.uint8), cv2.IMREAD_COLOR)
h, w = read(files[0]).shape[:2]
vw = cv2.VideoWriter(out, cv2.VideoWriter_fourcc(*'mp4v'), fps, (w, h))
if not vw.isOpened():
    sys.exit('无法创建视频文件')
for f in files:
    vw.write(read(f))
vw.release()
print(f'{out}：{len(files)} 帧，{w}×{h}，{fps:g} fps，{os.path.getsize(out) / 1e6:.1f} MB')
