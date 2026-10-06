"""
効果音を合成する（ダウンロード不要・権利の心配なし）。
  python motion-kit/audio/synth_se.py                 … 全部を motion-kit/public/se/ に作る（＋ se_catalog.json）
  python motion-kit/audio/synth_se.py --list          … 一覧と説明
  python motion-kit/audio/synth_se.py impact riser_4s --out <案件>/video/public/se   … 選んで案件へ
  python motion-kit/audio/synth_se.py riser --dur 2.4 --name riser_6beat --out ...  … 長さを変えて（拍に合わせる）
2026-09〜10 の案件（書籍のトレーラー・シナリオのトレーラー・ゲーム紹介動画）の synth_se.py を1本にまとめて、種類を足したもの。
出力は 44.1kHz・16bit・ステレオ wav、ピーク -1dBFS（0.89）。音量は動画側（volume 0.2〜0.32 が目安）で決める。
"""
import argparse, json, os, sys, wave
import numpy as np
from scipy.signal import butter, lfilter, fftconvolve

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.join(HERE, "..", "public", "se")


# ---------------- 道具 ----------------
def T(d):
    return np.arange(int(SR * d)) / SR


def rng(seed):
    return np.random.default_rng(seed)


def noise(d, seed=7):
    return rng(seed).standard_normal(int(SR * d))


def lp(x, f, order=2):
    b, a = butter(order, min(f, SR / 2 - 100) / (SR / 2), "low")
    return lfilter(b, a, x)


def hp(x, f, order=2):
    b, a = butter(order, max(f, 10) / (SR / 2), "high")
    return lfilter(b, a, x)


def bp(x, f0, f1, order=2):
    b, a = butter(order, [max(f0, 10) / (SR / 2), min(f1, SR / 2 - 100) / (SR / 2)], "band")
    return lfilter(b, a, x)


def lp_sweep(x, cut, order=2, block=441):
    """カットオフが時間で動くローパス（cut は x と同じ長さの配列）。10ms ごとに係数を変え、状態は引き継ぐ"""
    y = np.empty_like(x)
    zi = np.zeros(order)
    for i in range(0, len(x), block):
        f = float(np.clip(cut[min(i, len(cut) - 1)], 20, SR / 2 - 200))
        b, a = butter(order, f / (SR / 2), "low")
        y[i:i + block], zi = lfilter(b, a, x[i:i + block], zi=zi)
    return y


def lpv(x, a):
    """係数が時間で変わる1次ローパス（a が小さいほどこもる）。風切り・ための帯域の動きに"""
    a = np.broadcast_to(a, x.shape)
    y = np.empty_like(x)
    s = 0.0
    for i in range(len(x)):
        s += a[i] * (x[i] - s)
        y[i] = s
    return y


def sweep(f, d=None):
    """周波数の列（または関数）→ 位相を積分したサイン"""
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def saw(f):
    ph = np.cumsum(f) / SR
    return 2 * (ph - np.floor(ph + 0.5))


def env_ad(tt, a, d_rate):
    return np.minimum(1, tt / max(a, 1e-4)) * np.exp(-np.maximum(0, tt - a) * d_rate)


def reverb(x, dur=1.6, mix=0.3, tone=5000, seed=3, pre=0.01):
    """指数減衰ノイズとの畳み込み（簡単な残響）。ステレオで返す"""
    tt = T(dur)
    out = []
    for ch in range(2):
        ir = lp(noise(dur, seed + ch), tone) * np.exp(-tt * 6.9 / dur)
        ir = np.concatenate([np.zeros(int(SR * pre)), ir])
        ir /= np.sqrt((ir ** 2).sum()) + 1e-9
        wet = fftconvolve(x, ir)[: len(x) + len(ir)]
        dry = np.concatenate([x, np.zeros(len(wet) - len(x))])
        out.append(dry * (1 - mix) + wet * mix * 3)
    return np.stack(out, 1)


