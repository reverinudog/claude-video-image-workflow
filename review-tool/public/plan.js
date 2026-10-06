// 構成メモ画面：plan.json の items（{id, text, kind?:"head", comments, base}）を1行ずつ並べて添削する
import {
  $, $$, esc, uid, ago, fullDate, sleep, touch, icon, iconBtn, store, prefs, api, conn, toast, modal, footer, anyModal, menu, avatar,
  workspace, mountTopbar, mountPicker, listPicker, visiblePicker, stepper, LIVE, setTitle, claudeInfo, openSettings, openHelp, steps3, welcome,
} from "./common.js";

const bar = mountTopbar("plan");
const enc = encodeURIComponent;
const S = {
  plans: [], rel: null, plan: null, mtime: 0, dirty: false, saving: false, undo: [], redo: [],
  openCmt: null, freshCmt: null, showDiff: store.get("planDiff", false), reqs: [], alive: false, focusId: null,
};
let saveTimer = null;

/* ================= 一覧と選ぶ ================= */
async function loadList() {
  try { S.plans = await api("/api/plans"); } catch { return; }
  renderPicker();
}
function renderPicker() {
  const p = S.plans.find((x) => x.rel === S.rel);
  mountPicker({
    ic: "doc", tip: "構成メモを選ぶ（/）", onOpen: openPicker,
    title: p ? p.title : S.plans.length ? "構成メモを選ぶ" : "構成メモがありません",
    sub: p ? `${p.project} · ${ago(p.mtime)}` : "",
    badge: p?.unsent ? `<span class="badge accent" title="まだ送っていないコメント">${icon("msg", "s")}${p.unsent}</span>` : "",
  });
}
function openPicker(anchor = visiblePicker()) {
  listPicker(anchor, {
    items: () => S.plans, group: (x) => x.project, match: (x, q) => `${x.title} ${x.rel}`.toLowerCase().includes(q), selected: (x) => x.rel === S.rel,
    placeholder: "構成メモを探す", empty: S.plans.length ? "見つかりません" : "まだ構成メモはありません", width: 540,
    foot: `<span class="num">${S.plans.length}件</span><span class="grow"></span><button class="btn primary sm" data-new>${icon("plus", "s")}新しく作る</button>`,
    onPick: (x) => openPlan(x.rel),
    onFoot: (box, pop) => { box.querySelector("[data-new]").onclick = () => { pop.close(); newPlan(); }; },
    row: (x) => `${icon("doc", "s")}<span class="grow"><span class="name ellipsis block">${esc(x.title)}</span><span class="meta ellipsis block">${esc(x.name)} · ${x.items}行 · ${ago(x.mtime)}</span></span>
      ${x.unsent ? `<span class="badge accent" title="まだ送っていないコメント">${icon("msg", "s")}${x.unsent}</span>` : ""}${x.replies ? `<span class="badge claude" title="Claudeの返事">${icon("spark", "s")}${x.replies}</span>` : ""}`,
  });
}
async function newPlan() {
  let projects = [];
  try { projects = await api("/api/projects"); } catch (e) { return toast(e.message, { kind: "err" }); }
  const cur = S.plans.find((x) => x.rel === S.rel)?.project;
  const NEW = "__new__";
  const body = document.createElement("div");
  body.innerHTML = `<div class="stack" style="gap:14px">
    <div class="field"><label for="npTitle">題名</label><input class="input" id="npTitle" placeholder="例：新作トレーラーの流れ" maxlength="80" ${projects.length ? "autofocus" : ""} /></div>
    <div class="field"><label for="npProj">${icon("folder", "s")} 案件のフォルダ</label><select class="select" id="npProj">${projects.map((p) => `<option ${p.rel === cur ? "selected" : ""}>${esc(p.rel)}</option>`).join("")}<option value="${NEW}" ${projects.length ? "" : "selected"}>＋ 新しいフォルダ…</option></select>
      <input class="input" id="npProjNew" placeholder="例：${new Date().toISOString().slice(2, 10).replace(/-/g, "")}_新作トレーラー" maxlength="60" ${projects.length ? "hidden" : "autofocus"} /></div>
    <div class="field"><label for="npName">${icon("doc", "s")} ファイル名</label><input class="input" id="npName" placeholder="plan_v1" maxlength="60" /><div class="help-text">「名前_v1」のように版番号を付けると、直した版と見比べやすくなります</div></div></div>`;
  const foot = footer(`<button class="btn" data-close>やめる</button><button class="btn primary" id="npGo">${icon("plus", "s")}作る</button>`);
  const m = modal({ title: "新しい構成メモ", body, foot });
  const sel = body.querySelector("#npProj"), pnew = body.querySelector("#npProjNew");
  sel.onchange = () => { pnew.hidden = sel.value !== NEW; if (!pnew.hidden) pnew.focus(); };
  const go = async () => {
    const title = body.querySelector("#npTitle").value.trim();
    const name = body.querySelector("#npName").value.trim() || "plan_v1";
    const createProject = sel.value === NEW;
    if (createProject && !pnew.value.trim()) { pnew.focus(); pnew.classList.remove("shake"); void pnew.offsetWidth; pnew.classList.add("shake"); return; }
    try {
      const r = await api("/api/plan/new", { project: createProject ? pnew.value.trim() : sel.value, name, title, createProject });
      m.close(); await loadList(); await openPlan(r.rel);
      $(".it:not(.head) textarea")?.focus();
    } catch (e) { toast(e.message, { kind: "err" }); }
  };
  foot.querySelector("#npGo").onclick = go;
  body.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing && e.target.tagName === "INPUT") { e.preventDefault(); go(); } });
}

