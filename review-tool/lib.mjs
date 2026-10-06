// server.mjs / listen.mjs / claude.mjs で共有する処理
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const VERSION = "2.2.0";

/* ---------- 設定 ----------
 * 優先順：起動引数（server.mjs だけ）→ 環境変数 → review-tool/config.json → 既定値
 *   root   : 動画と構成メモを探す作業フォルダ（既定：review-tool の1つ上）
 *   inbox  : Claude への依頼を置くフォルダ（既定：review-tool/inbox）
 *   port / host : 待ち受け（既定：5178 / 127.0.0.1。外から見せるときは Tailscale serve などで中継する）
 *   videoFolders: この名前のフォルダにある動画だけ一覧に出す（既定 ["out"]。[] ならどこでも） */
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } };
const fileCfg = readJson(path.join(HERE, "config.json")) ?? {};
const flags = {};
if (path.basename(process.argv[1] ?? "") === "server.mjs") {
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    const m = a[i].match(/^--(root|inbox|port|host)(?:=(.*))?$/);
    if (m) flags[m[1]] = m[2] ?? a[++i];
    else if (/^\d+$/.test(a[i])) flags.port = a[i]; // 旧形式：node server.mjs 5178
  }
}
const pick = (k, env, def) => flags[k] ?? process.env[env] ?? fileCfg[k] ?? def;
export const ROOT = path.resolve(HERE, pick("root", "REVIEW_ROOT", ".."));
export const INBOX = path.resolve(HERE, pick("inbox", "REVIEW_INBOX", "inbox")); // Claudeへの依頼（1依頼＝1 json）
export const PORT = Number(pick("port", "REVIEW_PORT", 5178));
export const HOST = String(pick("host", "REVIEW_HOST", "127.0.0.1"));
export const VIDEO_FOLDERS = Array.isArray(fileCfg.videoFolders) ? fileCfg.videoFolders : ["out"];
export const ALIVE = path.join(INBOX, ".alive"); // Claudeが待機中なら数秒おきに更新される
fs.mkdirSync(INBOX, { recursive: true });

