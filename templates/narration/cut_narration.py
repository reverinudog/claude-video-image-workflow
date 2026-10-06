"""採用テイクを並べてナレーションのラフカットを作る。gap=直前のクリップとの間（秒）"""
import json, subprocess, os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.environ.get("NARRATION_SRC", os.path.join(HERE, "recording.wav"))   # 録音（1ファイル）。環境変数 NARRATION_SRC でも指定できる
OUT = os.path.join(HERE, "narration_cut.wav")
FF = os.environ.get("FFMPEG", "ffmpeg")
B, S = 0.6, 0.12  # ブロック間 / ブロック内のつなぎ
EDL = [  # (block, start, end, gap)  ← transcript.json を見て、使うテイクの開始・終了（元の録音の秒）を並べる
    ("B01", 0.75, 8.65, 0),
    ("B02", 10.25, 45.35, B),
    ("B03", 47.55, 71.05, B),
    ("B03", 80.10, 86.40, S),   # 同じブロックの中の言い直し（後のテイクを採用）
]
parts, labels, t = [], [], 0.0
for i, (blk, s, e, gap) in enumerate(EDL):
    if gap:
        parts.append(f"aevalsrc=0:d={gap}:s=44100[g{i}]")
        labels.append(f"[g{i}]")
        t += gap
    parts.append(f"[0:a]atrim={s}:{e},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={e-s-0.03}:d=0.03[a{i}]")
    labels.append(f"[a{i}]")
    print(f"{blk}  out {t:7.2f}  src {s:7.2f}-{e:7.2f}")
    t += e - s
fc = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(labels)}:v=0:a=1[out]"
subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-y", "-i", SRC, "-filter_complex", fc,
                "-map", "[out]", "-ac", "1", "-ar", "44100", OUT], check=True)
json.dump(EDL, open(OUT.replace(".wav", "_edl.json"), "w", encoding="utf-8"), ensure_ascii=False)
print(f"total {t:.2f}s")
