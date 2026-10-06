// 画像レビュー画面：静止画（ポスター・サムネ）の上をなぞって範囲、押して点。そこにメモを書いて Claude に送る
// メモ＝{ id, no, x, y, w, h, text, author, done, sentAt, reply }（x,y,w,h は画像に対する 0〜1 の割合）
import {
  $, $$, esc, uid, ago, clamp, sleep, icon, iconBtn, fillIcons, store, prefs, api, fileUrl, toast, anyModal, avatar,
  mountTopbar, mountPicker, listPicker, visiblePicker, stepper, LIVE, setTitle, claudeInfo, openSettings, openHelp, steps3, welcome,
} from "./common.js";

const bar = mountTopbar("image");
const enc = encodeURIComponent;
const S = {
  images: [], rel: null, notes: [], mtime: 0, versions: [], sel: null, filter: store.get("imgFilter", "open"),
  reqs: [], alive: false, zoom: 1, editing: null, // editing＝書いている途中のメモ（新規は id なし）
};
const img = $("#img"), canvas = $("#canvas"), marks = $("#marks"), wrap = $("#wrap");
fillIcons();

/* ================= 一覧と選ぶ ================= */
const verName = (x) => (x.version != null ? `v${x.version}${x.suffix || ""}` : x.name);
async function loadList() {
  try { S.images = await api("/api/images"); } catch { return; }
  renderPicker();
}
function renderPicker() {
  const p = S.images.find((x) => x.rel === S.rel);
  mountPicker({
    ic: "image", tip: "画像を選ぶ（/）", onOpen: openPicker,
    title: p ? p.name : S.images.length ? "画像を選ぶ" : "画像がありません",
    sub: p ? `${p.project} · ${ago(p.mtime)}` : "",
    badge: p?.unsent ? `<span class="badge accent" title="まだ送っていないメモ">${icon("msg", "s")}${p.unsent}</span>` : "",
  });
}
function openPicker(anchor = visiblePicker()) {
  // 同じ名前の版は、いちばん新しい版だけを一覧に出す（古い版は開いてから上の版ボタンで）
  const latest = new Map();
  for (const x of S.images) { const k = `${x.dir}/${x.series}`; const c = latest.get(k); if (!c || (x.version ?? 0) > (c.version ?? 0) || ((x.version ?? 0) === (c.version ?? 0) && x.mtime > c.mtime)) latest.set(k, x); }
  const items = [...latest.values()].sort((a, b) => b.mtime - a.mtime);
  listPicker(anchor, {
    items: () => items, group: (x) => x.project, match: (x, q) => `${x.name} ${x.rel}`.toLowerCase().includes(q), selected: (x) => x.rel === S.rel || (S.versions.some((v) => v.rel === x.rel)),
    placeholder: "画像を探す", empty: S.images.length ? "見つかりません" : "まだ画像はありません（案件の out フォルダに書き出すと出ます）", width: 560,
    foot: `<span class="num">${items.length}件</span>`,
    onPick: (x) => openImage(x.rel),
    row: (x) => `<img class="pk-thumb" loading="lazy" decoding="async" alt="" src="${esc(fileUrl(x.rel))}" />
      <span class="grow"><span class="name ellipsis block">${esc(x.series)}${x.version != null ? ` <span class="faint">${verName(x)}</span>` : ""}</span><span class="meta ellipsis block">${esc(x.dir)} · ${ago(x.mtime)}</span></span>
      ${x.unsent ? `<span class="badge accent" title="まだ送っていないメモ">${icon("msg", "s")}${x.unsent}</span>` : ""}${x.request && x.request.status !== "done" ? `<span class="badge claude">${icon("spark", "s")}</span>` : ""}`,
  });
}