def stereo(x, width=0.0, seed=11):
    """モノ → ステレオ（左右同じ）。
    左右を少しずらして広げる方式は、スマホのスピーカー（モノ）で鳴らすと櫛形のうなり（周期的な帯）が出たのでやめた（2026-10-04、se_sheet.py で確認）。
    広げたい音は左右で別のノイズから作る（whoosh・reverb のように）"""
    if x.ndim == 2:
        return x
    return np.stack([x, x], 1)


def pad(x, d):
    n = int(SR * d)
    if x.ndim == 1:
        return np.concatenate([x, np.zeros(max(0, n - len(x)))])
    return np.concatenate([x, np.zeros((max(0, n - len(x)), 2))])


def mix(*xs):
    n = max(len(x) for x in xs)
    st = [stereo(x) for x in xs]
    return sum(np.concatenate([s, np.zeros((n - len(s), 2))]) for s in st)


def fade_tail(x, d=0.02):
    n = min(len(x), int(SR * d))
    w = np.ones(len(x))
    w[-n:] = np.linspace(1, 0, n)
    return x * (w[:, None] if x.ndim == 2 else w)


# ---------------- 音 ----------------
def sub(d=2.2, f0=60, f1=32):
    tt = T(d)
    f = f1 + (f0 - f1) * np.exp(-tt * 3.0)
    return sweep(f) * np.exp(-tt * 1.6) * np.minimum(1, tt / 0.003) + lpv(noise(d), 0.08) * np.exp(-tt * 40) * 0.6


def impact(d=1.6):
    tt = T(d)
    body = sweep(45 + 90 * np.exp(-tt * 18)) * np.exp(-tt * 5) * np.minimum(1, tt / 0.002)
    crack = bp(noise(d, 2), 800, 7000) * np.exp(-tt * 45) * 0.9
    thump = lp(noise(d, 5), 300) * np.exp(-tt * 14) * 1.5
    return reverb(body + crack + thump, dur=1.2, mix=0.22)


def boom(d=4.0):
    tt = T(d)
    body = sweep(38 + 70 * np.exp(-tt * 10)) * np.exp(-tt * 1.4) * np.minimum(1, tt / 0.002)
    rumble = lp(noise(d, 8), 120, 4) * np.exp(-tt * 1.2) * 4
    crack = bp(noise(d, 9), 500, 5000) * np.exp(-tt * 25)
    return reverb(body + rumble + crack, dur=3.0, mix=0.35, tone=3000)


def hit_short(d=0.35):
    tt = T(d)
    return sweep(70 + 160 * np.exp(-tt * 40)) * np.exp(-tt * 18) + bp(noise(d, 4), 1500, 8000) * np.exp(-tt * 80) * 0.7


def thud(d=0.5):
    tt = T(d)
    return lp(noise(d, 6), 220, 4) * np.exp(-tt * 16) * 5 + sweep(55 + 40 * np.exp(-tt * 30)) * np.exp(-tt * 12)


def whoosh(d=0.6, peak=0.38, a0=0.03, a1=0.3, seed=7, rate=9):
    tt = T(d)
    env = np.where(tt < peak, (tt / peak) ** 2, np.exp(-(tt - peak) * rate))
    l = lpv(noise(d, seed), np.interp(tt, [0, peak, d], [a0, a1, a0])) * env
    r = lpv(noise(d, seed + 1), np.interp(tt, [0, peak, d], [a0, a1, a0])) * env
    return np.stack([l, r], 1)


def swoosh_up(d=0.7):
    tt = T(d)
    env = (tt / d) ** 1.6 * np.exp(-np.maximum(0, tt - d * 0.85) * 40)
    a = 0.02 + 0.4 * (tt / d) ** 2
    return stereo(lpv(noise(d, 21), a) * env + sweep(300 * 2 ** (tt / d * 2)) * env * 0.08, 0.6)


def riser(d=3.2, f0=80, oct=2.4):
    tt = T(d)
    y = lpv(noise(d), 0.01 + 0.3 * (tt / d) ** 2)
    fr = f0 * 2 ** (tt / d * oct)
    tone = sweep(fr) * 0.3 + sweep(fr * 1.5) * 0.15
    return stereo((y * 1.4 + tone) * (tt / d) ** 2.2, 0.8)


