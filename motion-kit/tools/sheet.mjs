// 動きを1枚で確かめる：コンポジションの指定区間を何コマか書き出して、時刻つきで並べた1枚（コマ送りの一覧）にする。
//   node tools/sheet.mjs --id=GalleryEnter --from=0 --to=2.2 --n=8 [--cols=4] [--scale=0.35] [--entry=src/index.ts] [--out=out/sheet/x.png]
//   node tools/sheet.mjs --id=Main --t=1.2,1.3,1.5,2   （秒を直接並べる）
// 案件のフォルダ（video/）からも使える： node ../../motion-kit/tools/sheet.mjs --id=Main --from=10 --to=12
// 静止画は Remotion の renderStill、並べるのは ImageMagick（magick montage）。
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
// 見本ギャラリー用：--each=0.3,0.6,1.2 [--only=3-8] … 区切りごとの頭からの秒（行＝区切り）
const id = arg("id", "GalleryEnter");
const entry = path.resolve(arg("entry", "src/index.ts"));
const scale = Number(arg("scale", "0.35"));
const serveUrl = await bundle({ entryPoint: entry });
const composition = await selectComposition({ serveUrl, id });
let times = arg("t") ? arg("t").split(",").map(Number) : null;
let colsDefault = 4;
if (!times && arg("each")) {
  const offs = arg("each").split(",").map(Number);
  let idx = composition.props.index ?? [];
  if (arg("only")) { const [a, b] = arg("only").split("-").map(Number); idx = idx.slice(a, (b ?? a) + 1); }
  times = idx.flatMap((it) => offs.map((o) => +(it.start + o).toFixed(3)));
  colsDefault = offs.length * (offs.length <= 3 ? 2 : 1);
  console.log(idx.map((it, i) => `${i}: ${it.name} @${it.start}`).join("\n"));
}
if (!times) {
  const from = Number(arg("from", "0")), to = Number(arg("to", "2")), n = Number(arg("n", "8"));
  times = Array.from({ length: n }, (_, i) => +(from + ((to - from) * i) / Math.max(1, n - 1)).toFixed(3));
}
const cols = Number(arg("cols", String(Math.min(colsDefault, times.length))));
const out = path.resolve(arg("out", `out/sheet/${id}_${String(times[0]).replace(".", "_")}-${String(times[times.length - 1]).replace(".", "_")}.png`));
const tmp = path.resolve("out/sheet/.frames");
fs.mkdirSync(tmp, { recursive: true });
fs.mkdirSync(path.dirname(out), { recursive: true });
const files = [];
for (const [i, s] of times.entries()) {
  const f = path.join(tmp, `${i}.png`);
  await renderStill({ composition, serveUrl, output: f, frame: Math.min(composition.durationInFrames - 1, Math.round(s * composition.fps)), scale });
  files.push(f);
}
execFileSync("magick", ["montage", ...files.flatMap((f, i) => ["-label", `${times[i]}s`, f]), "-tile", `${cols}x`, "-geometry", "+6+6", "-background", "#222", "-fill", "#ddd", "-pointsize", "18", out]);
for (const f of files) fs.rmSync(f);
console.log(out);
