"""
手持ちの効果音・曲の棚卸し：各案件の public/se・public/bgm と、解説動画の素材フォルダを調べて、
同じ中身のファイルをまとめ（ハッシュ）、長さ・ピーク・平均の大きさ・どの案件で使ったかを一覧にする。
  python motion-kit/audio/se_catalog.py            → motion-kit/SOUND_LIBRARY.md と motion-kit/public/lib/（試聴用のコピー。Git管理外）
効果音ラボの素材は「効果音を紹介する動画」「素材集・テンプレートへの組み込み」が再配布扱いで禁止 → コピーは手元の試聴・制作用。外に出さない
"""
import glob, hashlib, json, os, re, shutil, sys
import numpy as np, librosa

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LIB = os.path.join(ROOT, "motion-kit", "public", "lib")
def proj_of(p):
    # <ROOT>/<案件>/video/public/se/<file> → 案件
    return os.path.basename(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(p)))))


SRC = [(p, proj_of(p)) for p in glob.glob(os.path.join(ROOT, "26*", "video", "public", "se", "*.*"))]
BGM = [(p, proj_of(p)) for p in glob.glob(os.path.join(ROOT, "26*", "video", "public", "bgm", "*.*"))]
MATERIAL = os.environ.get("SE_MATERIAL_DIR", "")  # 手持ちの効果音を置いているフォルダ（あれば）
if MATERIAL:
    SRC += [(p, "素材") for p in glob.glob(os.path.join(MATERIAL, "*.mp3"))]

# 案件の README に書いてある出どころ（ファイル名 → 出どころ）
ORIGIN = {
    # "ファイル名.mp3": "出どころ（配布元・購入元・ライセンス）",
    # ("案件フォルダ名", "main.mp3"): "出どころ",
}
LAB_NAMES = re.compile(r"^[a-z\-]+[0-9]+\.mp3$")  # 効果音ラボの元の名前（jajean1.mp3 など、末尾に番号）