def riser_tonal(d=3.2):
    """音程だけで上がっていく（ノイズなし）。上品なため・ロゴの前"""
    tt = T(d)
    out = 0
    for k, base in enumerate([110, 165, 220, 330]):
        fr = base * 2 ** (tt / d * 1.0)
        out = out + sweep(fr * (1 + 0.003 * k)) * (0.35 / (k + 1))
    trem = 1 + 0.25 * np.sin(2 * np.pi * (4 + 10 * tt / d) * tt)
    end = np.minimum(1, (d - tt) / 0.015)  # 最後でぷつっと切れる音（クリック）を消す
    return reverb(out * trem * (tt / d) ** 2.0 * end, dur=1.5, mix=0.3)


def downlifter(d=2.0):
    tt = T(d)
    y = lpv(noise(d, 31), 0.3 * (1 - tt / d) ** 2 + 0.01)
    tone = sweep(400 * 2 ** (-tt / d * 3)) * 0.25
    return stereo((y * 1.2 + tone) * np.exp(-tt * 1.8) * np.minimum(1, tt / 0.01), 0.8)


def revcym(d=1.4):
    tt = T(d)
    n = noise(d)
    cym = (n - lpv(noise(d, 2), 0.3)) * np.exp(-tt * 3.2)
    return stereo(cym[::-1] * 0.8, 0.5)


def rush(d=2.3):
    tt = T(d)
    n = noise(d)
    cym = (n - lpv(n, 0.3)) * np.exp(-tt * 1.7)
    air = whoosh(d, d - 0.02, 0.01, 0.2)[:, 0][::-1]
    return stereo(cym[::-1] * 0.8 + air[::-1] * 0.5, 0.6)


def crash(d=3.2):
    tt = T(d)
    n = noise(d)
    hi = n - lpv(n, 0.35)
    r = rng(3)
    metal = sum(np.sin(2 * np.pi * f0 * tt + r.uniform(0, 6)) for f0 in (3150, 4270, 5390, 6710, 8030)) * 0.12
    return stereo((hi * 0.9 + metal) * (np.exp(-tt * 1.5) * 0.85 + np.exp(-tt * 9) * 0.6) * np.minimum(1, tt / 0.003), 0.7)


def tick(d=0.12, f=2400):
    tt = T(d)
    return np.sin(2 * np.pi * f * tt) * np.exp(-tt * 180) + lpv(noise(d), 0.5) * np.exp(-tt * 260) * 0.5


def key(d=0.05, seed=7, f=1800):
    tt = T(d)
    return lpv(noise(d, seed), 0.5) * np.exp(-tt * 140) + np.sin(2 * np.pi * f * tt) * np.exp(-tt * 200) * 0.3


def glitch(d=0.16):
    tt = T(d)
    n = noise(d)
    gate = (np.floor(tt * 90) % 2 == 0).astype(float) * 0.7 + 0.3
    crush = np.round(n * 3) / 3
    return stereo((crush - lpv(crush, 0.2)) * gate * np.exp(-tt * 14), 0.5)


def static_burst(d=0.45):
    tt = T(d)
    n = bp(noise(d, 12), 400, 9000)
    gate = 0.6 + 0.4 * (np.floor(tt * 60) % 3 != 0)
    return stereo(n * gate * np.minimum(1, tt / 0.005) * np.exp(-np.maximum(0, tt - d * 0.6) * 20), 0.8)


def zap(d=0.35):
    tt = T(d)
    f = 2400 * np.exp(-tt * 9) + 120
    car = sweep(f + 600 * np.sin(2 * np.pi * 70 * tt))
    return car * np.exp(-tt * 9) * 0.8 + bp(noise(d, 14), 2000, 9000) * np.exp(-tt * 30) * 0.4


def blip(d=0.09, f0=1200, f1=1800):
    tt = T(d)
    return sweep(np.linspace(f0, f1, len(tt))) * np.exp(-tt * 38) * np.minimum(1, tt / 0.002)


