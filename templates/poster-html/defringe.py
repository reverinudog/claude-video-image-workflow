"""透過画像の縁の白いフチ（背景抜きの残り）を消す。
半透明〜縁の画素の色を、いちばん近い不透明の内側の画素の色で置き換え、アルファを少し内側へ削る。
使い方: python defringe.py <入力> <出力> [削る幅px=1.2]
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src, dst = sys.argv[1], sys.argv[2]
choke = float(sys.argv[3]) if len(sys.argv) > 3 else 1.2
a = np.asarray(Image.open(src).convert("RGBA")).astype(np.float32)
rgb, al = a[..., :3], a[..., 3] / 255.0

solid = al > 0.98
# 縁から2px以内の不透明画素も白が混ざっていることがあるので、「芯」は少し内側にとる
core = ndi.binary_erosion(solid, iterations=2)
_, (iy, ix) = ndi.distance_transform_edt(~core, return_indices=True)
fill = rgb[iy, ix]
d_in = ndi.distance_transform_edt(solid)              # 不透明域の中での縁からの距離
w = np.clip((3.0 - d_in) / 3.0, 0, 1)[..., None]      # 縁ほど内側の色に置き換える
w = np.where(solid[..., None], w, 1.0)
rgb2 = rgb * (1 - w) + fill * w

# アルファを choke px 内側へ（距離で滑らかに）
d_out = ndi.distance_transform_edt(al > 0.5)
al2 = np.clip((d_out - choke + 0.5), 0, 1) * np.clip(al * 1.15, 0, 1)
out = np.dstack([rgb2, al2 * 255.0])
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA").save(dst)
print("defringed", dst)
