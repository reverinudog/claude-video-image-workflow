# 音量の均一化：テロップ1つ＝1区間として区間ごとのラウドネス(LUFS)を測り、中央値にそろえる。
# 使い方: python work/level.py   （入力 work/narration_prelevel.wav → 出力 video/public/narration.wav）
# ナレーションを作り直したら、loudnorm済みの音声を narration_prelevel.wav に置いてから実行する
import re, subprocess, wave, numpy as np, os
HERE = os.path.dirname(os.path.abspath(__file__))
FF = os.environ.get("FFMPEG", "ffmpeg")
SRC = os.path.join(HERE, "narration_prelevel.wav")
TL = os.path.join(HERE, "..", "video", "src", "timeline.ts")
OUT = os.path.join(HERE, "..", "video", "public", "narration.wav")
AMOUNT, CLAMP, RAMP = 0.85, 4.0, 0.06  # ずれの85%を補正・最大±4dB・切り替え60ms

def lufs(s, e):
    o = subprocess.run([FF, "-hide_banner", "-ss", str(s), "-t", str(max(e - s, 0.5)), "-i", SRC, "-af", "ebur128", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf8", errors="ignore").stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", o)[-1])

caps = [(float(s), float(e)) for s, e in re.findall(r'\{ t: \[([\d.]+), ([\d.]+)\], text: "', open(TL, encoding="utf8").read())]
caps.sort()
vals = [lufs(s, e) for s, e in caps]
med = float(np.median(vals))
w = wave.open(SRC); sr = w.getframerate(); p = w.getparams()
a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64)
g = np.zeros(len(a))  # dB
for (s, e), v in zip(caps, vals):
    g[int(s * sr):int(e * sr)] = float(np.clip((med - v) * AMOUNT, -CLAMP, CLAMP))
# 区間の外（無音）は直前の値を引き継ぎ、境界はなめらかに
k = int(RAMP * sr); ker = np.ones(k) / k
g = np.convolve(g, ker, mode="same")
out = np.clip(a * 10 ** (g / 20), -32768, 32767).astype(np.int16)
tmp = OUT + ".tmp.wav"
with wave.open(tmp, "wb") as o: o.setparams(p); o.writeframes(out.tobytes())
subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error", "-i", tmp, "-af", "loudnorm=I=-16:TP=-1.5", "-ar", str(sr), OUT], check=True)
os.remove(tmp)
print(f"median {med:.1f} LUFS, {len(caps)} 区間を補正")