/* ================= 開く ================= */
function norm(p) {
  p.items ??= [];
  for (const it of p.items) { it.comments ??= []; if (it.base === undefined) it.base = it.text; }
  p.origOrder ??= p.items.map((i) => i.id);
  computeEdited(p);
  return p;
}
async function openPlan(rel) {
  if (S.dirty) { clearTimeout(saveTimer); await doSave(); }
  let r;
  try { r = await api(`/api/plan?path=${enc(rel)}`); } catch (e) { toast(e.message, { kind: "err" }); return; }
  S.rel = rel; store.set("planPath", rel);
  history.replaceState(null, "", `?plan=${enc(rel)}`);
  S.plan = norm(r.plan); S.mtime = r.mtime; S.undo = []; S.redo = []; S.openCmt = null; S.dirty = false;
  setTitle(S.plan.title);
  renderPicker(); render(true); pollClaude();
  bar.setSave(null);
}
function noPlans() {
  setTitle("");
  $("#doc").innerHTML = `<div class="empty" style="padding-top:70px"><div class="art">${icon("doc")}</div><h3>まだ構成メモがありません</h3>
    <p>動画を作る前に、流れを1行ずつ並べて添削するページです</p>
    <button class="btn primary" id="firstNew" style="margin-top:6px">${icon("plus", "s")}新しく作る</button></div>`;
  $("#firstNew").onclick = newPlan;
  $("#sendbar").hidden = true;
}

