"""
曲の地図：拍の格子・小節ごとの大きさ（低音・高音・全体）・頭の一打・和音の似かたから、
「曲の頭の一打」「ため（低音が抜ける）→落ち」「区切り（展開が変わる所）」「飛ばせる小節（同じ形のくり返し）」「最後の一打」を一覧にする。
トレーラーでは曲の切りどころを先に見つけてから構成を合わせる（docs/lessons/trailer.md）。
  python motion-kit/audio/song_map.py <曲.mp3> [--bpm 150] [--beats 4] [--json out.json] [--png out.png]
ある案件の bars.py（小節ごとの低音・高音・一打）と、尺を縮めるときの和音の似かた（chroma のコサイン類似度 0.95 以上）をまとめたもの。
"""
import argparse, json
import numpy as np, librosa

ap = argparse.ArgumentParser()
ap.add_argument("song")
ap.add_argument("--bpm", type=float, help="だいたいの BPM（省くと推定）")
ap.add_argument("--beats", type=int, default=4, help="1小節の拍数")
ap.add_argument("--json")
ap.add_argument("--png")
a = ap.parse_args()

y, sr = librosa.load(a.song, sr=22050, mono=True)
dur = len(y) / sr
hop = 256
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
ot = librosa.times_like(oenv, sr=sr, hop_length=hop)

# BPM と位相：onset の強さの合計が最大になる格子（推定値の ±6% を 0.05 刻み）
guess = a.bpm or float(np.atleast_1d(librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop)[0])[0])
best = None
for bpm in np.arange(guess * 0.94, guess * 1.06, 0.05):
    T = 60 / bpm
    for ph in np.arange(0, T, 0.005):
        idx = np.searchsorted(ot, np.arange(ph, dur, T))
        idx = idx[idx < len(oenv)]
        s = oenv[idx].mean()
        if best is None or s > best[0]:
            best = (s, bpm, ph)
_, bpm, ph = best
T = 60 / bpm
bar = a.beats * T
nb = int((dur - ph) / bar) + 1

S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
f = librosa.fft_frequencies(sr=sr, n_fft=2048)
st = librosa.times_like(S, sr=sr, hop_length=512)
low, high, tot = S[f < 150].sum(0), S[f > 4000].sum(0), S.sum(0)
chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)
ct = librosa.times_like(chroma, sr=sr, hop_length=512)
rl, rh, rt = np.percentile(low, 99), np.percentile(high, 99), np.percentile(tot, 99)
heads_all = []
rows = []
for b in range(nb):
    t0 = ph + b * bar
    m = (st >= t0) & (st < t0 + bar)
    if not m.any():
        continue
    i0 = np.argmin(abs(ot - t0))
    head = float(oenv[max(0, i0 - 2):i0 + 3].max())
    cm = (ct >= t0) & (ct < t0 + bar)
    cv = chroma[:, cm].mean(1) if cm.any() else np.zeros(12)
    rows.append(dict(bar=b, t=round(t0, 3),
                     low=round(float(20 * np.log10(low[m].mean() / rl + 1e-9)), 1),
                     high=round(float(20 * np.log10(high[m].mean() / rh + 1e-9)), 1),
                     all=round(float(20 * np.log10(tot[m].mean() / rt + 1e-9)), 1),
                     head=round(head, 2), chroma=cv))
heads = np.array([r["head"] for r in rows])
hmax = heads.max() if len(heads) else 1


def cos(u, v):
    return float(u @ v / (np.linalg.norm(u) * np.linalg.norm(v) + 1e-9))


# 区切り：前の2小節と比べて和音の似かたが下がる／大きさが跳ぶ
for i, r in enumerate(rows):
    marks = []
    if i >= 2:
        prev = (rows[i - 1]["chroma"] + rows[i - 2]["chroma"]) / 2
        sim = cos(r["chroma"], prev)
        de = r["all"] - (rows[i - 1]["all"] + rows[i - 2]["all"]) / 2
        dl = r["low"] - (rows[i - 1]["low"] + rows[i - 2]["low"]) / 2
        if sim < 0.85 or abs(de) > 4:
            marks.append("区切り")
        if dl < -6:
            marks.append("ため（低音が抜ける）")
        dh = r["high"] - (rows[i - 1]["high"] + rows[i - 2]["high"]) / 2
        if dh < -8:
            marks.append("引き（高音が抜ける）")
        if i >= 1 and rows[i - 1]["low"] - rows[max(0, i - 2)]["low"] < -6 and dl > 6:
            marks.append("落ち")
    if r["head"] > hmax * 0.8:
        marks.append("強い一打")
    r["marks"] = marks