def pop(d=0.09):
    tt = T(d)
    return sweep(900 * np.exp(-tt * 30) + 250) * np.exp(-tt * 45) * np.minimum(1, tt / 0.001)


def click(d=0.03):
    tt = T(d)
    return hp(noise(d, 15), 2000) * np.exp(-tt * 400)


def notify(d=0.6):
    tt = T(d)
    a = np.sin(2 * np.pi * 1318 * tt) * env_ad(tt, 0.004, 9)
    t2 = np.maximum(0, tt - 0.11)
    b = np.sin(2 * np.pi * 1760 * t2) * env_ad(t2, 0.004, 7) * (tt > 0.11)
    return reverb(a * 0.6 + b * 0.6, 0.8, 0.2)


def shutter(d=0.25):
    tt = T(d)
    c1 = hp(noise(d, 16), 1500) * np.exp(-tt * 120)
    t2 = np.maximum(0, tt - 0.07)
    c2 = hp(noise(d, 17), 1000) * np.exp(-t2 * 90) * (tt > 0.07)
    return c1 * 0.9 + c2 * 0.7 + lp(noise(d, 18), 400) * np.exp(-tt * 40) * 0.5


def heartbeat(d=1.0):
    def beat(at, amp):
        tt = T(d) - at
        on = tt >= 0
        tt = np.maximum(0, tt)
        return (sweep(np.full(len(tt), 48.0)) * np.exp(-tt * 22) + lp(noise(d, 19), 150) * np.exp(-tt * 30) * 2) * on * amp
    return beat(0, 1) + beat(0.22, 0.7)


def ring(d=2.6):
    tt = T(d)
    r = np.sin(2 * np.pi * (5200 + 40 * np.sin(tt * 3)) * tt) * 0.6 + np.sin(2 * np.pi * 3900 * tt) * 0.25
    return r * np.minimum(1, tt / 0.5) * np.exp(-tt * 1.1)


def hum(d=3.0):
    tt = T(d)
    return (np.sin(2 * np.pi * 40 * tt) + np.sin(2 * np.pi * 43 * tt) * 0.8) * np.exp(-tt * 0.9) * np.minimum(1, tt / 0.02)


def roomtone(d=3.4):
    tt = T(d)
    rt = lpv(noise(d), 0.015) * 3 + np.sin(2 * np.pi * 55 * tt) * 0.05
    return stereo(rt * np.minimum(1, tt / 0.6) * np.minimum(1, (d - tt) / 0.8), 1)


def drone_dark(d=6.0):
    tt = T(d)
    base = sum(saw(np.full(len(tt), f * (1 + dt))) for f, dt in ((55, 0), (55, 0.004), (82.4, -0.003), (58.3, 0.002)))
    y = lp_sweep(base, 300 + 200 * np.sin(2 * np.pi * 0.15 * tt) ** 2) * 0.3
    return reverb(y * np.minimum(1, tt / 1.5) * np.minimum(1, (d - tt) / 1.5), 2.5, 0.35, 2500)


def braam(d=3.0):
    """映画の予告編の「ブォーン」：低い鋸波を重ねて、こもり→開く→こもる。ここぞの重い一打"""
    tt = T(d)
    voices = sum(saw(np.full(len(tt), f * (1 + dt))) for f in (55, 110, 82.4) for dt in (-0.006, 0, 0.007))
    cut = 200 + 2200 * np.exp(-((tt - 0.35) / 0.5) ** 2)
    y = np.tanh(lp_sweep(voices, cut) * 1.8)
    env = np.minimum(1, tt / 0.04) * np.exp(-tt * 0.9)
    return reverb(y * env + sub(d, 50, 35)[: len(tt)] * 0.5, 2.5, 0.3, 3000)