/* ---------- 作業フォルダごとの設定（画面の設定から変えられる）：<root>/.reviewtool.json ---------- */
export const DEFAULT_TAGS = [
  { name: "音声", color: "#4fc3f7" }, { name: "テロップ", color: "#ffd23f" }, { name: "映像", color: "#ff8a3d" },
  { name: "図解", color: "#9b8cff" }, { name: "立ち絵", color: "#ff6fae" }, { name: "SE・BGM", color: "#34c77b" }, { name: "その他", color: "#9aa3b8" },
];
const settingsFile = () => path.join(ROOT, ".reviewtool.json");
export const readSettings = () => {
  const s = readJson(settingsFile()) ?? {};
  return { workspaceName: typeof s.workspaceName === "string" ? s.workspaceName : "", tags: Array.isArray(s.tags) && s.tags.length ? s.tags : DEFAULT_TAGS };
};
export const writeSettings = (patch) => {
  const cur = readSettings();
  const next = { ...cur };
  if (typeof patch.workspaceName === "string") next.workspaceName = patch.workspaceName.slice(0, 60);
  if (Array.isArray(patch.tags)) {
    next.tags = patch.tags
      .map((t) => ({ name: String(t.name ?? "").trim().slice(0, 20), color: /^#[0-9a-f]{3,8}$/i.test(t.color) ? t.color : "#9aa3b8" }))
      .filter((t) => t.name).slice(0, 12);
    if (!next.tags.length) next.tags = DEFAULT_TAGS;
  }
  atomicWrite(settingsFile(), JSON.stringify(next, null, 2) + "\n");
  return next;
};

/* ---------- 共通 ---------- */
/** 秒 → 00:00.0（59.96秒が「00:60.0」にならないよう、先に0.1秒単位へ丸める。public/common.js の fmt と同じ） */
export const fmt = (t) => {
  t = Math.round(Math.max(0, Number(t) || 0) * 10) / 10;
  const m = Math.floor(t / 60);
  return `${String(m).padStart(2, "0")}:${(t - m * 60).toFixed(1).padStart(4, "0")}`;
};
/** 画面に返すエラー（status は HTTP の番号） */
export const fail = (status, msg) => Object.assign(new Error(msg), { status });
export const VIDEO_EXT = /\.(mp4|m4v|webm|mov)$/i;
export const rel = (abs) => path.relative(ROOT, abs).replace(/\\/g, "/");
/** 作業フォルダの中だけを指す絶対パスにする（外を指したらエラー） */
export const safe = (r) => {
  if (typeof r !== "string" || !r) throw fail(400, "パスがありません");
  const p = path.resolve(ROOT, r);
  if (p !== ROOT && !p.startsWith(ROOT + path.sep)) throw fail(403, "作業フォルダの外は開けません");
  return p;
};
function atomicWrite(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, "utf8");
  fs.renameSync(tmp, file);
}

/* ---------- レビューメモ：<動画>.review.json（メモ一覧）／.review.md（Claudeが読む用）／.review/（スクショ） ---------- */
export const notesFile = (videoAbs) => videoAbs.replace(VIDEO_EXT, ".review.json");
export const shotsDir = (videoAbs) => videoAbs.replace(VIDEO_EXT, ".review");
export const readNotes = (videoAbs) => { const f = notesFile(videoAbs); try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : []; } catch { return []; } };
export const writeNotes = (videoAbs, notes) => { atomicWrite(notesFile(videoAbs), JSON.stringify(notes, null, 2)); writeMd(videoAbs, notes); };
export const noteMtime = (videoAbs) => { try { return fs.statSync(notesFile(videoAbs)).mtimeMs; } catch { return 0; } };

export const writeMd = (videoAbs, notes) => {
  const lines = [`# レビューメモ：${path.basename(videoAbs)}`, "", `更新：${new Date().toLocaleString("ja-JP")}　件数：${notes.length}`, ""];
  for (const n of [...notes].sort((a, b) => a.t - b.t)) {
    const range = n.t2 != null ? `〜${fmt(n.t2)}` : "";
    const tag = n.tag ? `［${n.tag}］` : "";
    const who = n.author ? `（${n.author}）` : "";
    lines.push(`- [${n.done ? "x" : " "}] **${fmt(n.t)}${range}** ${tag}${String(n.text ?? "").replace(/\n/g, " / ")}${who}${n.shot ? `（画像：${n.shot}）` : ""}`);
    if (n.reply) lines.push(`  - 🤖 ${String(n.reply).replace(/\n/g, " / ")}`);
  }
  fs.writeFileSync(videoAbs.replace(VIDEO_EXT, ".review.md"), lines.join("\n") + "\n", "utf8");
};

/** 1件ずつの更新（スマホとPC、複数人で同時に触っても上書きし合わないよう、サーバーで最新に当てる） */
export const applyNoteOp = (videoAbs, op) => {
  let notes = readNotes(videoAbs);
  const now = new Date().toISOString();
  if (op?.op === "upsert" && op.note?.id) {
    const i = notes.findIndex((n) => n.id === op.note.id);
    const prev = i >= 0 ? notes[i] : null;
    const n = { ...op.note, t: Number(op.note.t) || 0, updated: now };
    if (n.t2 != null) n.t2 = Number(n.t2) || null;
    delete n.shotData;
    // 画面が知らないうちに付いた Claude の返信は消さない
    if (prev?.reply && n.reply === undefined) n.reply = prev.reply;
    // 画像を上げ終わる前に書き直したときも、先に付いた画像を外さない
    if (prev?.shot && n.shot === undefined) n.shot = prev.shot;
    if (i >= 0) notes[i] = n; else notes.push(n);
  } else if (op?.op === "delete" && op.id) {
    notes = notes.filter((n) => n.id !== op.id);
  } else throw fail(400, "不明な操作です");
  notes.sort((a, b) => a.t - b.t);
  writeNotes(videoAbs, notes);
  return notes;
};

/* ---------- Claude への依頼 ---------- */
export const reqPath = (id) => path.join(INBOX, `${path.basename(id)}.json`);
export const readReq = (id) => JSON.parse(fs.readFileSync(reqPath(id), "utf8"));
export const writeReq = (r) => { r.updated = new Date().toISOString(); atomicWrite(reqPath(r.id), JSON.stringify(r, null, 2)); };
/** 新しい順。limit を渡すと新しいものから limit 件だけ読む（ファイル名が日時で始まるので名前順で足りる） */
export const listReqs = (limit = Infinity) =>
  fs.readdirSync(INBOX).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, limit)
    .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(INBOX, f), "utf8")); } catch { return null; } })
    .filter(Boolean).sort((a, b) => (a.created < b.created ? 1 : -1));
