# 静止画（告知ポスター・配信サムネ）を Python だけで合成するひな形。
# 使い方: python build.py <poster|thumb|all> <版名 例: v1>   → out/poster_<版>.jpg / out/thumb_<版>.jpg（.png も）
#   必要なもの: pip install pillow numpy scipy
#   素材は assets/ に置く（無ければ、形だけの仮の絵で動く）:
#     assets/bg_tall.jpg   縦長の背景        assets/bg_wide.jpg  横長の背景
#     assets/hero.png      主役（透過PNG）   assets/back.png     奥に大きく置く人物（透過PNG）
#     assets/logo.png      題字（透過PNG）
#   文字と配置は、下の「ここから案件ごとに書き換える」以降を直す。座標は縦＝3000x4000、横＝3840x2160（最後に半分へ縮小）。
#   直すたびに新しい版名で書き出す（v1, v2, …。比べたい別案は v2b）。前の版は消さない。
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import gaussian_filter, zoom

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "assets")
rng = np.random.default_rng(7)
ATMOS = os.environ.get("ATMOS") == "1"   # 光の筋・フィルムの傷・周辺の色ずれを足す版（比べる用）


def find_font(*names):
    """フォントを探す。環境変数 STILL_FONT_DIR、利用者のフォント、OS のフォントの順。見つからなければ次の候補へ"""
    dirs = [os.environ.get("STILL_FONT_DIR", ""), os.path.join(ROOT, "fonts"),
            os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Windows\Fonts"), r"C:\Windows\Fonts",
            os.path.expanduser("~/Library/Fonts"), "/Library/Fonts", "/System/Library/Fonts",
            os.path.expanduser("~/.fonts"), "/usr/share/fonts/truetype", "/usr/share/fonts/opentype", "/usr/share/fonts"]
    for n in names:
        for d in dirs:
            if not d or not os.path.isdir(d):
                continue
            for base, _, files in os.walk(d):
                for f in files:
                    if f.lower() == n.lower():
                        return os.path.join(base, f)
    raise SystemExit("フォントが見つかりません：" + " / ".join(names) + "（STILL_FONT_DIR にフォントのフォルダを指定するか、fonts/ に置いてください）")


# 太い明朝（題字まわり）・ふつうの明朝（小さい字）。Zen Old Mincho（SIL OFL、Google Fonts）があれば使い、無ければ OS の明朝・ゴシックで代用する
F_MIN = find_font("ZenOldMincho-Black.ttf", "yumindb.ttf", "NotoSerifCJK-Bold.ttc", "NotoSerifJP-Bold.otf", "ヒラギノ明朝 ProN.ttc", "msmincho.ttc", "NotoSansCJK-Bold.ttc", "msgothic.ttc")
F_MINB = find_font("ZenOldMincho-Bold.ttf", "yumin.ttf", "NotoSerifCJK-Regular.ttc", "NotoSerifJP-Regular.otf", "ヒラギノ明朝 ProN.ttc", "msmincho.ttc", "NotoSansCJK-Regular.ttc", "msgothic.ttc")

RED = np.array([0.62, 0.05, 0.13])     # 基準の色（題字の色を測って決める。明るい朱赤は目が痛い）
EMBER = np.array([0.80, 0.22, 0.10])   # 火の粉・逆光
BONE = np.array([0.96, 0.93, 0.88])    # 文字の白


def load(path):
    return np.asarray(Image.open(path).convert("RGBA"), dtype=np.float32) / 255.0


def resize(a, w, h):
    im = Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8))
    return np.asarray(im.resize((int(w), int(h)), Image.LANCZOS), dtype=np.float32) / 255.0


def scale(a, s):
    return resize(a, round(a.shape[1] * s), round(a.shape[0] * s))


