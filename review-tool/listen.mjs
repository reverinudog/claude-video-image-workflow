// Claude側の受信口。Claude Code の Monitor で常駐させる：  node review-tool/listen.mjs
// ・数秒おきに inbox/.alive を更新（ツール画面に「Claude待機中」と出る）
// ・新しい依頼（status: sent）を見つけたら1行出力して status を received にする → Claudeに通知が届く
import fs from "node:fs";
import { ALIVE, listReqs, writeReq } from "./lib.mjs";

const once = process.argv.includes("--once"); // 取りこぼし確認用：未処理の依頼を出して終了
const beat = () => { try { fs.writeFileSync(ALIVE, String(Date.now())); } catch {} };
const scan = () => {
  for (const r of listReqs().reverse()) {
    if (r.status !== "sent") continue;
    r.status = "received";
    r.progress.push({ at: new Date().toISOString(), text: "Claudeが受け取りました" });
    writeReq(r);
    const msg = r.message ? `／ひとこと「${r.message.replace(/\s+/g, " ")}」` : "";
    const who = r.author ? `（${r.author}）` : "";
    const what = r.kind === "image" ? `画像の依頼 ${r.id}：${r.video} メモ${r.notes.length}件` : r.kind === "plan" ? `構成メモの依頼 ${r.id}：${r.video} コメント${r.notes.length}件` : `レビュー依頼 ${r.id}：${r.video} メモ${r.notes.length}件`;
    console.log(`📨 ${what}${who}${msg} → node review-tool/claude.mjs show ${r.id}`);
  }
};
beat(); scan();
if (!once) setInterval(() => { beat(); scan(); }, 2000);
