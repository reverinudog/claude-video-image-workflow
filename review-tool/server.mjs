// レビューツール（依存なし）  node server.mjs [--port 5178] [--root <作業フォルダ>] [--inbox <受付箱>] [--host 127.0.0.1]
// ・作業フォルダ以下の out/*.mp4 を一覧表示。メモは動画の隣に <動画名>.review.json / .review.md、スクショは <動画名>.review/
// ・構成メモ（<案件>/plan/*.plan.json）を1行ずつ添削するページ（/plan）
// ・演出カタログ（motion-kit の部品を動画で一覧するページ、/catalog）
// ・画像レビュー（out/ の静止画に、場所つきのメモを付けるページ、/image）
// ・「Claudeに送る」→ inbox/<id>.json に依頼を置く。待機中のClaude（listen.mjs）が拾って対応する（claude.mjs で返信）
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {
  HERE, HOST, INBOX, PORT, ROOT, VERSION, VIDEO_EXT, VIDEO_FOLDERS, applyNoteOp, fail, findPlans, findVideos, fmt, isAlive, listReqs, newReqId,
  noteMtime, readNotes, readPlan, readSettings, rel, safe, seriesOf, shotsDir, writeNotes, writePlan, writeReq, writeSettings,
  IMAGE_EXT, applyImgNoteOp, findImages, imgMdFile, imgNoteMtime, imgSeriesOf, imgShotsDir, imgWhere, readImgNotes, writeImgNotes,
} from "./lib.mjs";

const PUB = path.join(HERE, "public");
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".webmanifest": "application/manifest+json",
  ".mp4": "video/mp4", ".m4v": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4",
};
// /file/ で渡してよいのは動画・画像・音声だけ（作業フォルダの設定ファイルなどは見せない）
const MEDIA = /\.(mp4|m4v|webm|mov|png|jpe?g|webp|gif|mp3|wav|m4a)$/i;
const MAX_BODY = 40 * 1024 * 1024;