/* ================= 保存・取り消し ================= */
const KEYS = ["items", "title", "intro", "removed", "baseTitle", "baseIntro"];
const snap = () => JSON.stringify(Object.fromEntries(KEYS.map((k) => [k, S.plan[k]])));
function checkpoint() { S.undo.push(snap()); if (S.undo.length > 200) S.undo.shift(); S.redo = []; }
function restore(s) { const o = JSON.parse(s); for (const k of KEYS) S.plan[k] = o[k]; }
function doUndo() { if (!S.undo.length) return; S.redo.push(snap()); restore(S.undo.pop()); render(); save(); }
function doRedo() { if (!S.redo.length) return; S.undo.push(snap()); restore(S.redo.pop()); render(); save(); }
// 中身の指紋（server.mjs の planSig と同じ作り）。送った時点の指紋と同じなら「もう送った変更」
const planSig = (p) => JSON.stringify([p.title ?? "", p.intro ?? "", (p.items ?? []).map((i) => [i.id, i.kind ?? "", i.text ?? ""]), p.removed ?? []]);
const unsentEdits = () => S.plan.edited && planSig(S.plan) !== S.plan.sentSig;
function computeEdited(p = S.plan) {
  for (const it of p.items) it.edited = it.base === null || it.text !== it.base;
  p.edited = changeCount(p) > 0;
}
/** 変えたところの数：書き換え・足した行・消した行・並べ替え・題名・ねらい */
function changeCount(p = S.plan) {
  const moved = p.items.map((i) => i.id).filter((id) => p.origOrder.includes(id)).join() !== p.origOrder.filter((id) => p.items.some((i) => i.id === id)).join();
  return p.items.filter((i) => i.base === null || i.text !== i.base).length + (p.removed?.length ?? 0) + (moved ? 1 : 0)
    + (p.baseTitle !== undefined && (p.title ?? "") !== p.baseTitle ? 1 : 0) + (p.baseIntro !== undefined && (p.intro ?? "") !== p.baseIntro ? 1 : 0);
}
function save() {
  computeEdited();
  S.dirty = true; bar.setSave("busy");
  clearTimeout(saveTimer); saveTimer = setTimeout(doSave, 600);
  renderSend(); renderTools();
}
async function doSave(force, keepalive) {
  if (!S.dirty && !force) return;
  if (S.saving) { saveTimer = setTimeout(() => doSave(force), 300); return; }
  S.saving = true;
  try {
    const r = await api(`/api/plan?path=${enc(S.rel)}`, { plan: S.plan, baseMtime: S.mtime, force: !!force }, { keepalive });
    S.mtime = r.mtime; S.dirty = false; bar.setSave("ok");
    loadList();
  } catch (e) {
    if (e.status === 409) conflict(e.data);
    else if (e.offline) bar.setSave("err", "未保存（つながりしだい保存します）");
    else { bar.setSave("err", "保存できません"); toast(e.message, { kind: "err" }); }
  }
  S.saving = false;
}
conn.on((ok) => { if (ok && S.dirty) doSave(); });
function conflict(data) {
  bar.setSave("err", "未保存（先に更新されていました）");
  const foot = footer(`<button class="btn" data-mine>自分の変更で上書き</button><button class="btn primary" data-theirs>${icon("refresh", "s")}最新を読み込む</button>`);
  const m = modal({ title: "先に更新されていました", body: `<p style="margin:0;line-height:1.8;color:var(--text-2)">開いている間に Claude（または別の端末）が書き換えました。<br>最新を読み込むと、まだ保存していない変更は消えます。</p>`, foot });
  foot.querySelector("[data-theirs]").onclick = () => { m.close(); S.plan = norm(data.plan); S.mtime = data.mtime; S.dirty = false; S.undo = []; S.redo = []; render(); bar.setSave("ok", "最新を読み込みました"); };
  foot.querySelector("[data-mine]").onclick = () => { m.close(); S.dirty = true; doSave(true); };
}
// 閉じるときに保存待ちがあれば、ページが閉じても届く送り方（keepalive）で送る
addEventListener("beforeunload", (e) => { if (S.dirty) { clearTimeout(saveTimer); doSave(false, true); e.preventDefault(); e.returnValue = ""; } });

/* ================= 描画 ================= */
const itemOf = (el) => { const id = el.closest("[data-id]")?.dataset.id; return S.plan.items.find((i) => i.id === id); };
const newId = () => uid("i");
const rowName = (it, no) => (it.kind === "head" ? "見出し" : `${no}行目`);
function commentHtml(c) {
  const claude = c.by === "claude";
  const who = claude ? "Claude" : c.author || prefs.get().name || "あなた";
  const mine = !claude && !c.sentAt && !c.done;
  return `<div class="cmt ${claude ? "claude" : ""} ${c.done ? "done" : ""} ${c.id === S.freshCmt ? "new" : ""}">${avatar(who, claude)}
    <div class="bubble"><div class="who"><b>${esc(who)}</b>${c.at ? `<span title="${esc(fullDate(c.at))}">${ago(c.at)}</span>` : ""}<span class="grow"></span>
      ${c.done ? `<span class="st-ic done" title="対応済み">${icon("check")}</span>` : c.sentAt ? `<span class="st-ic sent" title="送信済み">${icon("send")}</span>` : ""}
      ${mine ? iconBtn("x", "このコメントを消す", `data-act="delc" data-c="${esc(c.id)}" style="width:24px;height:24px"`, "ghost sm") : ""}</div>${esc(c.text)}
      ${c.reply ? `<div class="reply">${avatar("", true)}<div>${esc(c.reply)}</div></div>` : ""}</div></div>`;
}
const dotHtml = (it, fresh) => (it.base === null ? `<span class="chg added ${fresh ? "new" : ""}" title="足した行"></span>`
  : it.text !== it.base ? `<button class="chg edited ${fresh ? "new" : ""}" data-act="rev" title="変えた行：押すと元に戻す\n元：${esc(it.base)}" aria-label="元の文に戻す"></button>` : `<span class="chg"></span>`);
