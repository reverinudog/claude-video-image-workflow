// motion-kit の部品を案件にコピーする（案件ごとに版を固定する。共通の kit を直しても過去の案件は変わらない）
//   node motion-kit/tools/install.mjs <案件>/video                  … src/kit/ を丸ごとコピー（上書き前に src/kit.bak-<日時>/ へ退避）
//   node motion-kit/tools/install.mjs <案件>/video --se impact,sub,riser_4s   … 合成SE（motion-kit/public/se）も public/se へ
// 使う側：import { Kinetic, Shots, Flash, ... } from "./kit";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const kitDir = path.resolve(here, "../src/kit");
const target = process.argv[2];
if (!target) { console.log("使い方: node motion-kit/tools/install.mjs <案件>/video [--se a,b,c]"); process.exit(1); }
const dst = path.resolve(target, "src/kit");
if (!fs.existsSync(path.resolve(target, "src"))) { console.error(`src/ がない: ${target}`); process.exit(1); }
if (fs.existsSync(dst)) {
  const bak = `${dst}.bak-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
  fs.renameSync(dst, bak);
  console.log("退避:", bak);
}
// fs.cpSync は日本語を含むパスで node ごと落ちた（Node 24・Windows、2026-10-04）→ 自前で1つずつコピー
const copyDir = (a, b) => {
  fs.mkdirSync(b, { recursive: true });
  for (const e of fs.readdirSync(a, { withFileTypes: true })) {
    if (e.isDirectory()) copyDir(path.join(a, e.name), path.join(b, e.name));
    else fs.copyFileSync(path.join(a, e.name), path.join(b, e.name));
  }
};
copyDir(kitDir, dst);
let rev = "unknown";
try { rev = execSync("git rev-parse --short HEAD", { cwd: here }).toString().trim(); } catch {}
fs.writeFileSync(path.join(dst, "KIT_VERSION.txt"), `motion-kit ${rev}（${new Date().toISOString().slice(0, 10)} にコピー）\n直すときはこの案件の中で直してよい。共通に戻したい改良は motion-kit/src/kit にも入れて見本で確かめる\n`);
console.log("コピー:", dst);

const seArg = process.argv.find((a) => a === "--se");
if (seArg) {
  const names = (process.argv[process.argv.indexOf("--se") + 1] || "").split(",").filter(Boolean);
  const seDst = path.resolve(target, "public/se");
  fs.mkdirSync(seDst, { recursive: true });
  for (const n of names) {
    const f = path.resolve(here, "../public/se", `${n}.wav`);
    if (!fs.existsSync(f)) { console.error(`ない: ${n}.wav（python motion-kit/audio/synth_se.py で作る）`); continue; }
    fs.copyFileSync(f, path.join(seDst, `${n}.wav`));
    console.log("SE:", n);
  }
}
