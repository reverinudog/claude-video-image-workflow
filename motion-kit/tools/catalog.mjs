// 見た目のカタログ（HTML）を作る：見本（GalleryAll）を名札なし・半分の大きさで書き出し、部品ごとの短い動画と静止画に切って、
// catalog/data.json（一覧のデータ）を書く。ページはレビューツールの /catalog（review-tool/public/catalog.html・catalog.js）
//   node tools/catalog.mjs            … 書き出しから全部（約10分）
//   node tools/catalog.mjs --reuse    … 書き出し済みの catalog/.full.mp4 を使って切り直すだけ
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dir = path.join(root, "catalog");
const clips = path.join(dir, "clips");
const full = path.join(dir, ".full.mp4");
fs.mkdirSync(clips, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts") });
const inputProps = { noLabel: true };
const composition = await selectComposition({ serveUrl, id: "GalleryAll", inputProps });
const index = composition.props.index;
if (!process.argv.includes("--reuse") || !fs.existsSync(full)) {
  console.log(`書き出し：${index.length}件 ${(composition.durationInFrames / composition.fps).toFixed(0)}秒`);
  let last = -1;
  await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: full, inputProps, scale: 0.5, concurrency: 3, muted: true,
    offthreadVideoCacheSizeInBytes: 1_500_000_000, timeoutInMilliseconds: 240_000,
    onProgress: ({ progress }) => { const p = Math.floor(progress * 20); if (p !== last) { last = p; process.stdout.write(`${p * 5}% `); } } });
  console.log();
}

const items = index.map((it, i) => {
  const id = String(i + 1).padStart(3, "0");
  // 動画：区切りの頭から終わりまで（音なし・小さく）。静止画：効果が見えている頃（長さの55%）
  const cut = ["-y", "-loglevel", "error", "-ss", String(it.start), "-t", String(it.len - 0.04), "-i", full, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
  // 大きく見る用（960x540）と、一覧で全部を同時にループさせる用の軽い版（384x216・24fps・_s）
  execFileSync("ffmpeg", [...cut, "-crf", "27", "-preset", "veryfast", path.join(clips, `${id}.mp4`)]);
  execFileSync("ffmpeg", [...cut, "-vf", "scale=384:-2,fps=24", "-crf", "30", "-preset", "veryfast", "-tune", "fastdecode", "-profile:v", "baseline", path.join(clips, `${id}_s.mp4`)]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(it.start + it.len * 0.55), "-i", full, "-frames:v", "1", "-vf", "scale=480:-1", "-q:v", "4", path.join(clips, `${id}.jpg`)]);
  process.stdout.write(".");
  return { id, group: it.group, name: it.name, note: it.note, len: it.len };
});
console.log();

const se = Object.entries(JSON.parse(fs.readFileSync(path.join(root, "public/se/se_catalog.json"), "utf8"))).map(([name, e]) => ({ name, ...e }));
const data = { made: new Date().toISOString().slice(0, 16).replace("T", " "), items, se };
fs.writeFileSync(path.join(dir, "data.json"), JSON.stringify(data, null, 1));
console.log(`catalog/data.json：映像 ${items.length}件・効果音 ${se.length}件（レビューツールの /catalog で見る）`);