/** 同じ絵の別の拡張子（.png ⇔ .jpg）で渡されたら、一覧に出ているほうへ読み替える */
const canon = (rel) => {
  if (!rel || S.images.some((x) => x.rel === rel)) return rel;
  const base = rel.replace(/\.(png|jpe?g|webp)$/i, "");
  return S.images.find((x) => x.rel.replace(/\.(png|jpe?g|webp)$/i, "") === base)?.rel ?? rel;
};
async function openImage(rel, { keepSel } = {}) {
  rel = canon(rel);
  commitIfTyped();
  S.rel = rel; if (!keepSel) S.sel = null;
  store.set("imgLast", rel);
  history.replaceState(null, "", `/image?i=${enc(rel)}`);
  $("#stageEmpty").hidden = true; canvas.hidden = false;
  img.src = fileUrl(rel) + `?m=${S.images.find((x) => x.rel === rel)?.mtime ?? ""}`;
  setTitle(rel.split("/").pop());
  renderPicker();
  try {
    const [n, v] = await Promise.all([api(`/api/image/notes?image=${enc(rel)}`), api(`/api/image/versions?image=${enc(rel)}`)]);
    if (S.rel !== rel) return;
    S.notes = n.notes; S.mtime = n.mtime; S.versions = v;
  } catch (e) { if (S.rel !== rel) return; toast(e.message, { kind: "err" }); S.notes = []; S.mtime = 0; S.versions = []; }
  S.reqs = []; lastStrip = null; lastReqSig = null; lastSendSig = null;
  render(); pollClaude();
}

/* ================= 描く ================= */
const sorted = () => [...S.notes].sort((a, b) => (a.no ?? 0) - (b.no ?? 0));
const state = (n) => (n.done ? "done" : n.sentAt ? "sent" : "");
function render() { renderVers(); renderMarks(); renderList(); renderSend(); }

function renderVers() {
  const el = $("#verbar");
  if (!S.rel) { el.innerHTML = ""; return; }
  const i = S.versions.findIndex((v) => v.rel === S.rel), prev = i > 0 ? S.versions[i - 1] : null;
  el.innerHTML = `
    ${S.versions.length > 1 ? `<div class="vers" role="group" aria-label="版">${S.versions.map((v) => `<button class="${v.rel === S.rel ? "on" : ""}" data-rel="${esc(v.rel)}" title="${esc(v.name)}">${esc(verName(v))}${v.open ? `<span class="n">${v.open}</span>` : ""}</button>`).join("")}</div>` : ""}
    ${prev ? `<button class="btn sm cmp" id="cmpBtn" title="押している間、前の版（${esc(verName(prev))}）を表示（C）">${icon("history", "s")}前の版</button>` : ""}
    <span class="grow"></span>
    <span class="size faint num" id="sizeTxt"></span>
    <div class="seg" role="group" aria-label="大きさ">${[[1, "全体"], [2, "2倍"], [0, "原寸"]].map(([z, t]) => `<button data-z="${z}" class="${S.zoom === z ? "on" : ""}">${t}</button>`).join("")}</div>
    ${iconBtn("eye", "印を隠す・出す（H）", 'id="hideBtn"')}`;
  $$("[data-rel]", el).forEach((b) => (b.onclick = () => openImage(b.dataset.rel)));
  $$("[data-z]", el).forEach((b) => (b.onclick = () => setZoom(Number(b.dataset.z))));
  $("#hideBtn").onclick = () => marks.classList.toggle("hide");
  const cmp = $("#cmpBtn");
  if (cmp) {
    cmp.addEventListener("pointerdown", (e) => { e.preventDefault(); compare(true); try { cmp.setPointerCapture(e.pointerId); } catch {} });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) cmp.addEventListener(ev, () => compare(false));
  }
  $(".vers .on", el)?.scrollIntoView({ inline: "center", block: "nearest" }); // 版が多いとき、今の版が見える所まで送る
  sizeText();
}
const sizeText = () => { const s = $("#sizeTxt"); if (s && img.naturalWidth) s.textContent = `${img.naturalWidth}×${img.naturalHeight}`; };
img.addEventListener("load", () => { sizeText(); setZoom(S.zoom); });
function setZoom(z) {
  S.zoom = z;
  wrap.classList.toggle("zoomed", z !== 1);
  if (z === 1) img.style.width = "";
  else if (z === 0) img.style.width = img.naturalWidth + "px";
  else { img.style.width = ""; wrap.classList.remove("zoomed"); const w = img.getBoundingClientRect().width; wrap.classList.add("zoomed"); img.style.width = Math.round(w * z) + "px"; }
  $$("[data-z]").forEach((b) => b.classList.toggle("on", Number(b.dataset.z) === z));
  placeComposer();
}
/** 押している間だけ前の版を重ねる */
function compare(on) {
  const i = S.versions.findIndex((v) => v.rel === S.rel), prev = i > 0 ? S.versions[i - 1] : null;
  const p = $("#imgPrev"); if (!prev) return;
  $("#cmpBtn")?.classList.toggle("holding", on);
  $(".cmp-tag")?.remove();
  if (on) {
    if (p.dataset.rel !== prev.rel) { p.src = fileUrl(prev.rel); p.dataset.rel = prev.rel; }
    p.hidden = false; marks.style.visibility = "hidden";
    canvas.insertAdjacentHTML("beforeend", `<span class="cmp-tag">${esc(verName(prev))}（前の版）</span>`);
  } else { p.hidden = true; marks.style.visibility = ""; }
}