function render(first) {
  if (!S.plan) return;
  const p = S.plan;
  // 動く前の位置を覚えておき、描き直したあと滑らかに動かす（並べ替え・足す・消す）
  const before = first ? new Map() : new Map($$("#items .it").map((el) => [el.dataset.id, el.getBoundingClientRect().top]));
  let n = 0;
  const rows = p.items.map((it) => {
    const head = it.kind === "head", no = head ? "" : ++n, cc = it.comments.length;
    const diff = S.showDiff && it.base && it.text !== it.base ? `<div class="base-diff">${esc(it.base)}</div>` : "";
    const thread = cc || S.openCmt === it.id ? `<div class="thread" data-id="${esc(it.id)}">${it.comments.map(commentHtml).join("")}
      ${S.openCmt === it.id ? `<div class="cmt-in">${avatar(prefs.get().name || "あなた")}<textarea class="textarea" rows="1" data-cmt placeholder="コメント" aria-label="${rowName(it, no)}へのコメント"></textarea>${iconBtn("send", "コメントを足す（Enter）", 'data-act="addc"', "primary")}</div>` : ""}</div>` : "";
    return `<div class="it ${head ? "head" : ""} ${S.focusId === it.id ? "focus" : ""}" data-id="${esc(it.id)}">
      <span class="grip" title="ドラッグで並べ替え" aria-hidden="true">${icon("grip", "s")}</span>${dotHtml(it)}<span class="no num">${no}</span>
      <textarea rows="1" data-row aria-label="${rowName(it, no)}" placeholder="${head ? "見出し" : "ここに1行"}">${esc(it.text)}</textarea>
      <span class="it-acts ${cc ? "keep" : ""}">
        <button class="btn ghost ${cc ? "cc" : "icon"} sm" data-act="cmt" title="コメント" aria-label="${rowName(it, no)}にコメント${cc ? `（${cc}件）` : ""}">${icon("msg", "s")}${cc || ""}</button>
        ${iconBtn("more", `${rowName(it, no)}のそのほか`, 'data-act="more"', "ghost sm")}
      </span></div>${diff}${thread}`;
  }).join("");
  const removed = S.showDiff && p.removed?.length ? `<div class="removed"><span class="label">${icon("trash", "s")}消した行</span>${p.removed.map((t) => `<div>${esc(t)}</div>`).join("")}</div>` : "";
  $("#doc").innerHTML = `
    <div class="doc-meta">${icon("folder", "s")}<span>${esc(S.rel.split("/")[0])}</span><span>·</span><span>${esc(S.rel.split("/").pop())}</span>${p.updated ? `<span>·</span><span title="${esc(fullDate(p.updated))}">${ago(p.updated)}</span>` : ""}</div>
    <textarea class="doc-title" id="docTitle" rows="1" placeholder="題名" aria-label="題名">${esc(p.title ?? "")}</textarea>
    <textarea class="doc-intro" id="docIntro" rows="1" placeholder="ねらい・前提（任意）" aria-label="ねらい・前提">${esc(p.intro ?? "")}</textarea>
    <div class="doc-tools" id="docTools"></div>
    <div class="items" id="items">${rows}<div class="dropline" id="dropline"></div></div>
    <div class="adds"><button class="btn sm" data-act="addItem" title="最後に行を足す">${icon("plus", "s")}行</button><button class="btn sm" data-act="addHead" title="最後に見出しを足す">${icon("heading", "s")}見出し</button></div>
    ${removed}`;
  renderTools();
  growAll();
  if (before.size) for (const el of $$("#items .it")) {
    const top0 = before.get(el.dataset.id);
    if (top0 == null) el.animate([{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "ease-out" });
    else { const dy = top0 - el.getBoundingClientRect().top; if (Math.abs(dy) > 1) el.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" }); }
  }
  requestAnimationFrame(growAll);
  bind();
  renderSend();
  S.freshCmt = null;
}
function renderTools() {
  const el = $("#docTools"); if (!el || !S.plan) return;
  const p = S.plan;
  const lines = p.items.filter((i) => i.kind !== "head").length;
  const cm = p.items.reduce((a, i) => a + i.comments.length, 0);
  const changed = changeCount();
  el.innerHTML = `<span class="badge" title="行の数">${icon("list", "s")}${lines}</span>${cm ? `<span class="badge" title="コメント">${icon("msg", "s")}${cm}</span>` : ""}${changed ? `<span class="badge warn" title="変えたところ">${icon("edit", "s")}${changed}</span>` : ""}
    <span class="grow"></span>
    ${iconBtn("diff", S.showDiff ? "変更の表示をやめる" : "変更を表示（元の文と消した行）", `data-act="diff" aria-pressed="${S.showDiff}"`, `ghost sm ${S.showDiff ? "on" : ""}`)}
    ${iconBtn("undo", "元に戻す（Ctrl+Z）", `data-act="undo" ${S.undo.length ? "" : "disabled"}`, "ghost sm")}
    ${iconBtn("redo", "やり直す（Ctrl+Shift+Z）", `data-act="redo" ${S.redo.length ? "" : "disabled"}`, "ghost sm")}`;
}
const grow = (t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; };
const growAll = () => $$("#doc textarea").forEach(grow);
let lastW = 0;
new ResizeObserver(() => { const w = $("#doc").clientWidth; if (w !== lastW) { lastW = w; growAll(); } }).observe(document.body);
document.fonts?.ready.then(growAll);
// 描き直した直後にすぐ移す（遅らせると、続けて打った文字が消えた古い欄に入ってしまう）
const focusItem = (id, atEnd = true) => { const t = $(`.it[data-id="${id}"] textarea`); if (t) { t.focus(); const q = atEnd ? t.value.length : 0; t.setSelectionRange(q, q); } };

function bind() {
  const title = $("#docTitle"), intro = $("#docIntro");
  for (const [el, key, baseKey] of [[title, "title", "baseTitle"], [intro, "intro", "baseIntro"]]) {
    let snapped = false;
    el.addEventListener("focus", () => (snapped = false));
    el.addEventListener("input", () => {
      if (!snapped) { checkpoint(); snapped = true; }
      if (S.plan[baseKey] === undefined) S.plan[baseKey] = S.plan[key] ?? "";
      S.plan[key] = key === "title" ? el.value.replace(/\n/g, "") : el.value;
      grow(el); save();
      if (key === "title") setTitle(el.value);
    });
    el.addEventListener("keydown", (e) => { if (key === "title" && e.key === "Enter" && !e.isComposing) { e.preventDefault(); intro.focus(); } });
  }
  $$("[data-row]").forEach((t) => {
    let snapped = false;
    t.addEventListener("focus", () => { snapped = false; S.focusId = itemOf(t).id; $$(".it.focus").forEach((x) => x.classList.remove("focus")); t.closest(".it").classList.add("focus"); });
    t.addEventListener("blur", () => { t.closest(".it")?.classList.remove("focus"); S.focusId = null; });
    t.addEventListener("input", () => { if (!snapped) { checkpoint(); snapped = true; } const it = itemOf(t); it.text = t.value.replace(/\n/g, ""); grow(t); save(); refreshDot(t, it); });
    t.addEventListener("keydown", (e) => onKey(e, t));
  });
  $$("[data-cmt]").forEach((t) => {
    t.focus();
    t.addEventListener("input", () => grow(t));
    t.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !touch) { e.preventDefault(); addComment(t); }
      if (e.key === "Escape") { S.openCmt = null; render(); }
    });
  });
  $$(".grip").forEach((g) => g.addEventListener("pointerdown", startDrag));
}
function refreshDot(t, it) {
  const d = t.closest(".it").querySelector(".chg");
  if (it.base === null) return;
  const want = it.text !== it.base;
  if (want !== d.classList.contains("edited")) d.outerHTML = dotHtml(it, want);
}
function onKey(e, t) {
  const it = itemOf(t), i = S.plan.items.indexOf(it);
  if (e.isComposing) return;
  if (e.key === "Enter") {
    e.preventDefault(); checkpoint();
    const pos = t.selectionStart, rest = it.text.slice(pos); it.text = it.text.slice(0, pos);
    const nb = { id: newId(), text: rest, comments: [], base: null };
    S.plan.items.splice(i + 1, 0, nb); render(); save(); focusItem(nb.id, false);
  } else if (e.key === "Backspace" && it.text === "" && i > 0 && t.selectionStart === 0) {
    e.preventDefault(); const prev = S.plan.items[i - 1].id; removeItem(it, false); focusItem(prev);
  } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault(); moveItem(it, e.key === "ArrowUp" ? -1 : 1); focusItem(it.id);
  } else if (e.key === "ArrowUp" && t.selectionStart === 0 && i > 0) { e.preventDefault(); focusItem(S.plan.items[i - 1].id); }
  else if (e.key === "ArrowDown" && t.selectionEnd === t.value.length && i < S.plan.items.length - 1) { e.preventDefault(); focusItem(S.plan.items[i + 1].id, false); }
}
function moveItem(it, d) {
  const i = S.plan.items.indexOf(it), j = i + d;
  if (j < 0 || j >= S.plan.items.length) return;
  checkpoint(); S.plan.items.splice(i, 1); S.plan.items.splice(j, 0, it); render(); save();
}
function insertAfter(i, extra = {}) {
  checkpoint();
  const nb = { id: newId(), text: "", comments: [], base: null, ...extra };
  S.plan.items.splice(i + 1, 0, nb); render(); save(); focusItem(nb.id);
}
function removeItem(it, notify = true) {
  checkpoint();
  S.plan.items.splice(S.plan.items.indexOf(it), 1);
  if (it.base) (S.plan.removed ??= []).push(it.base);
  render(); save();
  if (notify) toast("行を消しました", { action: { label: "元に戻す", icon: "undo", fn: doUndo } });
}

