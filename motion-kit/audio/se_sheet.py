"""
効果音の「見える化」：フォルダの wav/mp3 を1つずつ、波形（上）とスペクトログラム（下）にして1枚に並べる。
聞けない場面でも、立ち上がり・長さ・帯域（低音か高音か）・音割れを目で確かめられる。
  python motion-kit/audio/se_sheet.py motion-kit/public/se out.png
（librosa・numpy・Pillow を使う）
"""
import os, sys
import numpy as np, librosa
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
files = sorted(f for f in os.listdir(src) if f.lower().endswith((".wav", ".mp3")))
CW, CH, COLS = 360, 190, 5
rows = (len(files) + COLS - 1) // COLS
sheet = Image.new("RGB", (CW * COLS, CH * rows), (20, 20, 24))
try:
    font = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 15)
except Exception:
    font = ImageFont.load_default()
for i, f in enumerate(files):
    y, sr = librosa.load(os.path.join(src, f), sr=22050, mono=True)
    dur = len(y) / sr
    x0, y0 = (i % COLS) * CW, (i // COLS) * CH
    d = ImageDraw.Draw(sheet)
    # 波形（幅 CW-10、高さ 50）。横軸は最大4秒に固定して長さを比べやすく
    span = max(4.0, dur)
    W = int((CW - 10) * dur / span)
    if W > 1:
        seg = np.array_split(np.abs(y), W)
        pk = np.array([s.max() if len(s) else 0 for s in seg])
        for k, v in enumerate(pk):
            h = int(v * 24)
            d.line([(x0 + 5 + k, y0 + 50 - h), (x0 + 5 + k, y0 + 50 + h)], fill=(230, 180, 90) if v < 0.99 else (255, 60, 60))
    # スペクトログラム（メル、高さ 100）
    S = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=sr, n_mels=64, hop_length=256), ref=np.max)
    S = np.clip((S + 70) / 70, 0, 1)
    img = Image.fromarray((S[::-1] * 255).astype(np.uint8)).resize((max(2, W), 100))
    img = img.convert("RGB")
    sheet.paste(img, (x0 + 5, y0 + 80))
    d.text((x0 + 6, y0 + 2), f"{os.path.splitext(f)[0]}  {dur:.2f}s  peak {20*np.log10(np.abs(y).max()+1e-9):.1f}dB", fill=(235, 235, 235), font=font)
sheet.save(out)
print(out, len(files))