def h(p):
    with open(p, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()[:10]


def measure(p):
    y, sr = librosa.load(p, sr=22050, mono=True)
    dur = len(y) / sr
    peak = 20 * np.log10(np.abs(y).max() + 1e-9)
    rms = 20 * np.log10(np.sqrt((y ** 2).mean()) + 1e-9)
    # 立ち上がり：最大の 50% に達するまでの秒
    env = np.abs(y)
    att = float(np.argmax(env > env.max() * 0.5) / sr)
    lowr = 0.0
    if dur > 0.05:
        S = np.abs(librosa.stft(y, n_fft=1024))
        f = librosa.fft_frequencies(sr=sr, n_fft=1024)
        lowr = float(S[f < 200].sum() / (S.sum() + 1e-9))
    return dict(dur=round(float(dur), 2), peak=round(float(peak), 1), rms=round(float(rms), 1), attack=round(att, 3), low=round(lowr, 2))


def scan(items, kind):
    groups = {}
    for p, proj in items:
        if not p.lower().endswith((".mp3", ".wav")):
            continue
        k = h(p)
        g = groups.setdefault(k, {"files": [], "projects": set(), "kind": kind})
        g["files"].append(os.path.relpath(p, ROOT) if p.startswith(ROOT) else p)
        g["projects"].add(proj)
    out = []
    for k, g in groups.items():
        first = g["files"][0]
        path = first if os.path.isabs(first) else os.path.join(ROOT, first)
        m = measure(path)
        names = sorted({os.path.basename(f) for f in g["files"]})
        known = [ORIGIN.get((p, n)) for p in g["projects"] for n in names] + [ORIGIN.get(n) for n in names if not (kind == "bgm" and n == "main.mp3")]
        known = [k for k in known if k]
        if known:
            origin = known[0]
        elif any("audiostock" in n for n in names):
            origin = "audiostock"
        elif any(n.endswith(".wav") for n in names):
            origin = "Python で合成（案件の work/synth_se.py）"
        elif any(LAB_NAMES.match(n) for n in names):
            origin = "効果音ラボ（元の名前のまま）"
        elif m["dur"] > 20:
            origin = "不明"
        else:
            origin = "効果音ラボと推定（名前を付け替えてある）"
        out.append(dict(hash=k, names=names, files=g["files"], projects=sorted(g["projects"]), origin=origin, **m))
    return out


def main():
    se = scan(SRC, "se")
    bgm = scan(BGM, "bgm")
    # 20秒を超えるものは曲・環境音として「曲」の表へ（素材フォルダの解説BGMなど）
    bgm += [e for e in se if e["dur"] > 20]
    se = [e for e in se if e["dur"] <= 20]
    os.makedirs(os.path.join(LIB, "se"), exist_ok=True)
    os.makedirs(os.path.join(LIB, "bgm"), exist_ok=True)
    for e in se + bgm:
        src = e["files"][0] if os.path.isabs(e["files"][0]) else os.path.join(ROOT, e["files"][0])
        name = os.path.splitext(e["names"][0])[0]
        ext = os.path.splitext(src)[1]
        # 同じ名前で中身が違うもの（案件ごとの glitch.wav など）は案件名の頭を付けて分ける
        same = [x for x in (se + bgm) if x["names"][0] == e["names"][0]]
        if len(same) > 1:
            name = f"{name}_{e['projects'][0][:6]}"
        dst = os.path.join(LIB, "se" if e in se else "bgm", f"{name}{ext}")
        if not os.path.exists(dst):
            shutil.copy2(src, dst)
        e["lib"] = os.path.relpath(dst, os.path.join(ROOT, "motion-kit", "public")).replace("\\", "/")
    with open(os.path.join(LIB, "library.json"), "w", encoding="utf-8") as f:
        json.dump({"se": se, "bgm": bgm}, f, ensure_ascii=False, indent=1)
    lines = ["# 手持ちの音の一覧（自動生成：`python motion-kit/audio/se_catalog.py`）", "",
             "各案件の `video/public/se`・`bgm` （と、環境変数 SE_MATERIAL_DIR のフォルダ）を調べて、同じ中身のファイルを1行にまとめたもの。",
             "試聴用のコピーは `motion-kit/public/lib/`（Git管理外）。合成した効果音は別に `motion-kit/public/se/`（`audio/synth_se.py --list`）。",
             "効果音ラボの素材は手元の制作用。「効果音を流して紹介する動画」「素材集・テンプレートに組み込んで配る」は規約で再配布扱い（docs/research/sound-sources.md）。", "",
             "- 長さ・ピーク・平均（RMS）は dBFS。low＝200Hz未満の割合（大きいほど低音の音）。attack＝最大の半分に達するまでの秒（小さいほど鋭い）", "",
             "## 効果音", "", "| 名前（別名） | 長さ | ピーク | 平均 | low | attack | 使った案件 | 出どころ |", "|---|---|---|---|---|---|---|---|"]
    for e in sorted(se, key=lambda x: x["names"][0]):
        lines.append(f"| {' / '.join(e['names'])} | {e['dur']}s | {e['peak']} | {e['rms']} | {e['low']} | {e['attack']} | {', '.join(e['projects'])} | {e['origin']} |")
    lines += ["", "## 曲・長い環境音（20秒より長いもの）", "", "| 名前 | 長さ | ピーク | 平均 | 使った案件 | 出どころ |", "|---|---|---|---|---|---|"]
    for e in sorted(bgm, key=lambda x: x["names"][0]):
        lines.append(f"| {' / '.join(e['names'])} | {e['dur']}s | {e['peak']} | {e['rms']} | {', '.join(e['projects'])} | {e['origin']} |")
    with open(os.path.join(ROOT, "motion-kit", "SOUND_LIBRARY.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print(len(se), "se /", len(bgm), "bgm")


if __name__ == "__main__":
    main()