/* ================= ドラッグ（マウスも指も同じ） ================= */
function startDrag(e) {
  e.preventDefault();
  const grip = e.currentTarget, row = grip.closest(".it"), id = row.dataset.id;
  const rows = $$(".it");
  let to = null;
  row.classList.add("dragging");
  grip.setPointerCapture(e.pointerId);
  const move = (ev) => {
    const y = ev.clientY; to = rows.length;
    for (let k = 0; k < rows.length; k++) { const r = rows[k].getBoundingClientRect(); if (y < r.top + r.height / 2) { to = k; break; } }
    const line = $("#dropline"), top = $("#items").getBoundingClientRect().top;
    const ref = rows[to] ? rows[to].getBoundingClientRect().top : rows[rows.length - 1].getBoundingClientRect().bottom;
    line.style.display = "block"; line.style.top = ref - top - 2 + "px";
    if (y < 80) scrollBy(0, -14); else if (y > innerHeight - 170) scrollBy(0, 14);
  };
  const up = () => {
    grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up);
    $("#dropline").style.display = "none"; row.classList.remove("dragging");
    const from = S.plan.items.findIndex((x) => x.id === id);
    if (to == null || to === from || to === from + 1) return;
    checkpoint(); const [it] = S.plan.items.splice(from, 1); S.plan.items.splice(to > from ? to - 1 : to, 0, it); render(); save();
  };
  grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
}

