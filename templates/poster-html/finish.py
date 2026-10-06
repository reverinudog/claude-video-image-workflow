"""書き出したポスターに仕上げの効果をかける：周辺ほど強い色収差（赤と青を外へずらす）。
使い方: python finish.py <入力png> <出力png>
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

Image.MAX_IMAGE_PIXELS = None
src, dst = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
H, W, _ = im.shape
cy, cx = H * 0.40, W * 0.5
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
dx, dy = (xx - cx), (yy - cy)
rn = np.hypot(dx / (W * 0.5), dy / (H * 0.5))
k = 2.6 * np.clip(rn, 0, 1.4) ** 1.8          # 周辺で最大 約4px
nx, ny = dx / (np.hypot(dx, dy) + 1e-3), dy / (np.hypot(dx, dy) + 1e-3)
out = im.copy()
for ch, s in ((0, 1.0), (2, -1.0)):
    out[..., ch] = ndi.map_coordinates(im[..., ch], [yy - s * k * ny, xx - s * k * nx], order=1, mode="nearest")
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst)
print("finished", dst)