# 最後の一打：音が消える（-40dB を下回ったまま戻らない）より前の、最後の15秒にある小節の頭の一打のうち一番あと。
# 曲の最後の和音は「静かに始まってふくらむ」ことがある（-17dB から1小節かけてふくらむ曲があった）ので、強さの基準は低め（最大の15%）
rms = librosa.feature.rms(y=y, hop_length=512)[0]
rt_ = librosa.times_like(rms, sr=sr, hop_length=512)
alive = np.where(20 * np.log10(rms / rms.max() + 1e-9) > -40)[0]
end_t = float(rt_[alive[-1]]) if len(alive) else dur
tail = [r for r in rows if end_t - 15 <= r["t"] < end_t - 0.5 and r["head"] > hmax * 0.15]
last = max(tail, key=lambda r: r["t"]) if tail else max((r for r in rows if r["head"] > hmax * 0.5), key=lambda r: r["bar"], default=None)
# 飛ばせる小節：4小節のかたまりで和音がほぼ同じ（0.95以上）組
skips = []
for i in range(len(rows) - 4):
    for j in range(i + 4, len(rows) - 3):
        if (j - i) % 4:
            continue
        s = np.mean([cos(rows[i + k]["chroma"], rows[j + k]["chroma"]) for k in range(4)])
        de = np.mean([abs(rows[i + k]["all"] - rows[j + k]["all"]) + abs(rows[i + k]["low"] - rows[j + k]["low"]) for k in range(4)])
        if s >= 0.95 and de < 3:
            skips.append((rows[i]["bar"], rows[j]["bar"], round(s, 3)))
first = next((r for r in rows if r["head"] > hmax * 0.5), rows[0])

print(f"曲 {a.song}")
print(f"長さ {dur:.2f}s  BPM {bpm:.2f}  1拍 {T:.4f}s  1小節 {bar:.3f}s  拍の位相 {ph:.3f}s（＝最初の拍の秒。theme の vb(0) に）")
print(f"曲の頭の一打（候補）：{first['bar']}小節（{first['t']}s）　最後の一打（候補）：{last['bar']}小節（{last['t']}s）、音が消えるのは {end_t:.1f}s（-40dB）" if last else "")
print("※ 候補は数字からの推定。使う前に前後を聞く／volumedetect で確かめる（最後の一打が静かな和音なら、着地の一打と重ねて引き継ぐ。docs/lessons/trailer.md）")
print()
print(" 小節   秒      low   high    all   一打  しるし")
for r in rows:
    print(f" {r['bar']:4d} {r['t']:7.2f}s {r['low']:6.1f} {r['high']:6.1f} {r['all']:6.1f} {r['head']:5.1f}  {' '.join(r['marks'])}")
if skips:
    near = [s for s in skips if s[1] - s[0] <= 16]
    print(f"\n同じ形の4小節で、近く（16小節以内）にくり返すもの {len(near)}組（i の頭 → j の頭へ飛べば i〜j-1 を飛ばせる。全 {len(skips)}組は --json に）")
    for i, j, s in near[:40]:
        print(f"  {i:3d} ≈ {j:3d}  （和音の似かた {s}）")

if a.json:
    out = dict(song=a.song, dur=dur, bpm=bpm, beat=T, phase=ph, beatsPerBar=a.beats, first=first["bar"], last=last["bar"] if last else None,
               bars=[{k: v for k, v in r.items() if k != "chroma"} for r in rows], skips=skips)
    with open(a.json, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

if a.png:
    from PIL import Image, ImageDraw, ImageFont
    n = len(rows)
    cw = max(8, min(24, 1800 // max(1, n)))
    W, H = cw * n + 80, 360
    im = Image.new("RGB", (W, H), (18, 18, 22))
    d = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 12)
    except Exception:
        font = ImageFont.load_default()
    base = 300
    for i, r in enumerate(rows):
        x = 60 + i * cw
        hh = int(max(0, 40 + r["all"]) * 5)
        d.rectangle([x, base - hh, x + cw - 2, base], fill=(90, 110, 150))
        ll = int(max(0, 40 + r["low"]) * 5)
        d.rectangle([x, base - ll, x + cw // 2 - 1, base], fill=(200, 140, 70))
        hd = int(r["head"] / hmax * 40)
        d.rectangle([x, 20, x + cw - 2, 20 + hd], fill=(230, 230, 230))
        if "区切り" in r["marks"]:
            d.line([x, 70, x, base], fill=(120, 220, 120))
        if any(m.startswith("ため") for m in r["marks"]):
            d.text((x, 62), "た", fill=(255, 200, 80), font=font)
        if r["bar"] % 4 == 0:
            d.text((x, base + 6), str(r["bar"]), fill=(200, 200, 200), font=font)
    d.text((6, 6), f"BPM {bpm:.2f}  白=頭の一打  青=全体  橙=低音  緑線=区切り  た=ため", fill=(220, 220, 220), font=font)
    im.save(a.png)
    print("png", a.png)