function renderMarks() {
  marks.innerHTML = sorted().map((n) => {
    const st = state(n), sel = n.id === S.sel ? "sel" : "";
    return n.w || n.h
      ? `<div class="mk rect ${st} ${sel}" data-id="${n.id}" style="left:${n.x * 100}%;top:${n.y * 100}%;width:${n.w * 100}%;height:${n.h * 100}%"><span class="no">${n.no}</span></div>`
      : `<div class="mk pin ${st} ${sel}" data-id="${n.id}" style="left:${n.x * 100}%;top:${n.y * 100}%"><span class="no">${n.no}</span></div>`;
  }).join("");
}
function renderList() {
  const all = sorted(), open = all.filter((n) => !n.done), done = all.filter((n) => n.done);
  $("#cOpen").textContent = open.length || ""; $("#cAll").textContent = all.length || ""; $("#cDone").textContent = done.length || "";
  $$("#filter button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.f === S.filter));
  const show = S.filter === "open" ? open : S.filter === "done" ? done : all;
  const list = $("#list");
  $("#hint").innerHTML = S.rel ? `${icon("hand", "s")}なぞる＝範囲／押す＝点` : "";
  if (!S.rel) { list.innerHTML = ""; return; }
  if (!show.length) {
    list.innerHTML = `<div class="empty"><div class="art">${icon(all.length ? "check" : "notePlus")}</div><h3>${all.length ? (S.filter === "done" ? "対応済みはまだありません" : "未対応のメモはありません") : "画像の上をなぞってメモ"}</h3>
      <p>${all.length ? "" : "直したい所をなぞると範囲、押すと点。そのまま気になることを書いて、最後に下の「送る」で Claude に届きます。"}</p></div>`;
    return;
  }
  list.innerHTML = show.map((n) => `
    <div class="note ${state(n)} ${n.id === S.sel ? "sel" : ""}" data-id="${n.id}" tabindex="0">
      <span class="no">${n.no}</span>
      <div class="text">${esc(n.text)}</div>
      <div class="acts">
        ${iconBtn(n.done ? "undo" : "check", n.done ? "未対応に戻す" : "対応済みにする", `data-act="done"`)}
        ${iconBtn("edit", "書き直す", `data-act="edit"`)}
        ${iconBtn("trash", "消す", `data-act="del"`)}
      </div>
      <div class="meta">${n.author ? `<span>${esc(n.author)}</span>` : ""}${n.sentAt && !n.done ? `<span class="badge claude">${icon("send", "s")}送信済み</span>` : ""}${n.done && !n.reply ? `<span class="badge ok">${icon("check", "s")}対応済み</span>` : ""}</div>
      ${n.reply ? `<div class="reply">${avatar("", true)}<span>${esc(n.reply)}</span></div>` : ""}
    </div>`).join("");
}
$("#filter").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; S.filter = b.dataset.f; store.set("imgFilter", S.filter); renderList(); });
$("#list").addEventListener("click", (e) => {
  const card = e.target.closest(".note"); if (!card) return;
  const n = S.notes.find((x) => x.id === card.dataset.id); if (!n) return;
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "done") return saveNote({ ...n, done: !n.done });
  if (act === "del") return removeNote(n);
  select(n.id, { scrollMark: true });
  if (act === "edit") openComposer(n);
});
marks.addEventListener("click", (e) => {
  const m = e.target.closest(".mk"); if (!m || dragMoved) return;
  const n = S.notes.find((x) => x.id === m.dataset.id); if (!n) return;
  if (S.sel === n.id) openComposer(n); else select(n.id, { scrollList: true });
});
function select(id, { scrollMark, scrollList } = {}) {
  S.sel = id;
  const n = S.notes.find((x) => x.id === id);
  if (n?.done && S.filter === "open") S.filter = "all";
  renderMarks(); renderList();
  if (scrollMark) $(`.mk[data-id="${id}"]`)?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  if (scrollList) $(`.note[data-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/* ================= なぞって範囲・押して点 ================= */
let drag = null, dragMoved = false;
const rel01 = (e) => { const r = canvas.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1)]; };
canvas.addEventListener("pointerdown", (e) => {
  if (!S.rel || e.button > 0 || e.target.closest(".mk") || !$("#imgPrev").hidden) return;
  commitIfTyped();
  const [x, y] = rel01(e);
  drag = { x0: x, y0: y, sx: e.clientX, sy: e.clientY, id: e.pointerId };
  dragMoved = false;
  try { canvas.setPointerCapture(e.pointerId); } catch {} // 取れなくても、なぞり自体は続けられる
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!dragMoved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
  dragMoved = true;
  const [x, y] = rel01(e), d = $("#draft");
  d.hidden = false;
  Object.assign(d.style, { left: Math.min(x, drag.x0) * 100 + "%", top: Math.min(y, drag.y0) * 100 + "%", width: Math.abs(x - drag.x0) * 100 + "%", height: Math.abs(y - drag.y0) * 100 + "%" });
});
const endDrag = (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const [x, y] = rel01(e), d0 = drag; drag = null;
  $("#draft").hidden = true;
  if (e.type === "pointercancel") return;
  const n = dragMoved
    ? { x: Math.min(x, d0.x0), y: Math.min(y, d0.y0), w: Math.abs(x - d0.x0), h: Math.abs(y - d0.y0) }
    : { x: d0.x0, y: d0.y0, w: 0, h: 0 };
  if (dragMoved && (n.w < 0.012 || n.h < 0.012)) { n.x += n.w / 2; n.y += n.h / 2; n.w = n.h = 0; } // 細すぎる範囲は点として扱う
  openComposer({ ...n, text: "" });
  setTimeout(() => (dragMoved = false), 0);
};
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

/* ================= メモを書く ================= */
function openComposer(n) {
  S.editing = { ...n };
  if (n.id) S.sel = n.id;
  const c = $("#composer");
  c.hidden = false;
  c.innerHTML = `
    <textarea class="textarea" id="cmpText" placeholder="ここをどうしたい？（例：もっと大きく／暗くしたい／この文字いらない）" aria-label="メモ">${esc(n.text ?? "")}</textarea>
    <div class="foot"><span class="where faint grow">${n.w || n.h ? "範囲" : "点"}${n.no ? `・#${n.no}` : ""}</span>
      <button class="btn sm" data-x>やめる</button><button class="btn primary sm" data-ok>${icon("check", "s")}${n.id ? "直す" : "メモする"}</button></div>`;
  // 新しい印は、書いている間も見えるように仮で出す
  const d = $("#draft");
  if (!n.id) { d.hidden = false; Object.assign(d.style, n.w || n.h ? { left: n.x * 100 + "%", top: n.y * 100 + "%", width: n.w * 100 + "%", height: n.h * 100 + "%" } : { left: `calc(${n.x * 100}% - 9px)`, top: `calc(${n.y * 100}% - 9px)`, width: "18px", height: "18px" }); }
  const ta = $("#cmpText");
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); commit(); }
    if (e.key === "Escape") { e.preventDefault(); closeComposer(); }
  });
  c.querySelector("[data-x]").onclick = closeComposer;
  c.querySelector("[data-ok]").onclick = commit;
  renderMarks(); renderList(); placeComposer();
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
}
function placeComposer() {
  const c = $("#composer"), n = S.editing;
  if (c.hidden || !n) return;
  const r = canvas.getBoundingClientRect(), cw = c.offsetWidth, ch = c.offsetHeight, pad = 10;
  const bx = r.left + (n.x + (n.w || 0)) * r.width, by = r.top + (n.y + (n.h || 0)) * r.height, ty = r.top + n.y * r.height, lx = r.left + n.x * r.width;
  if (innerWidth <= 820) return; // スマホは上に固定（image.css）。下だとキーボードに隠れる
  // 右に置けるなら右、だめなら左、それもだめなら下
  let x = bx + 14, y = ty;
  if (x + cw > innerWidth - pad) x = lx - cw - 14;
  if (x < pad) { x = clamp(lx, pad, innerWidth - cw - pad); y = by + 14; }
  y = clamp(y, 64, innerHeight - ch - pad);
  Object.assign(c.style, { left: x + "px", top: y + "px", bottom: "auto" });
}
addEventListener("resize", placeComposer);
wrap.addEventListener("scroll", placeComposer);
function closeComposer() { S.editing = null; $("#composer").hidden = true; $("#draft").hidden = true; }
/** 書きかけの文があれば保存、なければ閉じるだけ（別の所を押した・別の画像を開いたとき、書いた文を失わないように） */
function commitIfTyped() {
  if ($("#composer").hidden) return;
  if ($("#cmpText")?.value.trim()) commit(); else closeComposer();
}
async function commit() {
  const n = S.editing; if (!n) return;
  const text = $("#cmpText").value.trim();
  if (!text) { const ta = $("#cmpText"); ta.classList.remove("shake"); void ta.offsetWidth; ta.classList.add("shake"); return; }
  const rel = S.rel;
  closeComposer();
  const edited = n.id && text !== n.text;
  const note = n.id ? { ...n, text } : { id: uid("n"), x: n.x, y: n.y, w: n.w, h: n.h, text, author: prefs.get().name || "", created: new Date().toISOString() };
  if (edited && n.sentAt) { note.sentAt = null; note.done = false; } // 送ったあとに書き直したら、もう一度送れるようにする
  await saveNote(note, true, rel);
}
async function saveNote(note, selectIt, rel = S.rel) {
  bar.setSave("busy");
  try {
    const r = await api(`/api/image/notes/op?image=${enc(rel)}`, { op: "upsert", note });
    if (rel !== S.rel) { bar.setSave("ok"); loadList(); return; } // 保存している間に別の画像へ移った
    S.notes = r.notes; S.mtime = r.mtime;
    if (selectIt) { S.sel = note.id; if (S.filter === "done") S.filter = "open"; }
    bar.setSave("ok"); render(); loadList();
    if (selectIt) $(`.note[data-id="${note.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } catch (e) { bar.setSave("err", e.message); toast(e.message, { kind: "err" }); }
}
async function removeNote(n) {
  const rel = S.rel;
  if (S.editing?.id === n.id) closeComposer();
  try {
    const r = await api(`/api/image/notes/op?image=${enc(rel)}`, { op: "delete", id: n.id });
    S.notes = r.notes; S.mtime = r.mtime; if (S.sel === n.id) S.sel = null;
    render(); loadList();
    toast(`#${n.no} を消しました`, { action: { label: "元に戻す", icon: "undo", fn: () => saveNote(n, false, rel) } });
  } catch (e) { toast(e.message, { kind: "err" }); }
}

/* ================= 送る ================= */
const grow = (ta) => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight + 2) + "px"; };
let lastSendSig = null;
function renderSend() {
  const el = $("#sendbox");
  if (!S.rel) { el.hidden = true; return; }
  el.hidden = false;
  const unsent = S.notes.filter((n) => !n.done && !n.sentAt).length;
  const same = el.dataset.rel === S.rel;
  const msgNow = (same ? $("#sendMsg")?.value : null) ?? store.get("imgMsg:" + S.rel, "");
  const can = !!(unsent || msgNow.trim());
  const sig = [S.rel, unsent, can].join("#");
  el.dataset.rel = S.rel;
  if (same && (document.activeElement?.id === "sendMsg" || sig === lastSendSig)) { const b = $("#sendBtn"); if (b) { b.disabled = !can; b.querySelector(".cnt").textContent = unsent || ""; } return; }
  lastSendSig = sig;
  el.innerHTML = `<textarea class="textarea" id="sendMsg" rows="1" placeholder="全体へのひとこと（任意）" aria-label="全体へのひとこと">${esc(msgNow)}</textarea>
    <button class="btn claude send" id="sendBtn" title="Claude に送る（Ctrl+Enter）" ${can ? "" : "disabled"}>${icon("send")}送る<span class="cnt num">${unsent || ""}</span></button>`;
  const ta = $("#sendMsg");
  grow(ta);
  ta.addEventListener("input", () => { grow(ta); store.set("imgMsg:" + S.rel, ta.value); lastSendSig = null; const b = $("#sendBtn"); if (b) b.disabled = !(ta.value.trim() || S.notes.some((n) => !n.done && !n.sentAt)); });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
  $("#sendBtn").onclick = send;
}
/** 番号の印を描き込んだ全体図（長辺 1800px まで）。Claude はこれで場所を目で確かめる */
function overviewData(targets) {
  const W = img.naturalWidth, H = img.naturalHeight, k = Math.min(1, 1800 / Math.max(W, H));
  const c = document.createElement("canvas");
  c.width = Math.round(W * k); c.height = Math.round(H * k);
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0, c.width, c.height);
  const u = Math.max(c.width, c.height) / 1800, fs = Math.round(34 * u), lw = Math.max(2, Math.round(5 * u));
  g.font = `800 ${fs}px sans-serif`; g.textBaseline = "middle"; g.textAlign = "center";
  for (const n of targets) {
    const x = n.x * c.width, y = n.y * c.height, w = n.w * c.width, h = n.h * c.height;
    g.lineWidth = lw + 4; g.strokeStyle = "#000";
    if (w || h) g.strokeRect(x, y, w, h); else { g.beginPath(); g.arc(x, y, fs * 0.9, 0, 7); g.stroke(); }
    g.lineWidth = lw; g.strokeStyle = "#ffe14d";
    if (w || h) g.strokeRect(x, y, w, h); else { g.beginPath(); g.arc(x, y, fs * 0.9, 0, 7); g.stroke(); }
    const label = String(n.no), bw = Math.max(fs * 1.5, g.measureText(label).width + fs * 0.8), bh = fs * 1.4;
    const lx = clamp(w || h ? x : x + fs * 1.6, bw / 2 + 2, c.width - bw / 2 - 2), ly = clamp(w || h ? y : y - fs * 1.2, bh / 2 + 2, c.height - bh / 2 - 2);
    g.fillStyle = "#ffe14d"; g.strokeStyle = "#000"; g.lineWidth = 3;
    g.beginPath(); if (g.roundRect) g.roundRect(lx - bw / 2, ly - bh / 2, bw, bh, bh / 2); else g.rect(lx - bw / 2, ly - bh / 2, bw, bh); g.fill(); g.stroke();
    g.fillStyle = "#000"; g.fillText(label, lx, ly + 1);
  }
  return c.toDataURL("image/jpeg", 0.86);
}
async function send() {
  const btn = $("#sendBtn"); if (!btn || btn.disabled) return;
  btn.disabled = true;
  const rel = S.rel;
  try {
    if (!$("#composer").hidden && $("#cmpText")?.value.trim()) await commit(); else closeComposer();
    if (!img.complete || !img.naturalWidth) await new Promise((res) => { img.addEventListener("load", res, { once: true }); img.addEventListener("error", res, { once: true }); setTimeout(res, 4000); });
    const targets = sorted().filter((n) => !n.done && !n.sentAt);
    let overview = "";
    if (targets.length && img.naturalWidth) {
      try { overview = (await api(`/api/image/shot?image=${enc(rel)}`, { name: `overview_${Date.now()}`, data: overviewData(targets) })).name; } catch {}
    }
    const r = await api("/api/image/send", { image: rel, message: $("#sendMsg").value, author: prefs.get().name, width: img.naturalWidth, height: img.naturalHeight, overview });
    btn.classList.add("fly"); await sleep(380);
    store.del("imgMsg:" + rel);
    if (S.rel === rel) {
      $("#sendMsg").value = ""; document.activeElement?.blur();
      const g = await api(`/api/image/notes?image=${enc(rel)}`); S.notes = g.notes; S.mtime = g.mtime;
      lastSendSig = null; render(); pollClaude();
    }
    loadList();
    toast(r.alive ? "Claude に届きました" : "受付箱に入れました。Claude が来たら拾います", { kind: "claude" });
  } catch (e) { toast(e.message, { kind: "err" }); btn.disabled = false; }
}