export const isAlive = () => { try { return Date.now() - fs.statSync(ALIVE).mtimeMs < 15000; } catch { return false; } };
export const newReqId = (d = new Date()) => `${d.toISOString().replace(/[-:T]/g, "").slice(0, 14)}_${Math.random().toString(36).slice(2, 6)}`;

/* ---------- 構成メモ：<案件>/plan/<名前>.plan.json ---------- */
const SKIP = (name) => name === "node_modules" || name.startsWith(".") || name.endsWith(".review") || name.endsWith(".imgreview");
export const findPlans = (dir = ROOT, depth = 0, out = []) => {
  if (depth > 3) return out;
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    if (SKIP(e.name)) continue;
    const p = path.join(dir, e.name);
    if (p === HERE) continue;
    if (e.isDirectory()) findPlans(p, depth + 1, out);
    else if (e.name.endsWith(".plan.json")) out.push(p);
  }
  return out;
};
export const readPlan = (abs) => JSON.parse(fs.readFileSync(abs, "utf8"));
// 1つ前を plan/.history/ に残す（最新30件）。画面は打つたびに自動保存するので、残すのは1分に1回まで
// （毎回残すと30件がすぐ埋まり、少し前の状態に戻れなくなる）
export const writePlan = (abs, plan) => {
  if (fs.existsSync(abs)) {
    const hist = path.join(path.dirname(abs), ".history");
    fs.mkdirSync(hist, { recursive: true });
    const base = path.basename(abs, ".plan.json");
    const stamp = (f) => Number(f.slice(base.length + 1, -".plan.json".length));
    const olds = fs.readdirSync(hist).filter((f) => f.startsWith(base + ".") && Number.isFinite(stamp(f))).sort((a, b) => stamp(a) - stamp(b));
    if (Date.now() - (olds.length ? stamp(olds.at(-1)) : 0) > 60_000) {
      const f = `${base}.${Date.now()}.plan.json`;
      fs.copyFileSync(abs, path.join(hist, f));
      olds.push(f);
    }
    for (const f of olds.slice(0, Math.max(0, olds.length - 30))) fs.unlinkSync(path.join(hist, f));
  }
  plan.updated = new Date().toISOString();
  atomicWrite(abs, JSON.stringify(plan, null, 2));
};

/* ---------- 動画の一覧 ---------- */
export const findVideos = (dir = ROOT, depth = 0, out = []) => {
  if (depth > 6) return out;
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    if (SKIP(e.name)) continue;
    const p = path.join(dir, e.name);
    if (p === HERE) continue;
    if (e.isDirectory()) findVideos(p, depth + 1, out);
    else if (VIDEO_EXT.test(e.name) && (!VIDEO_FOLDERS.length || VIDEO_FOLDERS.includes(path.basename(dir)))) out.push(p);
  }
  return out;
};
/** 「名前_v3.mp4」→ { series: "名前", version: 3 } */
export const seriesOf = (file) => {
  const base = path.basename(file).replace(VIDEO_EXT, "");
  const m = base.match(/^(.*?)[_-]v(\d+)$/i);
  return m ? { series: m[1], version: Number(m[2]) } : { series: base, version: null };
};

/* ---------- 画像レビュー（ポスター・サムネなどの静止画）----------
 * <画像>.imgreview.json（メモ一覧）／.imgreview.md（Claudeが読む用）／.imgreview/（印を描き込んだ全体図）
 * メモ＝{ id, no, x, y, w, h, text, author, done, sentAt, reply }。x,y,w,h は画像に対する 0〜1 の割合（w=h=0 は点）
 * 同じ名前の .png と .jpg は同じ絵として扱い、メモも共有する */