def sparkle(d=1.3, seed=23):
    """きらん：高い澄んだ音の粒がいくつか鳴って消える。決定・機能紹介"""
    tt = T(d)
    r = rng(seed)
    out = np.zeros(len(tt))
    for k in range(9):
        at = k * 0.035 + r.uniform(0, 0.02)
        f = r.choice([2093, 2637, 3136, 3520, 4186, 5274])
        t2 = np.maximum(0, tt - at)
        out += np.sin(2 * np.pi * f * t2) * np.exp(-t2 * (6 + k)) * (tt >= at) * (0.6 - k * 0.04)
    return reverb(out, 1.2, 0.3, 9000)


def shimmer_up(d=1.6, seed=29):
    tt = T(d)
    r = rng(seed)
    out = np.zeros(len(tt))
    notes = [523, 659, 784, 1047, 1319, 1568, 2093, 2637, 3136]
    for k, f in enumerate(notes):
        at = k * 0.09
        t2 = np.maximum(0, tt - at)
        out += np.sin(2 * np.pi * f * t2) * np.exp(-t2 * 5) * (tt >= at) * 0.5 + np.sin(2 * np.pi * f * 2.01 * t2) * np.exp(-t2 * 9) * (tt >= at) * 0.15
    return reverb(out + bp(noise(d, seed), 6000, 14000) * (tt / d) * 0.05, 1.4, 0.35, 9000)


def magic(d=1.8):
    tt = T(d)
    out = np.zeros(len(tt))
    for k, f in enumerate([784, 988, 1175, 1568]):
        at = k * 0.07
        t2 = np.maximum(0, tt - at)
        out += (np.sin(2 * np.pi * f * t2) + 0.3 * np.sin(2 * np.pi * f * 3 * t2)) * np.exp(-t2 * 3.5) * (tt >= at) * 0.4
    return reverb(out, 1.8, 0.4, 8000)


def bell(d=2.8, f=660):
    tt = T(d)
    parts = [(1, 1, 1.2), (2.0, 0.6, 1.8), (2.76, 0.45, 2.4), (5.4, 0.25, 3.5), (8.9, 0.12, 5)]
    out = sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt * dr) for m, a, dr in parts)
    return reverb(out * np.minimum(1, tt / 0.002), 2.0, 0.3, 7000)


def stinger(d=1.6):
    """判定・正体が分かる瞬間：一打＋下がっていく不協和の音"""
    tt = T(d)
    hitp = impact(d)[:, 0][: len(tt)]
    f = 220 * 2 ** (-tt * 0.6)
    tone = (saw(f) + saw(f * 1.06)) * 0.25
    tone = lp(tone, 1800) * np.exp(-tt * 1.6) * np.minimum(1, tt / 0.01)
    return reverb(hitp * 0.8 + tone, 1.5, 0.3)


def tape_stop(d=0.8):
    tt = T(d)
    f = 330 * (1 - tt / d) ** 2 + 20
    return (saw(f) * 0.4 + lp(noise(d, 33), 1000) * 0.2) * (1 - tt / d) * np.minimum(1, tt / 0.005)


def swell(d=2.5):
    tt = T(d)
    chord = sum(np.sin(2 * np.pi * f * tt) + 0.2 * np.sin(2 * np.pi * f * 2 * tt) for f in (220, 277.2, 329.6, 440))
    env = (tt / d) ** 2.5 * np.exp(-np.maximum(0, tt - d * 0.92) * 40)
    return reverb(chord * env * 0.25, 1.2, 0.3)


def tension(d=3.0):
    tt = T(d)
    voices = sum(saw(np.full(len(tt), f * (1 + dt))) for f, dt in ((880, 0), (932, 0.002), (988, -0.002)))
    trem = 0.6 + 0.4 * np.sin(2 * np.pi * 9 * tt)
    y = bp(voices, 500, 5000) * trem * np.minimum(1, tt / 0.8) * np.minimum(1, (d - tt) / 0.3) * 0.25
    return reverb(y, 1.5, 0.3, 6000)


def page(d=0.45):
    tt = T(d)
    flutter = 0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 18 * tt))
    return stereo(bp(noise(d, 35), 1200, 7000) * flutter * np.sin(np.pi * tt / d) ** 2, 0.5)