/* ================= クリック ================= */
$("#doc").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const act = b.dataset.act;
  if (act === "diff") { S.showDiff = !S.showDiff; store.set("planDiff", S.showDiff); return render(); }
  if (act === "undo") return doUndo();
  if (act === "redo") return doRedo();
  if (act === "addItem" || act === "addHead") return insertAfter(S.plan.items.length - 1, act === "addHead" ? { kind: "head" } : {});
  const it = itemOf(b); if (!it) return;
  if (act === "cmt") { S.openCmt = S.openCmt === it.id ? null : it.id; return render(); }
  if (act === "addc") return addComment($("[data-cmt]", b.closest(".thread")));
  if (act === "rev") { checkpoint(); it.text = it.base; render(); return save(); }
  if (act === "delc") { checkpoint(); it.comments = it.comments.filter((c) => c.id !== b.dataset.c); render(); return save(); }
  if (act === "more") {
    const i = S.plan.items.indexOf(it);
    return menu(b, [
      { label: "コメントを書く", icon: "msg", fn: () => { S.openCmt = it.id; render(); } },
      { label: it.kind === "head" ? "ふつうの行にする" : "見出しにする", icon: "heading", fn: () => { checkpoint(); if (it.kind === "head") delete it.kind; else it.kind = "head"; render(); save(); } },
      { label: "下に行を足す", icon: "plus", fn: () => insertAfter(i) },
      { label: "上へ", icon: "up", hint: "Alt+↑", fn: () => moveItem(it, -1) },
      { label: "下へ", icon: "down", hint: "Alt+↓", fn: () => moveItem(it, 1) },
      ...(it.base && it.text !== it.base ? [{ label: "元の文に戻す", icon: "undo", fn: () => { checkpoint(); it.text = it.base; render(); save(); } }] : []),
      "-",
      { label: "この行を消す", icon: "trash", danger: true, fn: () => removeItem(it) },
    ]);
  }
});
function addComment(t) {
  const text = t?.value.trim();
  if (!text) { t?.focus(); return; }
  const it = itemOf(t); checkpoint();
  const c = { id: uid("c"), by: "user", author: prefs.get().name || "", text, at: new Date().toISOString() };
  it.comments.push(c);
  S.openCmt = null; S.freshCmt = c.id; render(); save();
}