/* ================= Claude ================= */
let lastStrip = null, lastReqSig = null, pollP = null;
const pollClaude = () => (pollP ??= pollClaudeOnce().finally(() => (pollP = null)));
async function pollClaudeOnce() {
  const rel = S.rel;
  try {
    const r = await api(`/api/claude?video=${enc(rel ?? "")}`);
    if (rel !== S.rel) return;
    const before = new Map(S.reqs.map((q) => [q.id, q.status]));
    S.alive = r.alive; S.reqs = S.rel ? r.requests.filter((q) => q.kind === "image") : [];
    for (const q of S.reqs) {
      if (q.status === "done" && before.has(q.id) && before.get(q.id) !== "done") {
        await loadList();
        const nv = canon(q.resultVideo);
        const next = nv && nv !== S.rel && S.images.some((x) => x.rel === nv) ? nv : "";
        toast("Claude の対応が終わりました", { kind: "claude", timeout: 12000, action: next ? { label: "新しい版を開く", icon: "right", fn: () => openImage(next) } : undefined });
        if (S.rel) { try { S.versions = await api(`/api/image/versions?image=${enc(S.rel)}`); renderVers(); } catch {} }
      }
    }
    const live = S.reqs.find((q) => q.status !== "done");
    bar.setClaude({ alive: S.alive, busy: !!live, text: live ? LIVE[live.status] : "" });
    const strip = $("#liveStrip"), last = live?.progress?.[live.progress.length - 1];
    const sig = live ? [live.id, live.status, live.progress?.length].join("|") : "";
    if (sig !== lastStrip) {
      lastStrip = sig; strip.hidden = !live;
      if (live) strip.innerHTML = `${stepper(live)}<span class="grow ellipsis dim">${last ? esc(last.text) : esc(LIVE[live.status])}</span><span class="faint">${ago(live.updated ?? live.created)}</span>`;
    }
    // 終わった依頼（まとめと、新しい版へのリンク）を新しい順に3つまで
    const done = S.reqs.filter((q) => q.status === "done").slice(0, 3);
    const rsig = [S.rel, ...done.map((q) => q.id)].join("|");
    if (rsig !== lastReqSig) {
      lastReqSig = rsig;
      const box = $("#reqs"); box.hidden = !done.length;
      box.innerHTML = done.map((q) => `<div class="req"><div class="row">${avatar("", true)}<span class="faint grow">${ago(q.updated ?? q.created)}・メモ${q.notes.length}件</span>
        ${q.resultVideo && canon(q.resultVideo) !== S.rel ? `<button class="btn sm primary" data-open="${esc(canon(q.resultVideo))}">${icon("right", "s")}新しい版</button>` : ""}</div>
        ${q.result ? `<div class="result">${esc(q.result)}</div>` : ""}</div>`).join("");
      $$("[data-open]", box).forEach((b) => (b.onclick = () => openImage(b.dataset.open)));
    }
    renderSend();
  } catch { bar.setClaude({ alive: false }); }
}
$("#claudePill").onclick = (e) => claudeInfo(e.currentTarget, S.alive);
// Claude が返事を付けたら読み直す（書いている途中は待つ）
setInterval(async () => {
  if (document.hidden) return;
  pollClaude();
  if (!S.rel || S.editing || drag || anyModal()) return;
  const rel = S.rel;
  try {
    const j = await api(`/api/image/notes?image=${enc(rel)}`);
    if (rel === S.rel && !S.editing && !drag && j.mtime !== S.mtime) { S.notes = j.notes; S.mtime = j.mtime; renderMarks(); renderList(); renderSend(); }
  } catch {}
}, 3000);
setInterval(() => { if (!document.hidden) loadList(); }, 20000);