def tvoff(d=0.7):
    tt = T(d)
    whine = np.sin(2 * np.pi * np.cumsum(15000 * np.exp(-tt * 6) + 200) / SR) * np.exp(-tt * 5) * 0.3
    clk = hp(noise(d, 37), 800) * np.exp(-tt * 200)
    hm = lp(noise(d, 38), 200) * np.exp(-tt * 9) * 1.5
    return clk + whine + hm


def chime_ok(d=0.9):
    """正解・OK（上がる2音）"""
    tt = T(d)
    a = np.sin(2 * np.pi * 1047 * tt) * env_ad(tt, 0.003, 6)
    t2 = np.maximum(0, tt - 0.09)
    b = np.sin(2 * np.pi * 1568 * t2) * env_ad(t2, 0.003, 5) * (tt > 0.09)
    return reverb(a * 0.5 + b * 0.6, 0.9, 0.25)


def buzz_ng(d=0.5):
    """不正解・NG（低いブー）"""
    tt = T(d)
    return lp(saw(np.full(len(tt), 110.0)) + saw(np.full(len(tt), 116.0)), 1500) * np.minimum(1, tt / 0.01) * np.minimum(1, (d - tt) / 0.05) * 0.5


# 名前 → (作る関数, 説明, 分類)
PRESETS = {
    "sub": (lambda: sub(), "低いドゥン（叩きつけ・どどーんの下支え）2.2秒", "打"),
    "sub_long": (lambda: sub(3.6, 55, 28), "もっと長く深いドゥン（曲の頭・最後の一打）3.6秒", "打"),
    "impact": (impact, "叩きつけの一打（低音の胴＋割れる高音＋短い残響）", "打"),
    "boom": (boom, "映画の大きな一打（地鳴り＋長い残響）。いちばんのここぞ", "打"),
    "hit_short": (hit_short, "短く締まった一打（連打・左右に振るテロップ）", "打"),
    "thud": (thud, "鈍いドスッ（倒れる・置く・扉）", "打"),
    "braam": (braam, "予告編のブォーン（重い宣告・正体）", "打"),
    "stinger": (stinger, "一打＋下がる不協和音（判定・正体が分かる）", "打"),
    "whoosh": (lambda: whoosh(), "シュッ（場面の切り替え）0.6秒", "風"),
    "whoosh_short": (lambda: whoosh(0.35, 0.2, 0.05, 0.45, seed=3, rate=14), "速く明るいシュッ（文字の入り）0.35秒", "風"),
    "whoosh_long": (lambda: whoosh(1.2, 0.8, 0.01, 0.18, seed=5, rate=6), "暗く長いヒュオォッ（怪奇・大きな移動）1.2秒", "風"),
    "swoosh_up": (swoosh_up, "上がっていくシュウッ（次の場面へ吸い込まれる）", "風"),
    "riser": (lambda: riser(), "ため（3.2秒で上がって最後で切れる）", "ため"),
    "riser_2s": (lambda: riser(2.0), "ため 2秒", "ため"),
    "riser_4s": (lambda: riser(4.0, 70, 2.6), "ため 4秒", "ため"),
    "riser_tonal": (riser_tonal, "音程だけで上がるため（上品・ロゴの前）", "ため"),
    "downlifter": (downlifter, "落ちていく（どどーんのあとの余韻・暗転）", "ため"),
    "revcym": (revcym, "逆再生シンバル（落ちの直前）1.4秒", "ため"),
    "rush": (rush, "迫るシュウウウ（長め。早めから鳴らす）2.3秒", "ため"),
    "swell": (swell, "やわらかい和音がふくらむ（感動・締めのコピーの前）", "ため"),
    "crash": (crash, "シンバルの一打（曲にシンバルがない山場）", "打"),
    "tick": (lambda: tick(), "時計のコチッ（項目を並べる・カウント）", "UI"),
    "tick_soft": (lambda: tick(0.1, 1600), "やわらかいコッ", "UI"),
    "key": (lambda: key(), "打鍵カタッ（自由入力・セリフ）", "UI"),
    "key_b": (lambda: key(0.05, 8, 1500), "打鍵（別の音色）", "UI"),
    "key_c": (lambda: key(0.06, 9, 2100), "打鍵（別の音色）", "UI"),
    "blip": (lambda: blip(), "ピッ（UI・選択）", "UI"),
    "blip_down": (lambda: blip(0.09, 1500, 900), "ピュッ（戻る・閉じる）", "UI"),
    "pop": (pop, "ぽんっ（出現・吹き出し）", "UI"),
    "click": (click, "カチッ（クリック）", "UI"),
    "notify": (notify, "通知のピロン", "UI"),
    "chime_ok": (chime_ok, "正解・OK（上がる2音）", "UI"),
    "buzz_ng": (buzz_ng, "不正解・NG（ブー）", "UI"),
    "shutter": (shutter, "カメラのシャッター", "UI"),
    "glitch": (glitch, "ザザッ（デジタルの切り替え）", "デジタル"),
    "static_burst": (static_burst, "砂嵐のザーッ（0.45秒）", "デジタル"),
    "zap": (zap, "ビリッ（電撃・バグ）", "デジタル"),
    "tvoff": (tvoff, "ブラウン管の電源オフ", "デジタル"),
    "tape_stop": (tape_stop, "テープが止まる（ずっこけ・時間停止）", "デジタル"),
    "sparkle": (sparkle, "きらん（決定・機能紹介）", "きらめき"),
    "shimmer_up": (shimmer_up, "きらきら上がる（変身・完成・錬成）", "きらめき"),
    "magic": (magic, "魔法の鈴（ふしぎ・発動）", "きらめき"),
    "bell": (bell, "鐘のゴーン（時・運命・始まり）", "きらめき"),
    "heartbeat": (heartbeat, "心音ドクン（緊張。くり返すときは等間隔に）", "空気"),
    "ring": (ring, "耳鳴り（目覚め・衝撃のあと）", "空気"),
    "hum": (hum, "低いうなり（目覚め・不穏）", "空気"),
    "roomtone": (roomtone, "部屋の静けさ（曲なしの間）", "空気"),
    "drone_dark": (drone_dark, "暗いドローン 6秒（不穏な導入）", "空気"),
    "tension": (tension, "高い弦のトレモロ（緊張・迫る）", "空気"),
    "page": (page, "紙をめくる（本・資料）", "空気"),
}

