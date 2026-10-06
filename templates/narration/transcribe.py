"""録音を文字起こしする（faster-whisper large-v3、単語ごとの時刻つき）。
使い方: python transcribe.py <録音.wav> [出力 transcript.json] [--prompt "製品名、人名など聞き取ってほしい言葉"]
  必要なもの: pip install faster-whisper（GPU を使うなら CUDA 版の cuBLAS・cuDNN も）
  GPU が無ければ環境変数 WHISPER_DEVICE=cpu（遅い）"""
import sys, json, os

# Windows で pip の nvidia-* から DLL を読むとき用（入れていなければ何もしない）
try:
    import nvidia
    for d in ["cublas", "cudnn", "cuda_nvrtc"]:
        p = os.path.join(os.path.dirname(nvidia.__path__[0] if hasattr(nvidia, "__path__") else nvidia.__file__), "nvidia", d, "bin")
        if os.path.isdir(p):
            os.add_dll_directory(p)
            os.environ["PATH"] = p + os.pathsep + os.environ["PATH"]
except Exception:
    pass
from faster_whisper import WhisperModel

args = [a for a in sys.argv[1:] if not a.startswith("--")]
if not args:
    sys.exit(__doc__)
src = args[0]
out = args[1] if len(args) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "transcript.json")
prompt = sys.argv[sys.argv.index("--prompt") + 1] if "--prompt" in sys.argv else None
device = os.environ.get("WHISPER_DEVICE", "cuda")
m = WhisperModel("large-v3", device=device, compute_type="float16" if device == "cuda" else "int8")
segs, info = m.transcribe(src, language="ja", word_timestamps=True, vad_filter=False, initial_prompt=prompt)
res = []
for s in segs:
    res.append({"start": s.start, "end": s.end, "text": s.text,
                "words": [[w.start, w.end, w.word] for w in (s.words or [])]})
    print(f"[{s.start:7.2f}-{s.end:7.2f}] {s.text}", flush=True)
json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