const HttpError = function (code, msg) { return fail(code, msg); }; // new HttpError(404, "…") → status 付きのエラー
/** URLの %xx を戻す（壊れていたら 400） */
const decode = (s) => { try { return decodeURIComponent(s); } catch { throw new HttpError(400, "URLが壊れています"); } };
const body = (req) => new Promise((res, rej) => {
  const c = []; let n = 0;
  req.on("data", (d) => { n += d.length; if (n > MAX_BODY) { rej(new HttpError(413, "送るデータが大きすぎます")); req.destroy(); } else c.push(d); });
  req.on("end", () => res(Buffer.concat(c).toString("utf8")));
  req.on("error", rej);
});
const jsonBody = async (req) => { const s = await body(req); try { return s ? JSON.parse(s) : {}; } catch { throw new HttpError(400, "JSONを読めません"); } };
const json = (res, obj, code = 200) => { res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
const videoAbsOf = (r) => { const v = safe(r); if (!VIDEO_EXT.test(v)) throw new HttpError(400, "動画ではありません"); if (!fs.existsSync(v)) throw new HttpError(404, "動画が見つかりません"); return v; };
const planAbsOf = (r) => { const p = safe(r); if (!p.endsWith(".plan.json")) throw new HttpError(400, "構成メモではありません"); return p; };
const imageAbsOf = (r) => { const v = safe(r); if (!IMAGE_EXT.test(v)) throw new HttpError(400, "画像ではありません"); if (!fs.existsSync(v)) throw new HttpError(404, "画像が見つかりません"); return v; };
const project = (r) => r.split("/")[0];
/** 依頼がその画像のものか。同じ絵の .png と .jpg は同じとみなす（完了のときに .png で渡されても、一覧の .jpg と結び付くように） */
const imgKey = (r) => String(r ?? "").replace(IMAGE_EXT, "");
const reqIsFor = (q, r) => q.video === r || q.resultVideo === r || (q.kind === "image" && IMAGE_EXT.test(r) && (imgKey(q.video) === imgKey(r) || (q.resultVideo && imgKey(q.resultVideo) === imgKey(r))));

const sendStatic = (res, file) => {
  const p = path.resolve(PUB, file);
  if (!p.startsWith(PUB + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) throw new HttpError(404, "ページがありません");
  res.writeHead(200, { "Content-Type": MIME[path.extname(p).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "no-cache" });
  res.end(fs.readFileSync(p));
};

/* ---------- 動画 ---------- */
function videoList() {
  const reqs = listReqs(200);
  return findVideos().map((p) => {
    const r = rel(p), st = fs.statSync(p), notes = readNotes(p), s = seriesOf(p);
    const last = reqs.find((q) => q.video === r || q.resultVideo === r);
    return {
      rel: r, name: path.basename(p), dir: path.dirname(r), project: project(r), series: s.series, version: s.version,
      mtime: st.mtimeMs, size: st.size, open: notes.filter((n) => !n.done).length, total: notes.length,
      unsent: notes.filter((n) => !n.done && !n.sentAt).length, request: last ? { id: last.id, status: last.status, video: last.video } : null,
    };
  }).sort((a, b) => b.mtime - a.mtime);
}
/** 同じフォルダの同じ名前（_vN 違い）の版 */
function versionsOf(videoAbs) {
  const dir = path.dirname(videoAbs), s = seriesOf(videoAbs);
  let ents = [];
  try { ents = fs.readdirSync(dir); } catch {}
  return ents.filter((f) => VIDEO_EXT.test(f) && seriesOf(f).series === s.series)
    .map((f) => { const p = path.join(dir, f), notes = readNotes(p); return { rel: rel(p), name: f, version: seriesOf(f).version, mtime: mtime(p), total: notes.length, open: notes.filter((n) => !n.done).length }; })
    .sort((a, b) => (a.version ?? 0) - (b.version ?? 0) || a.mtime - b.mtime);
}

/* ---------- 画像 ---------- */
function imageList() {
  const reqs = listReqs(200);
  return findImages().map((p) => {
    const r = rel(p), st = fs.statSync(p), notes = readImgNotes(p), s = imgSeriesOf(p);
    const last = reqs.find((q) => reqIsFor(q, r));
    return {
      rel: r, name: path.basename(p), dir: path.dirname(r), project: project(r), series: s.series, version: s.version, suffix: s.suffix,
      mtime: st.mtimeMs, size: st.size, open: notes.filter((n) => !n.done).length, total: notes.length,
      unsent: notes.filter((n) => !n.done && !n.sentAt).length, request: last ? { id: last.id, status: last.status, video: last.video } : null,
    };
  }).sort((a, b) => b.mtime - a.mtime);
}
/** 同じフォルダの同じ名前（_vN 違い）の版 */
function imageVersionsOf(abs) {
  const s = imgSeriesOf(abs), dir = path.dirname(abs);
  return findImages(dir, 6).filter((p) => path.dirname(p) === dir && imgSeriesOf(p).series === s.series)
    .map((p) => { const v = imgSeriesOf(p), notes = readImgNotes(p); return { rel: rel(p), name: path.basename(p), version: v.version, suffix: v.suffix, mtime: mtime(p), total: notes.length, open: notes.filter((n) => !n.done).length }; })
    .sort((a, b) => (a.version ?? 0) - (b.version ?? 0) || a.suffix.localeCompare(b.suffix) || a.mtime - b.mtime);
}
function sendImage({ image, message, author, width, height, overview }) {
  const v = imageAbsOf(image);
  const notes = readImgNotes(v);
  const targets = notes.filter((n) => !n.done && !n.sentAt).sort((a, b) => (a.no ?? 0) - (b.no ?? 0)); // 番号順に渡す（消して戻すと並びが入れ替わる）
  if (!targets.length && !String(message ?? "").trim()) throw new HttpError(400, "送るメモがありません");
  const now = new Date();
  targets.forEach((n) => (n.sentAt = now.toISOString()));
  writeImgNotes(v, notes);
  const W = Number(width) || 0, H = Number(height) || 0;
  const px = (n) => (!W || !H ? "" : n.w || n.h
    ? `／元画像の画素 x${Math.round(n.x * W)}〜${Math.round((n.x + n.w) * W)}・y${Math.round(n.y * H)}〜${Math.round((n.y + n.h) * H)}`
    : `／元画像の画素 x${Math.round(n.x * W)}・y${Math.round(n.y * H)}`);
  const ov = overview ? path.join(imgShotsDir(v), path.basename(String(overview))) : "";
  const r = {
    id: newReqId(now), kind: "image", created: now.toISOString(), status: "sent", video: rel(v), videoAbs: v, reviewMd: imgMdFile(v),
    message: clip(message, 4000).trim(), author: clip(author, 40), size: W && H ? `${W}×${H}` : "", overview: ov && fs.existsSync(ov) ? ov : "",
    notes: targets.map((n) => ({ id: n.id, at: `#${n.no} ${imgWhere(n)}${px(n)}`, tag: "", text: n.text, author: n.author || "", shot: null })),
    progress: [], result: "", resultVideo: "",
  };
  writeReq(r);
  return r;
}

/* ---------- 構成メモ ---------- */
function planList() {
  return findPlans().map((p) => {
    let plan = {};
    try { plan = readPlan(p); } catch {}
    const items = plan.items ?? [];
    const comments = items.flatMap((i) => i.comments ?? []);
    const r = rel(p);
    return {
      rel: r, name: path.basename(p, ".plan.json"), title: plan.title || path.basename(p, ".plan.json"), project: project(r), mtime: mtime(p),
      items: items.filter((i) => i.kind !== "head").length, unsent: comments.filter((c) => !c.sentAt && !c.done && c.by !== "claude").length,
      replies: comments.filter((c) => c.reply).length,
    };
  }).sort((a, b) => b.mtime - a.mtime);
}
function projectList() {
  let ents = [];
  try { ents = fs.readdirSync(ROOT, { withFileTypes: true }); } catch {}
  return ents.filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules" && path.join(ROOT, e.name) !== HERE)
    .map((e) => ({ rel: e.name, mtime: mtime(path.join(ROOT, e.name)) })).sort((a, b) => b.mtime - a.mtime);
}

/* ---------- 依頼 ---------- */
const clip = (s, n = 400) => String(s ?? "").slice(0, n);
function sendNotes({ video, message, author }) {
  const v = videoAbsOf(video);
  const notes = readNotes(v);
  const targets = notes.filter((n) => !n.done && !n.sentAt);
  if (!targets.length && !String(message ?? "").trim()) throw new HttpError(400, "送るメモがありません");
  const now = new Date();
  targets.forEach((n) => (n.sentAt = now.toISOString()));
  writeNotes(v, notes);
  const r = {
    id: newReqId(now), created: now.toISOString(), status: "sent", video: rel(v), videoAbs: v,
    reviewMd: v.replace(VIDEO_EXT, ".review.md"), message: clip(message, 4000).trim(), author: clip(author, 40),
    notes: targets.map((n) => ({ id: n.id, at: fmt(n.t) + (n.t2 != null ? `〜${fmt(n.t2)}` : ""), tag: n.tag || "", text: n.text, author: n.author || "", shot: n.shot ? path.join(path.dirname(v), n.shot) : null })),
    progress: [], result: "", resultVideo: "",
  };
  writeReq(r);
  return r;
}
// 構成メモの中身の指紋（public/plan.js の planSig と同じ作り）
const planSig = (p) => JSON.stringify([p.title ?? "", p.intro ?? "", (p.items ?? []).map((i) => [i.id, i.kind ?? "", i.text ?? ""]), p.removed ?? []]);
function sendPlan({ path: r, message, author }) {
  const p = planAbsOf(r);
  const plan = readPlan(p);
  const now = new Date();
  const targets = [];
  for (const it of plan.items ?? []) for (const c of it.comments ?? []) if (!c.sentAt && !c.done && c.by !== "claude") { c.sentAt = now.toISOString(); targets.push({ id: c.id, at: `「${it.text}」`, tag: "", text: c.text, author: c.author || "", shot: null }); }
  const editsUnsent = plan.edited && planSig(plan) !== plan.sentSig; // 前に送ったあと、変わっているか
  if (!targets.length && !String(message ?? "").trim() && !editsUnsent) throw new HttpError(400, "送るコメントや書き換えがありません");
  plan.sentAt = now.toISOString();
  plan.sentSig = planSig(plan); // 送った時点の中身。画面はこれと比べて「送ったあとに変えたか」を出す
  writePlan(p, plan);
  const q = { id: newReqId(now), kind: "plan", created: now.toISOString(), status: "sent", video: rel(p), videoAbs: p, reviewMd: p, message: clip(message, 4000).trim(), author: clip(author, 40), notes: targets, progress: [], result: "", resultVideo: "" };
  writeReq(q);
  return q;
}

/* ---------- ルーティング ---------- */
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://x");
    const p = u.pathname, q = (k) => u.searchParams.get(k);
    const POST = req.method === "POST";
    // 書き込みは JSON だけ受け付ける：ほかのサイトからこっそり送られた依頼（CSRF）を通さないため
    // （ブラウザは別サイトからの JSON 送信の前に確認を挟み、このサーバーはそれに答えないので止まる）
    if (POST && !String(req.headers["content-type"] ?? "").startsWith("application/json")) throw new HttpError(415, "JSON で送ってください");

    // 画面
    if (p === "/" || p === "/index.html") return sendStatic(res, "index.html");
    if (p === "/plan" || p === "/plan.html") return sendStatic(res, "plan.html");
    if (p === "/catalog" || p === "/catalog.html") return sendStatic(res, "catalog.html");
    if (p === "/image" || p === "/image.html") return sendStatic(res, "image.html");
    // 演出カタログのデータ（motion-kit/tools/catalog.mjs が作る）。動画・音は /file/ から
    if (p === "/api/catalog") {
      const f = path.join(ROOT, "motion-kit", "catalog", "data.json");
      if (!fs.existsSync(f)) throw new HttpError(404, "カタログがまだありません（node motion-kit/tools/catalog.mjs で作る）");
      return json(res, JSON.parse(fs.readFileSync(f, "utf8")));
    }
    if (p === "/favicon.ico" || p === "/favicon.svg") return sendStatic(res, "icon.svg");
    if (p === "/manifest.webmanifest") return sendStatic(res, "manifest.webmanifest");
    if (p.startsWith("/assets/")) return sendStatic(res, decode(p.slice(8)));

    // 状態・設定
    if (p === "/api/health") return json(res, { ok: true, version: VERSION, workspace: path.basename(ROOT), alive: isAlive(), time: Date.now() });
    if (p === "/api/settings") return json(res, { ...(POST ? writeSettings(await jsonBody(req)) : readSettings()), videoFolders: VIDEO_FOLDERS, root: ROOT });

    // 動画とメモ
    if (p === "/api/videos") return json(res, videoList());
    if (p === "/api/versions") return json(res, versionsOf(videoAbsOf(q("video"))));
    if (p === "/api/notes") {
      const v = videoAbsOf(q("video"));
      if (POST) { writeNotes(v, (await jsonBody(req)) ?? []); return json(res, { ok: true, mtime: noteMtime(v) }); } // 旧形式（まとめて保存）
      return json(res, { mtime: noteMtime(v), notes: readNotes(v) });
    }
    if (p === "/api/notes/op" && POST) {
      const v = videoAbsOf(q("video"));
      const notes = applyNoteOp(v, await jsonBody(req));
      return json(res, { ok: true, mtime: noteMtime(v), notes });
    }
    if (p === "/api/shot" && POST) {
      const v = videoAbsOf(q("video"));
      const { name, data } = await jsonBody(req);
      const m = String(data ?? "").match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
      if (!m) throw new HttpError(400, "画像ではありません");
      const safeName = path.basename(String(name ?? "shot")).replace(/[^\w.-]/g, "_").replace(/\.(png|jpe?g|webp)$/i, "") + "." + (m[1] === "jpeg" ? "jpg" : m[1]);
      const dir = shotsDir(v);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, safeName), Buffer.from(m[2], "base64"));
      return json(res, { ok: true, path: `${path.basename(dir)}/${safeName}` });
    }

    // 画像とメモ
    if (p === "/api/images") return json(res, imageList());
    if (p === "/api/image/versions") return json(res, imageVersionsOf(imageAbsOf(q("image"))));
    if (p === "/api/image/notes") { const v = imageAbsOf(q("image")); return json(res, { mtime: imgNoteMtime(v), notes: readImgNotes(v) }); }
    if (p === "/api/image/notes/op" && POST) {
      const v = imageAbsOf(q("image"));
      const notes = applyImgNoteOp(v, await jsonBody(req));
      return json(res, { ok: true, mtime: imgNoteMtime(v), notes });
    }
    if (p === "/api/image/shot" && POST) { // 印を描き込んだ全体図（Claude が場所を目で確かめる用）
      const v = imageAbsOf(q("image"));
      const { name, data } = await jsonBody(req);
      const m = String(data ?? "").match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
      if (!m) throw new HttpError(400, "画像ではありません");
      const safeName = path.basename(String(name ?? "overview")).replace(/[^\w.-]/g, "_").replace(/\.(png|jpe?g|webp)$/i, "") + "." + (m[1] === "jpeg" ? "jpg" : m[1]);
      const dir = imgShotsDir(v);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, safeName), Buffer.from(m[2], "base64"));
      return json(res, { ok: true, name: safeName });
    }
    if (p === "/api/image/send" && POST) { const r = sendImage(await jsonBody(req)); return json(res, { ok: true, request: r, alive: isAlive() }); }

    // Claude
    if (p === "/api/claude") {
      const target = q("video");
      const reqs = listReqs(200).filter((r) => !target || reqIsFor(r, target)).slice(0, 30);
      return json(res, { alive: isAlive(), requests: reqs });
    }
    if (p === "/api/send" && POST) { const r = sendNotes(await jsonBody(req)); return json(res, { ok: true, request: r, alive: isAlive() }); }

    // 構成メモ
    if (p === "/api/plans") return json(res, planList());
    if (p === "/api/projects") return json(res, projectList());
    if (p === "/api/plan") {
      const pp = planAbsOf(q("path"));
      if (!fs.existsSync(pp)) throw new HttpError(404, "構成メモが見つかりません");
      if (!POST) return json(res, { mtime: mtime(pp), plan: readPlan(pp) });
      const { plan, baseMtime, force } = await jsonBody(req);
      if (!plan || !Array.isArray(plan.items)) throw new HttpError(400, "構成メモの形ではありません");
      // 開いている間にClaude（や別の端末）が書き換えていたら上書きしない
      if (!force && baseMtime && Math.abs(mtime(pp) - baseMtime) > 1) return json(res, { conflict: true, mtime: mtime(pp), plan: readPlan(pp) }, 409);
      writePlan(pp, plan);
      return json(res, { ok: true, mtime: mtime(pp) });
    }
    if (p === "/api/plan/send" && POST) { const r = sendPlan(await jsonBody(req)); return json(res, { ok: true, request: r, alive: isAlive() }); }
    if (p === "/api/plan/new" && POST) {
      const { project: proj, name, title, createProject } = await jsonBody(req);
      let dir;
      if (createProject) { // 案件のフォルダも一緒に作る（作業フォルダの直下に1つだけ）
        const pn = String(proj ?? "").trim().replace(/[\\/:*?"<>|]/g, "_").replace(/^\.+/, "").slice(0, 60);
        if (!pn) throw new HttpError(400, "フォルダの名前を入れてください");
        dir = safe(pn);
        fs.mkdirSync(dir, { recursive: true });
      } else dir = safe(String(proj ?? ""));
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new HttpError(400, "フォルダが見つかりません");
      const base = String(name ?? "").trim().replace(/\.plan\.json$/i, "").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60) || "plan_v1";
      const file = path.join(dir, "plan", `${base}.plan.json`);
      if (fs.existsSync(file)) throw new HttpError(409, "同じ名前の構成メモがあります");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const id = () => "i" + Math.random().toString(36).slice(2, 8);
      const plan = { title: String(title ?? "").trim() || base, intro: "", items: [{ id: id(), kind: "head", text: "はじまり", comments: [] }, { id: id(), text: "", comments: [] }] };
      writePlan(file, plan);
      return json(res, { ok: true, rel: rel(file) });
    }

    // ファイル（動画・画像・音声だけ）
    if (p.startsWith("/file/")) {
      const f = safe(decode(p.slice(6)));
      if (!MEDIA.test(f)) throw new HttpError(403, "このファイルは開けません");
      if (!fs.existsSync(f)) throw new HttpError(404, "ファイルが見つかりません");
      const st = fs.statSync(f);
      const type = MIME[path.extname(f).toLowerCase()] ?? "application/octet-stream";
      const range = req.headers.range;
      if (range) {
        const [a, b] = range.replace("bytes=", "").split(",")[0].split("-");
        // 「bytes=-500」は最後の500バイト
        const start = a === "" ? Math.max(0, st.size - Number(b)) : Number(a);
        const end = a === "" ? st.size - 1 : Math.min(st.size - 1, b ? Number(b) : start + 8 * 1024 * 1024);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= st.size || end < start) { res.writeHead(416, { "Content-Range": `bytes */${st.size}` }); return res.end(); }
        res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1, "Cache-Control": "no-cache" });
        return fs.createReadStream(f, { start, end }).pipe(res);
      }
      res.writeHead(200, { "Content-Type": type, "Content-Length": st.size, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" });
      return fs.createReadStream(f).pipe(res);
    }
    throw new HttpError(404, "見つかりません");
  } catch (e) {
    const code = e.status ?? 500;
    if (code === 500) console.error(e);
    if (!res.headersSent) json(res, { error: e.message || String(e) }, code);
    else res.end();
  }
});
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.error(`ポート ${PORT} はすでに使われています（レビューツールが起動済みなら http://localhost:${PORT} を開いてください）`);
  else console.error(e);
  process.exit(1);
});
server.listen(PORT, HOST, () => {
  console.log(`レビューツール v${VERSION} 起動：http://localhost:${PORT}`);
  console.log(`  作業フォルダ：${ROOT}`);
  console.log(`  受付箱　　　：${INBOX}`);
});