# 長さを変えられるもの（--dur）
SIZED = {"riser": riser, "riser_tonal": riser_tonal, "sub": sub, "whoosh": whoosh, "rush": rush, "downlifter": downlifter, "drone_dark": drone_dark, "roomtone": roomtone, "swell": swell, "tension": tension, "revcym": revcym}


def save(path, x, peak=0.89):
    x = stereo(x)
    x = fade_tail(x, 0.01)
    x = np.clip(x / (np.abs(x).max() + 1e-9) * peak, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
    rms = np.sqrt((x ** 2).mean() + 1e-12)
    return {"dur": round(len(x) / SR, 3), "rms_db": round(20 * np.log10(rms), 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--dur", type=float)
    ap.add_argument("--name")
    a = ap.parse_args()
    if a.list:
        for k, (_, note, cat) in PRESETS.items():
            print(f"{cat:6s} {k:14s} {note}")
        return
    os.makedirs(a.out, exist_ok=True)
    names = a.names or list(PRESETS)
    cat = {}
    for n in names:
        if n not in PRESETS:
            sys.exit(f"不明な名前: {n}（--list で一覧）")
        if a.dur and n in SIZED:
            x = SIZED[n](a.dur)
        else:
            x = PRESETS[n][0]()
        out_name = a.name if (a.name and len(names) == 1) else n
        info = save(os.path.join(a.out, out_name + ".wav"), x)
        cat[out_name] = {"note": PRESETS[n][1], "cat": PRESETS[n][2], **info}
        print(f"ok {out_name:14s} {info['dur']:5.2f}s  rms {info['rms_db']:6.1f}dB")
    if not a.names:
        with open(os.path.join(a.out, "se_catalog.json"), "w", encoding="utf-8") as f:
            json.dump(cat, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
