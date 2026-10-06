// JIZURA のエンジン部分（jizura/src/*.js）を1ファイルにまとめて Remotion から読めるようにする。
//   node build-engine.mjs   （npm run studio / render / check の前に自動で走る）
// ・JIZURA本家の build.py と同じく、ファイル名順に連結する
// ・12_ui.js（ブラウザ版の編集画面）は使わないので除外
// ・改造は jizura/src/ を直接編集する。生成物 src/jizura/engine.generated.js は手で触らない
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "jizura", "src");
const OUT = path.join(HERE, "src", "jizura", "engine.generated.js");
const SKIP = new Set(["12_ui.js"]);

const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".js") && !SKIP.has(f)).sort();
const body = files.map((f) => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(SRC, f), "utf8")).join("\n");
const out = `/* eslint-disable */
// @ts-nocheck
// 自動生成（build-engine.mjs）。編集は lyric-motion/jizura/src/ で。
// JIZURA — MIT License (c) 852wa  https://github.com/852wa/JIZURA
${body}
export default window.J;
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, out, "utf8");
console.log(`engine: ${files.length} files → ${path.relative(HERE, OUT)} (${(out.length / 1024).toFixed(0)} KB)`);