/* ================= キーと使い方 ================= */
function help() {
  openHelp({
    title: "画像レビューの使い方",
    intro: steps3([["hand", "なぞる・押す", "直したい所をなぞると範囲、押すと点"], ["note", "書く", "そのままひとこと。Enter で保存"], ["send", "送る", "Claude が直して新しい版を返す"]]),
    keys: [["/", "画像を選ぶ"], ["N / P", "次・前のメモへ"], ["C", "押している間、前の版を表示"], ["H", "印を隠す・出す"], ["1 / 2 / 0", "全体・2倍・原寸"], ["Ctrl+Enter", "Claude に送る"], ["Esc", "書くのをやめる"], ["?", "使い方"]],
    extra: `<p class="help-text" style="margin-top:14px">印の色：オレンジ＝まだ送っていない／茶＝送信済み／緑＝対応済み。印をもう一度押すと書き直せます。<br>同じ名前で版番号（<code>名前_v2.jpg</code>）を付けて書き出すと、上の版ボタンと「前の版」で見比べられます。</p>`,
  });
}
$("#helpBtn").onclick = help;
$("#settingsBtn").onclick = () => openSettings({ onChange: () => render() });
addEventListener("keydown", (e) => {
  if (anyModal() || ["TEXTAREA", "INPUT", "SELECT"].includes(document.activeElement?.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === "/") { e.preventDefault(); openPicker(); }
  else if (k === "?") help();
  else if (k === "h") marks.classList.toggle("hide");
  else if (k === "c" && !e.repeat) compare(true);
  else if (k === "1") setZoom(1); else if (k === "2") setZoom(2); else if (k === "0") setZoom(0);
  else if (k === "n" || k === "p") {
    const list = sorted().filter((n) => S.filter === "all" || (S.filter === "done") === !!n.done); if (!list.length) return;
    const i = list.findIndex((n) => n.id === S.sel);
    select(list[(i + (k === "n" ? 1 : -1) + list.length) % list.length].id, { scrollMark: true, scrollList: true });
  } else if (k === "escape") { S.sel = null; renderMarks(); renderList(); }
});
addEventListener("keyup", (e) => { if (e.key.toLowerCase() === "c") compare(false); });
addEventListener("blur", () => compare(false));

/* ================= はじめに ================= */
(async () => {
  await loadList();
  const asked = new URLSearchParams(location.search).get("i");
  const want = canon(asked || store.get("imgLast"));
  const first = S.images.find((x) => x.rel === want) ?? (asked ? { rel: asked } : S.images[0]);
  if (first) await openImage(first.rel);
  else {
    canvas.hidden = true;
    const em = $("#stageEmpty"); em.hidden = false;
    em.innerHTML = `<div class="art">${icon("image")}</div><h3>まだ画像がありません</h3><p>案件の <code>out</code> フォルダに画像（png・jpg・webp）を書き出すと、ここに出ます。</p>`;
    render(); pollClaude();
  }
  welcome();
})();
