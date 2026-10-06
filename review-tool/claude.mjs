// Claudeが依頼の進み具合をツール画面に返すためのコマンド
//   node review-tool/claude.mjs show <依頼id>                    依頼の中身（メモ・画像パス）を表示
//   node review-tool/claude.mjs progress <依頼id> "書き出し中…"   進捗をひとこと（status: working）
//   node review-tool/claude.mjs reply <依頼id> <メモid> "返信"    メモ（構成案ならコメント）に🤖返信を付けて対応済みにする
//   node review-tool/claude.mjs done <依頼id> "まとめ" [新しい動画（画像の依頼なら新しい画像）の相対パス]
//   node review-tool/claude.mjs pending                           未処理の依頼一覧
import { listReqs, readImgNotes, readNotes, readPlan, readReq, writeImgNotes, writeNotes, writePlan, writeReq } from "./lib.mjs";

const [cmd, id, ...rest] = process.argv.slice(2);
const now = () => new Date().toISOString();

if (cmd === "pending") {
  for (const r of listReqs()) if (r.status !== "done") console.log(`${r.id}  ${r.status}  ${r.video}  ${r.kind === "plan" ? "コメント" : r.kind === "image" ? "画像メモ" : "メモ"}${r.notes.length}件`);
  process.exit(0);
}
const r = readReq(id);
if (cmd === "show") {
  if (r.kind === "image") console.log(`画像の依頼 ${r.id}（${r.status}）\n画像：${r.videoAbs}${r.size ? `（${r.size}）` : ""}\nメモ一覧：${r.reviewMd}${r.overview ? `\n全体図（番号の印つき。まずこれを見る）：${r.overview}` : ""}`);
  else console.log(r.kind === "plan" ? `構成メモの依頼 ${r.id}（${r.status}）\n構成メモ：${r.videoAbs}` : `依頼 ${r.id}（${r.status}）\n動画：${r.videoAbs}\nメモ一覧：${r.reviewMd}`);
  if (r.author) console.log(`送った人：${r.author}`);
  if (r.message) console.log(`ひとこと：${r.message}`);
  for (const n of r.notes) console.log(`- [${n.id}] ${n.at} ${n.tag ? `［${n.tag}］` : ""}${n.text.replace(/\n/g, " / ")}${n.author && n.author !== r.author ? `（${n.author}）` : ""}${n.shot ? `\n    画像：${n.shot}` : ""}`);
} else if (cmd === "progress") {
  r.status = "working"; r.progress.push({ at: now(), text: rest.join(" ") }); writeReq(r);
} else if (cmd === "reply") {
  const [noteId, ...text] = rest;
  if (r.kind === "plan") {
    // 構成案のコメントに🤖返信
    const plan = readPlan(r.videoAbs);
    const c = plan.items.flatMap((b) => b.comments ?? []).find((x) => x.id === noteId);
    if (!c) throw new Error(`コメント ${noteId} が見つかりません`);
    c.reply = text.join(" "); c.done = true; writePlan(r.videoAbs, plan);
    process.exit(0);
  }
  if (r.kind === "image") {
    const notes = readImgNotes(r.videoAbs);
    const n = notes.find((x) => x.id === noteId);
    if (!n) throw new Error(`メモ ${noteId} が見つかりません`);
    n.reply = text.join(" "); n.done = true; writeImgNotes(r.videoAbs, notes);
    process.exit(0);
  }
  const notes = readNotes(r.videoAbs);
  const n = notes.find((x) => x.id === noteId);
  if (!n) throw new Error(`メモ ${noteId} が見つかりません`);
  n.reply = text.join(" "); n.done = true; writeNotes(r.videoAbs, notes);
} else if (cmd === "done") {
  const [summary, video] = rest;
  r.status = "done"; r.result = summary ?? ""; r.resultVideo = video ?? "";
  r.progress.push({ at: now(), text: "対応が終わりました" }); writeReq(r);
} else {
  console.log("使い方はファイル先頭のコメントを参照"); process.exit(1);
}
