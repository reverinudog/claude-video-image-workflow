// 確認用：指定した秒数の静止画をまとめて書き出す  node check.mjs 1.5 3 6 ...  （コンポジション名を変えるなら --id=LyricLayer）
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const args = process.argv.slice(2);
const id = (args.find((a) => a.startsWith("--id=")) || "--id=LyricMV").slice(5);
const secs = args.filter((a) => !a.startsWith("--")).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id });
console.log(`${id}: ${composition.width}x${composition.height} ${composition.fps}fps ${(composition.durationInFrames / composition.fps).toFixed(1)}秒`);
for (const s of secs) {
  const out = path.resolve(`out/check/${id}_${String(s).replace(".", "_")}.png`);
  await renderStill({ composition, serveUrl, output: out, frame: Math.min(composition.durationInFrames - 1, Math.round(s * composition.fps)), scale: 0.5 });
  console.log("ok", s);
}