/* ================= 送る ================= */
let lastSendSig = null;
function renderSend() {
  const el = $("#sendbar");
  if (!S.plan) { el.hidden = true; return; }
  el.hidden = false;
  const unsent = S.plan.items.reduce((a, i) => a + i.comments.filter((c) => !c.sentAt && !c.done && c.by !== "claude").length, 0);
  const edits = unsentEdits() ? changeCount() : 0;
  const msgNow = $("#sendMsg")?.value ?? store.get("planMsg:" + S.rel, "");
  const can = !!(unsent || edits || msgNow.trim());
  const chips = `${unsent ? `<span class="badge accent" title="送るコメント">${icon("msg", "s")}${unsent}</span>` : ""}${edits ? `<span class="badge warn" title="送る書き換え・並べ替え">${icon("edit", "s")}${edits}</span>` : ""}`;
  const sig = [S.rel, chips, can].join("#");
  if (document.activeElement?.id === "sendMsg" || sig === lastSendSig) { // 入力中・変化なしは作り直さない
    const b = $("#sendBtn"); if (b) b.disabled = !can;
    const c = $("#sendChips"); if (c && c.innerHTML !== chips) c.innerHTML = chips;
    return;
  }
  lastSendSig = sig;
  el.innerHTML = `<div class="in">
      <textarea class="textarea" id="sendMsg" rows="1" placeholder="全体へのひとこと（任意）" aria-label="全体へのひとこと">${esc(msgNow)}</textarea>
      <span class="chips" id="sendChips">${chips}</span>
      <button class="btn claude send" id="sendBtn" title="Claude に送る（Ctrl+Enter）" ${can ? "" : "disabled"}>${icon("send")}送る</button></div>`;
  const ta = $("#sendMsg");
  grow(ta);
  ta.addEventListener("input", () => { grow(ta); store.set("planMsg:" + S.rel, ta.value); renderSend(); });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
  $("#sendBtn").onclick = send;
}
async function send() {
  const btn = $("#sendBtn"); if (!btn || btn.disabled) return;
  btn.disabled = true;
  clearTimeout(saveTimer); if (S.dirty) await doSave();
  if (S.dirty) { btn.disabled = false; return toast("保存できないので送れません", { kind: "err" }); }
  try {
    const r = await api("/api/plan/send", { path: S.rel, message: $("#sendMsg").value, author: prefs.get().name });
    btn.classList.add("fly"); await sleep(380);
    $("#sendMsg").value = ""; store.del("planMsg:" + S.rel); document.activeElement?.blur();
    const g = await api(`/api/plan?path=${enc(S.rel)}`); S.plan = norm(g.plan); S.mtime = g.mtime;
    lastSendSig = null; render(); pollClaude(); loadList();
    toast(r.alive ? "Claude に届きました" : "受付箱に入れました。Claude が来たら拾います", { kind: "claude" });
  } catch (e) { toast(e.message, { kind: "err" }); btn.disabled = false; }
}

