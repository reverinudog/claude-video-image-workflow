"""cut_narration.py の EDL を読み、各区間内の無音を詰めて最終ナレーションを作る。
出力: narration_final.wav / narration_map.json（最終秒 ↔ 元秒の対応とブロック境界）"""
import json, re, wave, numpy as np

import os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get("NARRATION_SRC", os.path.join(HERE, "recording.wav"))
OUT = os.path.join(HERE, "narration_final.wav")
src_py = open(__file__.replace("tighten.py", "cut_narration.py"), encoding="utf-8").read()
EDL = eval(re.search(r"EDL = (\[.*?\n\])", src_py, re.S).group(1), {"B": 0, "S": 0})

GAP_BLOCK, GAP_IN = 0.5, 0.16   # ブロック間 / 区間間
MAX_SIL, KEEP_SIL = 0.34, 0.2   # 区間内でこれより長い無音は KEEP_SIL まで縮める
THR_DB, FR = -50.0, 0.01

w = wave.open(SRC); sr = w.getframerate()
a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
hop = int(sr * FR)
rms = np.sqrt(np.convolve(a ** 2, np.ones(hop) / hop, mode="same")[::hop] + 1e-12)
loud = 20 * np.log10(rms) > THR_DB

def speech_runs(s, e):
    """区間[s,e]を、長い無音を縮めた小区間のリストにする"""
    i0, i1 = int(s / FR), int(e / FR)
    runs, cur, sil = [], i0, 0
    for i in range(i0, i1):
        if loud[i]:
            if sil * FR > MAX_SIL:
                cut_from = i - sil + int(KEEP_SIL / 2 / FR)
                cut_to = i - int(KEEP_SIL / 2 / FR)
                runs.append((cur * FR, cut_from * FR))
                cur = cut_to
            sil = 0
        else:
            sil += 1
    runs.append((cur * FR, e))
    return [(max(x, s), min(y, e)) for x, y in runs if y - x > 0.03]

out, mapping, t, prev_blk = [], [], 0.0, None
fade = int(sr * 0.02)
def db_at(t):
    seg = a[int(t * sr):int((t + 0.03) * sr)]
    return 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9)

def extend(s, e):
    """区間の端で声が続いていたら、声が消えるまで（最大0.3秒）広げる＝語尾・語頭の切れ防止"""
    t = e
    while t < e + 0.3 and db_at(t - 0.03) > -52: t += 0.03
    e2 = t + 0.04 if t > e else e
    t = s
    while t > s - 0.3 and db_at(t) > -52: t -= 0.03
    s2 = t if t < s else s
    return s2, e2

for blk, s, e, _ in EDL:
    s, e = extend(s, e)
    # 区間の頭と尻の無音も落とす
    i0, i1 = int(s / FR), int(e / FR)
    idx = np.where(loud[i0:i1])[0]
    if len(idx) == 0: continue
    s2, e2 = max(s, (i0 + idx[0]) * FR - 0.1), min(e, (i0 + idx[-1]) * FR + 0.18)
    gap = GAP_BLOCK if blk != prev_blk else GAP_IN
    if out:
        out.append(np.zeros(int(sr * gap), np.float32)); t += gap
    for x, y in speech_runs(s2, e2):
        seg = a[int(x * sr):int(y * sr)].copy()
        seg[:fade] *= np.linspace(0, 1, fade); seg[-fade:] *= np.linspace(1, 0, fade)
        mapping.append({"block": blk, "out": round(t, 3), "src": round(x, 3), "dur": round(y - x, 3)})
        out.append(seg); t += y - x
    prev_blk = blk

y = np.concatenate(out)
y = y / max(1e-6, np.abs(y).max()) * 0.89  # ピーク -1dB
wo = wave.open(OUT, "wb"); wo.setnchannels(1); wo.setsampwidth(2); wo.setframerate(sr)
wo.writeframes((y * 32767).astype(np.int16).tobytes()); wo.close()
json.dump({"total": round(t, 3), "map": mapping}, open(OUT.replace(".wav", "_map.json").replace("final", "map").replace("narration_map_map", "narration_map"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
blocks = {}
for m in mapping: blocks.setdefault(m["block"], m["out"])
print("total", round(t, 2)); print(blocks)
