"""ナレーションを作り直したときに、timeline.ts の時間を新しいナレーションに合わせて付け替える。
使い方: python remap_timeline.py narration_map_旧.json narration_map.json ../video/src/timeline.ts"""
import json, re, sys, bisect

old = json.load(open(sys.argv[1], encoding="utf-8"))["map"]
new = json.load(open(sys.argv[2], encoding="utf-8"))
new_total, new = new["total"], new["map"]
path = sys.argv[3]

def src_to_new(src):
    best = None
    for c in new:
        if c["src"] <= src <= c["src"] + c["dur"]:
            return c["out"] + (src - c["src"])
        # 削られた無音の中 → 近い方の端へ
        d0, d1 = abs(src - c["src"]), abs(src - (c["src"] + c["dur"]))
        for d, v in ((d0, c["out"]), (d1, c["out"] + c["dur"])):
            if best is None or d < best[0]:
                best = (d, v)
    return best[1]

def old_to_new(t):
    for i, c in enumerate(old):
        if c["out"] <= t <= c["out"] + c["dur"]:
            return src_to_new(c["src"] + (t - c["out"]))
        if t < c["out"]:  # 直前のチャンクとの隙間
            if i == 0:
                return t
            a = old[i - 1]
            a_end_old = a["out"] + a["dur"]
            a_end_new = src_to_new(a["src"] + a["dur"])
            b_start_new = src_to_new(c["src"])
            r = (t - a_end_old) / max(1e-6, c["out"] - a_end_old)
            return a_end_new + r * (b_start_new - a_end_new)
    last = old[-1]
    return src_to_new(last["src"] + last["dur"]) + (t - (last["out"] + last["dur"]))

s = open(path, encoding="utf-8").read()
fmt = lambda x: f"{x:.2f}".rstrip("0").rstrip(".")
# t: [a, b]
s = re.sub(r"\bt: \[([\d.]+), ([\d.]+)\]", lambda m: f"t: [{fmt(old_to_new(float(m.group(1))))}, {fmt(old_to_new(float(m.group(2))))}]", s)
# at / to / outAt / cross / glow / deviceAt / sourceAt / hqAt
s = re.sub(r"\b(at|to|outAt|cross|glow|deviceAt|sourceAt|hqAt): ([\d.]+)", lambda m: f"{m.group(1)}: {fmt(old_to_new(float(m.group(2))))}", s)
s = re.sub(r"DURATION = ([\d.]+);", lambda m: f"DURATION = {fmt(new_total + 1.2)};", s)
open(path, "w", encoding="utf-8").write(s)
print("remapped. new total", new_total)