export const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const imgBase = (abs) => abs.replace(IMAGE_EXT, "");
export const imgNotesFile = (abs) => imgBase(abs) + ".imgreview.json";
export const imgShotsDir = (abs) => imgBase(abs) + ".imgreview";
export const imgMdFile = (abs) => imgBase(abs) + ".imgreview.md";
export const readImgNotes = (abs) => { const f = imgNotesFile(abs); try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : []; } catch { return []; } };
export const imgNoteMtime = (abs) => { try { return fs.statSync(imgNotesFile(abs)).mtimeMs; } catch { return 0; } };
const pct = (v) => Math.round(v * 100);
/** メモの場所を言葉にする（「右上」など）＋割合 */
export const imgWhere = (n) => {
  const cx = n.x + (n.w || 0) / 2, cy = n.y + (n.h || 0) / 2;
  const col = cx < 0.34 ? "左" : cx > 0.66 ? "右" : "中央", row = cy < 0.34 ? "上" : cy > 0.66 ? "下" : "";
  const word = col === "中央" ? (row ? `中央${row}` : "中央") : `${col}${row}`;
  return n.w || n.h ? `${word}（横${pct(n.x)}〜${pct(n.x + n.w)}%・縦${pct(n.y)}〜${pct(n.y + n.h)}%）` : `${word}（横${pct(n.x)}%・縦${pct(n.y)}%の点）`;
};
export const writeImgNotes = (abs, notes) => {
  atomicWrite(imgNotesFile(abs), JSON.stringify(notes, null, 2));
  const lines = [`# 画像レビューメモ：${path.basename(abs)}`, "", `更新：${new Date().toLocaleString("ja-JP")}　件数：${notes.length}`, ""];
  for (const n of [...notes].sort((a, b) => (a.no ?? 0) - (b.no ?? 0))) {
    lines.push(`- [${n.done ? "x" : " "}] **#${n.no}** ${imgWhere(n)} ${String(n.text ?? "").replace(/\n/g, " / ")}${n.author ? `（${n.author}）` : ""}`);
    if (n.reply) lines.push(`  - 🤖 ${String(n.reply).replace(/\n/g, " / ")}`);
  }
  fs.writeFileSync(imgMdFile(abs), lines.join("\n") + "\n", "utf8");
};
const unit = (v) => Math.min(1, Math.max(0, Number(v) || 0));
export const applyImgNoteOp = (abs, op) => {
  let notes = readImgNotes(abs);
  if (op?.op === "upsert" && op.note?.id) {
    const i = notes.findIndex((n) => n.id === op.note.id);
    const prev = i >= 0 ? notes[i] : null;
    const n = { ...op.note, x: unit(op.note.x), y: unit(op.note.y), w: unit(op.note.w), h: unit(op.note.h), updated: new Date().toISOString() };
    // 番号は付けたら変えない（全体図の印と合わせるため）。消したメモを「元に戻す」ときは、空いていれば元の番号で戻す
    const want = Number(op.note.no);
    n.no = prev?.no ?? (Number.isInteger(want) && want > 0 && !notes.some((x) => x.no === want) ? want : notes.reduce((m, x) => Math.max(m, x.no ?? 0), 0) + 1);
    if (prev?.reply && n.reply === undefined) n.reply = prev.reply;             // 画面が知らないうちに付いた Claude の返事は消さない
    if (prev?.sentAt && n.sentAt === undefined) n.sentAt = prev.sentAt;
    if (i >= 0) notes[i] = n; else notes.push(n);
  } else if (op?.op === "delete" && op.id) {
    notes = notes.filter((n) => n.id !== op.id);
  } else throw fail(400, "不明な操作です");
  writeImgNotes(abs, notes);
  return notes;
};
/** 一覧に出す画像：videoFolders の名前のフォルダ（既定 out）の直下にあるもの。同じ名前の png と jpg は jpg だけ出す */
export const findImages = (dir = ROOT, depth = 0, out = []) => {
  if (depth > 6) return out;
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  const here = !VIDEO_FOLDERS.length || VIDEO_FOLDERS.includes(path.basename(dir));
  const names = new Set(ents.filter((e) => !e.isDirectory()).map((e) => e.name.toLowerCase()));
  for (const e of ents) {
    if (SKIP(e.name)) continue;
    const p = path.join(dir, e.name);
    if (p === HERE) continue;
    if (e.isDirectory()) { if (!/^check/i.test(e.name)) findImages(p, depth + 1, out); continue; }
    if (!here || !IMAGE_EXT.test(e.name) || /^compare_/i.test(e.name)) continue;
    if (/\.png$/i.test(e.name) && (names.has(e.name.toLowerCase().replace(/\.png$/, ".jpg")) || names.has(e.name.toLowerCase().replace(/\.png$/, ".jpeg")))) continue;
    out.push(p);
  }
  return out;
};
/** 「名前_v3.jpg」→ { series: "名前", version: 3 }（「v9b」のような枝番は suffix） */
export const imgSeriesOf = (file) => {
  const base = path.basename(file).replace(IMAGE_EXT, "");
  const m = base.match(/^(.*?)[_-]v(\d+)([a-z]?)$/i);
  return m ? { series: m[1], version: Number(m[2]), suffix: m[3] || "" } : { series: base, version: null, suffix: "" };
};