def blur(a, sigma):
    """大きなぼかしは縮小してから掛ける（速さのため）"""
    if sigma < 6:
        return gaussian_filter(a, sigma if a.ndim == 2 else (sigma, sigma, 0))
    f = max(1, int(sigma // 4))
    h, w = a.shape[:2]
    small = a[::f, ::f]
    small = gaussian_filter(small, sigma / f if a.ndim == 2 else (sigma / f, sigma / f, 0))
    zf = (h / small.shape[0], w / small.shape[1]) + ((1,) if a.ndim == 3 else ())
    return zoom(small, zf, order=1)[:h, :w]


def lum(rgb):
    return rgb[..., 0] * 0.3 + rgb[..., 1] * 0.59 + rgb[..., 2] * 0.11


def duotone(rgb, lo, hi, gamma=1.0, gain=1.0):
    l = np.clip(lum(rgb) * gain, 0, 1) ** gamma
    return lo + (np.asarray(hi) - lo) * l[..., None]


def put(canvas, rgb, alpha, x, y, mode="normal"):
    """canvas(H,W,3) の (x,y) に rgb/alpha を重ねる。はみ出しは切る"""
    H, W = canvas.shape[:2]
    h, w = alpha.shape
    x, y = int(round(x)), int(round(y))
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x0 >= x1 or y0 >= y1:
        return
    sx, sy = x0 - x, y0 - y
    a = alpha[sy:sy + y1 - y0, sx:sx + x1 - x0, None]
    c = rgb[sy:sy + y1 - y0, sx:sx + x1 - x0] if np.ndim(rgb) == 3 else np.asarray(rgb)
    d = canvas[y0:y1, x0:x1]
    if mode == "normal":
        d[:] = d * (1 - a) + c * a
    elif mode == "add":
        d[:] = d + c * a
    elif mode == "screen":
        d[:] = 1 - (1 - np.clip(d, 0, 1)) * (1 - np.clip(c * a, 0, 1))
    elif mode == "multiply":
        d[:] = d * (1 - a + c * a)


def vramp(h, w, y0, y1, v0=0.0, v1=1.0):
    """縦のグラデーション（y0でv0、y1でv1。なめらか）"""
    t = np.clip((np.arange(h, dtype=np.float32) - y0) / max(1e-6, (y1 - y0)), 0, 1)
    t = t * t * (3 - 2 * t)
    return np.repeat((v0 + (v1 - v0) * t)[:, None], w, axis=1)


# ---------- 文字 ----------
def text_mask(txt, font_path, size, tracking=0.0, vertical=False, pad=None):
    """文字のマスク（0..1）を返す。vertical=True は縦組み（、。は右上へ寄せる）"""
    font = ImageFont.truetype(font_path, size)
    pad = size if pad is None else pad
    if not vertical:
        adv = [font.getlength(ch) + size * tracking for ch in txt]
        W = int(sum(adv) + pad * 2)
        Hh = int(size * 1.5 + pad * 2)
        im = Image.new("L", (W, Hh), 0)
        d = ImageDraw.Draw(im)
        x = pad
        for ch, a in zip(txt, adv):
            d.text((x, pad), ch, font=font, fill=255)
            x += a
    else:
        step = size * (1 + tracking)
        W = int(size + pad * 2)
        Hh = int(step * len(txt) + pad * 2)
        im = Image.new("L", (W, Hh), 0)
        d = ImageDraw.Draw(im)
        y = pad
        for ch in txt:
            if ch in "、。":
                d.text((pad + size * 0.62, y - size * 0.58), ch, font=font, fill=255)
                y += step * 0.55
            else:
                d.text((pad + size / 2, y + size / 2), ch, font=font, fill=255, anchor="mm")
                y += step
    m = np.asarray(im, dtype=np.float32) / 255.0
    ys, xs = np.where(m > 0.02)
    return m[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5]


def rough(mask, amount=0.5, cell=5):
    """かすれ（筆・版ずれ風）。細かいノイズで少し削る"""
    h, w = mask.shape
    n = rng.random((h // cell + 2, w // (cell * 6) + 2)).astype(np.float32)
    n = zoom(n, (cell, cell * 6), order=1)[:h, :w]
    n2 = rng.random((h // 2 + 2, w // 2 + 2)).astype(np.float32)
    n2 = zoom(n2, 2, order=1)[:h, :w]
    k = np.clip((n * 0.7 + n2 * 0.3 - (1 - amount) * 0.28) * 6, 0, 1)
    return mask * (1 - amount * (1 - k))


def draw_text(canvas, mask, x, y, color=BONE, shadow=0.85, shadow_sigma=18, glow=None, anchor="lt"):
    h, w = mask.shape
    if anchor[0] == "c":
        x -= w / 2
    elif anchor[0] == "r":
        x -= w
    if anchor[1] == "c":
        y -= h / 2
    elif anchor[1] == "b":
        y -= h
    if shadow:
        p = int(shadow_sigma * 3)
        sm = np.pad(mask, p)
        sm = np.clip(blur(sm, shadow_sigma) * 1.6, 0, 1) * shadow
        put(canvas, np.zeros(3), sm, x - p, y - p + shadow_sigma * 0.3)
    if glow is not None:
        gc, gs, ga = glow
        p = int(gs * 3)
        gm = blur(np.pad(mask, p), gs) * ga
        put(canvas, np.asarray(gc), gm, x - p, y - p, "add")
    put(canvas, np.asarray(color), mask, x, y)
    return x, y, w, h


# ---------- 素材の加工 ----------
def figure_layer(path, s):
    """透過の立ち絵を読んで拡大する"""
    a = load(path)
    a = scale(a, s)
    rgb, al = a[..., :3].copy(), a[..., 3]
    return rgb, al


def grade_hero(rgb, al, dark_from, dark_to, rim=1.0):
    """主役：色は残しつつ、赤い逆光と下からの闇で場になじませる"""
    h, w = al.shape
    g = lum(rgb)[..., None]
    rgb = rgb * 0.86 + g * 0.14
    rgb = rgb * np.array([1.0, 0.86, 0.84])          # 場の赤をうっすら
    rgb = np.clip((rgb - 0.5) * 1.12 + 0.47, 0, 1)   # 少し締める
    # 逆光（輪郭の内側だけ赤く光らせる）
    inner = blur(al, 14 * rim)
    edge = np.clip(al * (1 - inner) * 2.6, 0, 1)
    inner2 = blur(al, 46 * rim)
    edge2 = np.clip(al * (1 - inner2) * 1.3, 0, 1)
    rgb = rgb + EMBER * edge[..., None] * 0.62 + RED * edge2[..., None] * 0.34
    # 下へ向かって闇に沈める
    d = vramp(h, w, dark_from, dark_to, 1.0, 0.0)[..., None]
    rgb = rgb * (0.10 + 0.90 * d) + np.array([0.10, 0.0, 0.0]) * (1 - d)
    return np.clip(rgb, 0, 1.4)


def villain_layer(path, s, fade_from, fade_to, lo=(0.03, 0.0, 0.0), hi=(0.95, 0.10, 0.08), gamma=1.25, gain=1.25, soft=1.2):
    """奥に置く人物：2色に落として、下を霧に溶かす"""
    a = scale(load(path), s)
    rgb, al = a[..., :3], a[..., 3]
    rgb = duotone(rgb, np.array(lo), hi, gamma, gain)
    if soft:
        rgb = gaussian_filter(rgb, (soft, soft, 0))
    h, w = al.shape
    al = al * vramp(h, w, fade_from, fade_to, 1.0, 0.0)
    return rgb, al


def embers(H, W, n, y_bias=1.6, smin=2, smax=11, seed=1):
    r = np.random.default_rng(seed)
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    for _ in range(n):
        x = r.random() * W
        y = H * (1 - r.random() ** y_bias)
        sz = smin + (smax - smin) * r.random() ** 2.2
        ang = r.normal(-1.1, 0.5)
        ln = sz * (0.6 + r.random() * 2.6)
        dx, dy = np.cos(ang) * ln, np.sin(ang) * ln
        d.line((x, y, x + dx, y + dy), fill=int(140 + 115 * r.random()), width=max(1, int(sz)))
    m = np.asarray(im, dtype=np.float32) / 255.0
    core = gaussian_filter(m, 1.0)
    halo = blur(m, 14)
    return core, halo


def rays(c, sx, sy, strength=0.16, seed=3):
    """奥の空から差す光の筋（主役の後ろに入れる）"""
    H, W = c.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    ang = np.arctan2(xx - sx, yy - sy)                      # 真下が0
    r = np.random.default_rng(seed)
    n = gaussian_filter(r.random(4096).astype(np.float32), 9, mode="wrap")
    n = np.clip((n - n.mean()) / (n.std() * 2.2) + 0.25, 0, 1) ** 1.6
    idx = ((ang / np.pi * 0.5 + 0.5) * 4095).astype(np.int32)
    dist = np.sqrt((xx - sx) ** 2 + (yy - sy) ** 2) / H
    ray = n[idx] * np.exp(-dist * 1.5) * np.clip(1 - np.abs(ang) / 1.25, 0, 1)
    return c + np.array([0.95, 0.20, 0.16]) * (blur(ray, 5) * strength)[..., None]


def film(c, seed=5):
    """フィルムの傷・埃と、周辺だけの色ずれ"""
    H, W = c.shape[:2]
    r = np.random.default_rng(seed)
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    for _ in range(9):                                       # 縦の細い傷
        x = r.random() * W
        y0 = r.random() * H * 0.7
        d.line((x, y0, x + r.normal(0, 6), y0 + H * (0.15 + 0.5 * r.random())), fill=int(50 + 70 * r.random()), width=1 + int(W > 3200))
    for _ in range(int(W * H / 60000)):                      # 埃
        x, y, q = r.random() * W, r.random() * H, 1 + r.random() * 2.2
        d.ellipse((x - q, y - q, x + q, y + q), fill=int(60 + 120 * r.random()))
    m = gaussian_filter(np.asarray(im, dtype=np.float32) / 255.0, 0.8)
    c = c + m[..., None] * 0.30
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    rad = np.clip(np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) - 0.6, 0, 1)[..., None]
    k = max(2, W // 900)
    sh = c.copy()
    sh[..., 0] = np.roll(c[..., 0], k, axis=1)
    sh[..., 2] = np.roll(c[..., 2], -k, axis=1)
    return c * (1 - rad) + sh * rad


def finish(c, grain=0.035, vig=0.55):
    if ATMOS:
        c = film(c)
        vig += 0.18
    H, W = c.shape[:2]
    # ブルーム
    hi = np.clip(c - 0.62, 0, 1)
    c = c + blur(hi, min(H, W) * 0.02) * 0.45
    # 周辺減光
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    c = c * (1 - vig * np.clip(r - 0.55, 0, 1) ** 1.6)[..., None]
    # 締め（S字）と赤黒への寄せ
    c = np.clip(c, 0, 1)
    c = c * c * (3 - 2 * c) * 0.8 + c * 0.2
    c = np.clip(c * 1.04 - 0.035, 0, 1)
    c = c * np.array([1.0, 0.97, 1.0])
    # 粒子
    n = rng.normal(0, grain, (H, W, 1)).astype(np.float32)
    c = c + n * (0.35 + 0.65 * (1 - lum(c))[..., None])
    return np.clip(c, 0, 1)


def save(c, name, out_size=None):
    os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
    im = Image.fromarray((np.clip(c, 0, 1) * 255 + rng.random(c.shape) * 0.999).astype(np.uint8))
    if out_size:
        im = im.resize(out_size, Image.LANCZOS)
    p = os.path.join(ROOT, "out", name)
    im.save(p + ".png")
    im.save(p + ".jpg", quality=93, subsampling=0)
    print("saved", p + ".png", im.size)


def logo_layer(path, width):
    """透過のロゴを余白なしに切り出して、幅を合わせる"""
    lg = load(path)
    al = lg[..., 3]
    ys, xs = np.where(al > 0.5)
    lg = lg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    lg = scale(lg, width / lg.shape[1])
    rgb, al = lg[..., :3], lg[..., 3]
    al = np.clip((al - 0.4) / 0.6, 0, 1)   # 元画像についている薄い影を落とす（切り抜くと四角い縁が見えるため）
    return np.clip(rgb, 0, 1), al


def draw_logo(c, path, width, cx, y, glow=0.5):
    rgb, al = logo_layer(path, width)
    h, w = al.shape
    x = cx - w / 2
    p = 280
    sm = np.clip(blur(np.pad(al, p), 34) * 1.7, 0, 1) * 0.92
    put(c, np.zeros(3), sm, x - p, y - p + 10)
    gm = blur(np.pad(al, p), 60) * glow
    put(c, RED, gm, x - p, y - p, "add")
    put(c, rgb, al, x, y)
    return x, y, w, h


def crimson(c, k=0.80):
    """明るい朱赤を、ロゴと同じ暗い深紅に寄せる（赤を下げ、青みを少し足す）"""
    l = lum(c)[..., None]
    r = c[..., :1]
    out = np.concatenate([r * k, c[..., 1:2] * 0.55 + r * 0.03, c[..., 2:3] * 0.6 + r * 0.14], axis=-1)
    return out


def _noise(h, w, cell, seed, aspect=1.0):
    r = np.random.default_rng(seed)
    cy, cx = max(1, int(cell)), max(1, int(cell * aspect))
    n = r.random((h // cy + 2, w // cx + 2)).astype(np.float32)
    return zoom(n, (cy, cx), order=1)[:h, :w]


def distress(mask, seed=1, chip=0.5, amount=1.0):
    """古い刷り物のように、欠け・かすれ・引っかき傷を入れる。色むら（汚れ）も一緒に返す"""
    h, w = mask.shape
    r = np.random.default_rng(seed)
    big = _noise(h, w, 46, seed) * 0.6 + _noise(h, w, 17, seed + 1) * 0.4      # 大きな欠け
    chips = np.clip((big - (0.235 + 0.06 * (1 - chip))) * 16, 0, 1)
    dry = _noise(h, w, 3, seed + 2, aspect=9) * 0.55 + _noise(h, w, 2, seed + 3) * 0.45   # 横に流れるかすれ
    zone = np.clip((_noise(h, w, 90, seed + 4) - 0.50) * 5, 0, 1) * 0.8                # かすれが出る帯
    dry = 1 - zone * np.clip((0.62 - dry) * 7, 0, 1)
    speck = np.clip((_noise(h, w, 2, seed + 5) - 0.07) * 30, 0, 1)                # 細かい抜け
    sc = Image.new("L", (w, h), 255)                                             # 引っかき傷
    d = ImageDraw.Draw(sc)
    for _ in range(int(h * w / 42000) + 4):
        x, y = r.random() * w, r.random() * h
        a = r.normal(0.5, 0.5)
        ln = 40 + r.random() * 260
        d.line((x, y, x + np.cos(a) * ln, y + np.sin(a) * ln), fill=0, width=int(1 + r.random() * 3))
    sc = np.asarray(sc, dtype=np.float32) / 255.0
    # 縁を少し食わせる（にじんで潰れた版）
    edge = gaussian_filter(mask, 2.2)
    eaten = np.clip((edge - 0.27 - 0.16 * _noise(h, w, 5, seed + 6)) * 9, 0, 1)
    m = eaten * (1 - amount * (1 - chips * dry * speck * sc))
    grime = 0.70 + 0.30 * np.clip(_noise(h, w, 30, seed + 7) * 0.6 + _noise(h, w, 7, seed + 8) * 0.6, 0, 1)
    col = BONE[None, None, :] * grime[..., None] * np.array([1.0, 0.95, 0.90])
    return m, col


def ragged_frame(c, width=84, rag=60, seed=77):
    """赤くぼろぼろの外枠。内側のへりは破れ、面はかすれて所々はげる"""
    H, W = c.shape[:2]
    r = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.minimum(np.minimum(xx, W - 1 - xx), np.minimum(yy, H - 1 - yy))

    def nz(sg):
        n = blur(r.random((H, W)).astype(np.float32), sg)
        return (n - n.min()) / (n.max() - n.min())
    edge = nz(70) * 0.5 + nz(22) * 0.32 + nz(6) * 0.18            # へりの破れ方
    m = np.clip((width + (edge - 0.5) * rag * 2 - d) / 5, 0, 1)
    tex = nz(34) * 0.55 + nz(4) * 0.45                            # 面のむら
    worn = np.clip((tex - 0.36) * 9, 0, 1)                        # はげて黒が出る所
    col = np.array([0.50, 0.04, 0.10]) * (0.42 + 0.95 * nz(120))[..., None] * (0.15 + 0.85 * worn)[..., None]
    col *= (0.55 + 0.45 * np.clip(d / width, 0, 1))[..., None]    # 外へ向かって少し暗く
    c *= (1 - 0.6 * np.clip(blur(m, 26) * 1.4, 0, 1))[..., None]  # 枠が絵に落とす影
    return c * (1 - m[..., None]) + col * m[..., None]


def draw_row(c, parts, x, base, gap, anchor="c", sigma=12):
    """大きさの違う文字を1行に並べる。parts=[(文字, 大きさ, 色, 下げ幅)]"""
    masks = [text_mask(t, F_MIN, sz, tracking=0.05) if t.strip() else np.zeros((4, sz), np.float32) for t, sz, _, _ in parts]
    total = sum(m.shape[1] for m in masks) + gap * (len(masks) - 1)
    if anchor == "c":
        x -= total / 2
    elif anchor == "r":
        x -= total
    for (t, sz, col, dy), m in zip(parts, masks):
        draw_text(c, m, x, base - dy, col, shadow=0.9, shadow_sigma=sigma, anchor="lb")
        x += m.shape[1] + gap


LABEL = BONE * 0.80   # 小さい見出しの色。暗い地に暗い色は読めないので白寄りにする


def vertical_var(parts, font_path=F_MIN, gap=0.06):
    """縦組みで字の大きさを変える（助詞は小さく、要の言葉は大きく）。parts=[(文字列, 大きさ)]"""
    chars = [(ch, sz) for t, sz in parts for ch in t]
    mx = max(sz for _, sz in chars)
    pad = mx
    Hh = int(sum(sz * (1 + gap) for _, sz in chars) + pad * 2)
    im = Image.new("L", (int(mx + pad * 2), Hh), 0)
    d = ImageDraw.Draw(im)
    y, cx = pad, pad + mx / 2
    for ch, sz in chars:
        font = ImageFont.truetype(font_path, sz)
        if ch in "、。":
            d.text((cx + sz * 0.22, y - sz * 0.62), ch, font=font, fill=255)
            y += sz * 0.72
        else:
            d.text((cx, y + sz / 2), ch, font=font, fill=255, anchor="mm")
            y += sz * (1 + gap)
    m = np.asarray(im, dtype=np.float32) / 255.0
    ys, xs = np.where(m > 0.02)
    return m[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5]


# ======================================================================
# ここから案件ごとに書き換える
# ======================================================================
COPY_R = [("奪われた", 226), ("光", 396), ("を追い、", 226)]     # 右の縦書き（文字列, 大きさ）。要の言葉を大きく、助詞を小さく
COPY_L = [("目指せ。", 236), ("頂へ。", 396)]                    # 左の縦書き
INFO = [("10.13", 112, BONE, 0), ("火", 58, LABEL, 8), ("20:00", 112, BONE, 0), ("　", 70, BONE, 0),
        ("進行", 52, LABEL, 8), ("やまだ", 96, BONE, 0), ("　", 36, BONE, 0), ("主演", 52, LABEL, 8), ("たなか", 96, BONE, 0)]
CREDIT = "ここに権利表記や注意書きを入れる（不要なら空に）"


def asset(name):
    p = os.path.join(ASSETS, name)
    return p if os.path.exists(p) else None


def placeholder_bg(W, H):
    """背景が無いときの仮の絵（上が明るい赤い空、下は暗い地面）"""
    sky = vramp(H, W, 0, H * 0.55, 1, 0)[..., None] * np.array([0.9, 0.12, 0.10])
    n = blur(rng.random((H, W)).astype(np.float32), 90)
    n = (n - n.min()) / (n.max() - n.min())
    return np.clip(sky * (0.4 + 0.9 * n[..., None]) + np.array([0.10, 0.02, 0.02]) * (0.3 + n[..., None]), 0, 1).astype(np.float32)


def placeholder_figure(w, h, color=(0.85, 0.80, 0.74)):
    """立ち絵が無いときの仮の人影（頭と胴の形だけ）。RGBA を返す"""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    head = ((xx - w / 2) / (w * 0.17)) ** 2 + ((yy - h * 0.17) / (h * 0.12)) ** 2 < 1
    body = (np.abs(xx - w / 2) < w * (0.16 + 0.22 * np.clip((yy - h * 0.28) / (h * 0.25), 0, 1))) & (yy > h * 0.27)
    al = gaussian_filter((head | body).astype(np.float32), 3)
    rgb = np.ones((h, w, 3), np.float32) * np.array(color, np.float32) * (0.75 + 0.25 * (1 - yy / h))[..., None]
    return np.dstack([rgb, al])


def get_bg(name, W, H):
    p = asset(name)
    if not p:
        return placeholder_bg(W, H)
    bg = load(p)[..., :3]
    k = max(W / bg.shape[1], H / bg.shape[0])                      # 画面を覆う大きさに合わせて、中央を切り出す
    bg = resize(bg, round(bg.shape[1] * k) + 1, round(bg.shape[0] * k) + 1)
    y0, x0 = (bg.shape[0] - H) // 2, (bg.shape[1] - W) // 2
    return bg[y0:y0 + H, x0:x0 + W].copy()


def get_figure(name, height):
    """立ち絵を高さ height px に合わせて返す（rgb, alpha）"""
    p = asset(name)
    a = load(p) if p else placeholder_figure(800, 1600)
    a = scale(a, height / a.shape[0])
    return a[..., :3].copy(), a[..., 3]


def text_logo(c, text, size, cx, y):
    """題字の画像が無いときは文字で代用する"""
    m = text_mask(text, F_MIN, size, tracking=0.04)
    x, y2, w, h = draw_text(c, m, cx, y, RED * 1.25, shadow=0.92, shadow_sigma=30, glow=(RED, 60, 0.5), anchor="ct")
    return x, y2, w, h


def fbm(H, W, seed):
    r = np.random.default_rng(seed)
    out = np.zeros((H, W), np.float32)
    for sg, wt in ((230, 0.5), (110, 0.27), (48, 0.15), (20, 0.08)):
        n = blur(r.random((H, W)).astype(np.float32), sg)
        out += (n - n.min()) / (n.max() - n.min()) * wt
    return out


# ---------- 縦長ポスター（3:4） ----------
def poster(ver):
    W, H = 3000, 4000
    c = get_bg("bg_tall.jpg", W, H)
    c = gaussian_filter(c, (1.4, 1.4, 0))
    c = np.clip((c - 0.5) * 1.15 + 0.46, 0, 1)
    c *= vramp(H, W, 1700, 3600, 1.0, 0.62)[..., None]            # 地面は見せる（黒く塗りつぶさない）

    # 奥：大きな人物を2色に落として見下ろさせる。色つきは主役だけにする（まず顔に目が行く）
    br, ba = get_figure("back.png", 4400)
    br = gaussian_filter(duotone(br, np.array([0.012, 0, 0]), (0.60, 0.04, 0.10), 2.2, 1.5), (2.2, 2.2, 0))
    ba = ba * vramp(ba.shape[0], ba.shape[1], 1250, 2500, 1.0, 0.0)
    put(c, br * 0.9, ba * 0.93, W / 2 - ba.shape[1] / 2, -150)
    c = crimson(c)

    if ATMOS:
        c = rays(c, W * 0.5, -H * 0.08)

    # 主役
    nr, na = get_figure("hero.png", 5400)
    nx, ny = W / 2 - na.shape[1] / 2, 540
    put(c, np.array([0.70, 0.07, 0.12]), blur(np.pad(na, 300), 110) * 0.42, nx - 300, ny - 300, "add")   # 背後の逆光
    put(c, np.zeros(3), np.clip(blur(np.pad(na, 60), 22), 0, 1) * 0.55, nx - 60, ny - 60)
    nr = grade_hero(nr, na, 2000, 3300)
    na = na * vramp(na.shape[0], na.shape[1], 2560 - ny, 3080 - ny, 1.0, 0.0)    # 足元は砂煙に溶かす（闇で隠さない）
    put(c, nr, na, nx, ny)

    # 下：地面を見せ、主役の足元は場の色の砂煙に溶かす。題字の後ろだけを、ふちの崩れた影で落とす
    f1, f2 = fbm(H, W, 41), fbm(H, W, 42)
    band = vramp(H, W, 2250, 2850, 0, 1) * vramp(H, W, 3050, 3700, 1, 0)
    haze = np.clip(band * (0.25 + 1.6 * f1), 0, 1)
    c = c * (1 - 0.45 * haze)[..., None] + np.array([0.36, 0.035, 0.075]) * (haze * (0.35 + 1.1 * f2))[..., None]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - W / 2) / 1750) ** 2 + ((yy - 3310) / 560) ** 2) + (f2 - 0.5) * 0.55
    seat = np.clip(1.15 - d, 0, 1)
    c *= (1 - 0.90 * seat * seat * (3 - 2 * seat))[..., None]
    c *= vramp(H, W, 3560, 4000, 1.0, 0.30)[..., None]

    core, halo = embers(H, W, 260, 2.0, 2, 11, seed=3)
    c += EMBER * halo[..., None] * 0.9 + np.array([1.0, 0.70, 0.42]) * core[..., None] * 0.8
    c = finish(c)
    c = ragged_frame(c)                                             # ぼろぼろの外枠（要らなければ消す）

    # ---- 文字 ----  コピーは1つだけ。右上から左へ（縦書きの読み順）→ 顔 → 題字 → 日時、と上から下へ流す
    m, _ = distress(vertical_var(COPY_R, gap=0.0), seed=21, amount=0.5)
    draw_text(c, m, W - 292, 150, BONE, shadow=0.92, shadow_sigma=26, anchor="ct")
    m, _ = distress(vertical_var(COPY_L, gap=0.0), seed=52, amount=0.5)
    draw_text(c, m, 288, 210, BONE, shadow=0.92, shadow_sigma=26, anchor="ct")

    if asset("logo.png"):
        draw_logo(c, asset("logo.png"), 2060, W / 2, 2915)
    else:
        text_logo(c, "TITLE", 520, W / 2, 2960)
    draw_row(c, INFO, W / 2, H - 236, 28)
    if CREDIT:
        m = text_mask(CREDIT, F_MINB, 38, tracking=0.12)
        draw_text(c, m, W / 2, H - 152, BONE * 0.72, shadow=0.8, shadow_sigma=8, anchor="cc")
    save(c, f"poster_{ver}")


# ---------- 配信サムネ（16:9） ----------
def thumb(ver):
    W, H = 3840, 2160
    c = get_bg("bg_wide.jpg", W, H)
    c = duotone(c, np.array([0.015, 0.0, 0.0]), (1.0, 0.13, 0.09), gamma=0.95, gain=1.75).astype(np.float32)
    c = gaussian_filter(c, (1.2, 1.2, 0))
    c *= vramp(H, W, 1100, 2100, 1.0, 0.30)[..., None]

    br, ba = get_figure("back.png", 4700)
    br = gaussian_filter(duotone(br, np.array([0.012, 0, 0]), (0.60, 0.04, 0.10), 2.2, 1.5), (2.6, 2.6, 0))
    ba = ba * vramp(ba.shape[0], ba.shape[1], 1000, 1900, 1.0, 0.0)
    put(c, br * 0.9, ba * 0.93, 1330 - ba.shape[1] / 2, -300)
    c = crimson(c)
    if ATMOS:
        c = rays(c, W * 0.42, -H * 0.25, strength=0.2)

    # 主役は画面からはみ出すくらい大きく
    nr, na = get_figure("hero.png", 8480)
    nr, na = nr[:2700], na[:2700]
    nx, ny = 2840 - na.shape[1] / 2, -350
    put(c, np.array([0.70, 0.07, 0.12]), blur(np.pad(na, 300), 110) * 0.42, nx - 300, ny - 300, "add")
    put(c, np.zeros(3), np.clip(blur(np.pad(na, 60), 24), 0, 1) * 0.55, nx - 60, ny - 60)
    nr = grade_hero(nr, na, 99000, 99999, rim=1.6)                  # 下を闇に沈めない
    put(c, nr, na, nx, ny)

    # 左（題字の後ろ）だけ落とす
    yy, xg = np.mgrid[0:H, 0:W].astype(np.float32)
    dk = np.clip(1 - np.sqrt(((xg - 900) / 2300) ** 2 + ((yy - 1500) / 1150) ** 2), 0, 1) ** 1.2
    c *= (1 - 0.9 * dk)[..., None]

    core, halo = embers(H, W, 200, 1.9, 2, 12, seed=5)
    c += EMBER * halo[..., None] * 0.9 + np.array([1.0, 0.70, 0.42]) * core[..., None] * 0.8
    c = finish(c, grain=0.03, vig=0.5)

    # 題字と出演のかたまりを、上下の真ん中より気持ち下に
    if asset("logo.png"):
        lh0 = logo_layer(asset("logo.png"), 1960)[1].shape[0]
        top = (H - (lh0 + 110 + 150)) / 2 + 60
        lx, ly, lw, lh = draw_logo(c, asset("logo.png"), 1960, 1110, top, glow=0.5)
    else:
        lx, ly, lw, lh = text_logo(c, "TITLE", 520, 1110, 640)
    draw_row(c, [p for p in INFO[4:]] if len(INFO) > 4 else INFO, 1110, ly + lh + 110 + 150, 34)
    save(c, f"thumb_{ver}", (1920, 1080))


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    ver = sys.argv[2] if len(sys.argv) > 2 else "v1"
    if what in ("poster", "all"):
        poster(ver)
    if what in ("thumb", "all"):
        thumb(ver)