/* ================= Claude ================= */
let lastStrip = null, pollP = null;
// 同時に2回走ると「終わりました」が二重に出るので、走っている間は同じものを待つ
const pollClaude = () => (pollP ??= pollClaudeOnce().finally(() => (pollP = null)));
async function pollClaudeOnce() {
  try {
    const r = await api(`/api/claude?video=${enc(S.rel ?? "")}`);
    const before = new Map(S.reqs.map((q) => [q.id, q.status]));
    S.alive = r.alive; S.reqs = r.requests;
    for (const q of S.reqs) if (q.status === "done" && before.has(q.id) && before.get(q.id) !== "done") toast("Claude の対応が終わりました", { kind: "claude", timeout: 8000 });
    const live = S.reqs.find((q) => q.status !== "done");
    bar.setClaude({ alive: S.alive, busy: !!live, text: live ? LIVE[live.status] : "" });
    const strip = $("#liveStrip"), last = live?.progress?.[live.progress.length - 1];
    const sig = live ? [live.id, live.status, live.progress?.length].join("|") : "";
    if (sig !== lastStrip) { // 変わったときだけ描き直す
      lastStrip = sig;
      strip.hidden = !live;
      if (live) strip.innerHTML = `${stepper(live)}<span class="grow ellipsis dim">${last ? esc(last.text) : esc(LIVE[live.status])}</span><span class="faint">${ago(live.updated ?? live.created)}</span>`;
    }
    renderSend();
  } catch { bar.setClaude({ alive: false }); }
}
$("#claudePill").onclick = (e) => claudeInfo(e.currentTarget, S.alive);
// Claudeが書き換えたら読み直す（入力中・保存待ちは待つ）
setInterval(async () => {
  if (document.hidden) return;
  pollClaude();
  if (!S.rel || S.dirty || S.saving || anyModal() || ["TEXTAREA", "INPUT"].includes(document.activeElement?.tagName)) return;
  try {
    const j = await api(`/api/plan?path=${enc(S.rel)}`);
    if (Math.abs(j.mtime - S.mtime) > 1) {
      const replies = (items) => items.flatMap((i) => i.comments ?? []).filter((c) => c.reply).length;
      const fresh = replies(j.plan.items ?? []) - replies(S.plan.items);
      S.plan = norm(j.plan); S.mtime = j.mtime; S.undo = []; S.redo = []; render();
      toast(fresh > 0 ? `Claude から返事が ${fresh} 件` : "Claude が構成メモを更新しました", { kind: "claude" });
    }
  } catch {}
}, 4000);

/* ================= キーボード ================= */
addEventListener("keydown", (e) => {
  if (anyModal() || e.target.closest?.(".pop")) return;
  const inText = ["TEXTAREA", "INPUT", "SELECT"].includes(e.target.tagName);
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (mod && k === "z" && !inText) { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
  if (mod && k === "y" && !inText) { e.preventDefault(); doRedo(); return; }
  if (mod && k === "s") { e.preventDefault(); clearTimeout(saveTimer); doSave(); return; }
  if (inText || mod || e.altKey) return;
  if (e.key === "/") { e.preventDefault(); openPicker(); }
  else if (e.key === "?") { e.preventDefault(); help(); }
});
function help() {
  openHelp({
    title: "構成メモの使い方",
    intro: steps3([["edit", "直す", "そのまま書き換え・並べ替え"], ["msg", "コメント", "行ごとに気になることを"], ["send", "送る", "まとめて Claude へ"]]),
    keys: [["Enter", "下に1行（行の途中なら分ける）"], ["Backspace", "空の行を消す"], ["Alt+↑ / Alt+↓", "行を上・下へ"], ["↑ / ↓", "前・次の行へ"], ["Ctrl+Z / Ctrl+Shift+Z", "元に戻す・やり直す（行の外で）"], ["Ctrl+S", "すぐ保存"], ["Ctrl+Enter", "（ひとこと入力中）送る"], ["/", "構成メモを選ぶ"], ["?", "この使い方"]],
    extra: `<div class="section-title">印</div><div class="legend">
      <span class="chg edited" style="margin:0 7px"></span><span>変えた行（点を押すと元の文に戻る）</span>
      <span class="chg added" style="margin:0 7px"></span><span>足した行</span>
      <span class="st-ic">${icon("diff")}</span><span>変更を表示：元の文と消した行を取り消し線で見比べる</span>
      <span class="st-ic">${icon("grip")}</span><span>つかんで上下へ動かすと並べ替え（指でも）</span></div>`,
  });
}
$("#helpBtn").onclick = help;
$("#settingsBtn").onclick = () => openSettings({ onChange: () => render() });

/* ================= はじめ ================= */
(async function init() {
  await workspace.load();
  await loadList();
  if (!S.plans.length) { noPlans(); pollClaude(); welcome(); return; }
  const want = new URLSearchParams(location.search).get("plan") ?? store.get("planPath");
  await openPlan(S.plans.some((p) => p.rel === want) ? want : S.plans[0].rel);
  welcome();
})();
