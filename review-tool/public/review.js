// 動画レビュー画面
import {
  $, $$, esc, uid, clamp, fmt, ago, fullDate, sizeStr, sleep, touch, icon, iconBtn, fillIcons, store, prefs, api, fileUrl, conn, toast,
  anyModal, confirmBox, lightbox, menu, avatar, workspace, mountTopbar, mountPicker, listPicker, visiblePicker, swipeable, stepper, LIVE,
  setTitle, copyText, claudeInfo, openSettings, openHelp, steps3, welcome,
} from "./common.js";

const bar = mountTopbar("review");
fillIcons();
const v = $("#v"), player = $("#player"), tl = $("#tl");
const enc = encodeURIComponent;
const RATES = [0.5, 1, 1.5, 2];

const S = {
  videos: [], rel: null, video: null, knownVideos: null,
  notes: [], mtime: 0, pending: [], saving: false,
  filter: store.get("filter", "open"), q: "", tab: store.get("tab", "notes"),
  editing: null, draft: null, wasPlaying: false, flashId: null, activeId: null,
  reqs: [], alive: false,
  versions: [], prevRel: null, prevNotes: [],
};
const tags = () => workspace.settings.tags ?? [];
const tagColor = (name) => tags().find((t) => t.name === name)?.color ?? "#9aa3b8";
const dirOf = (rel) => rel.split("/").slice(0, -1).join("/");
const shotUrl = (n, rel = S.rel) => n._local || (n.shot ? fileUrl(dirOf(rel) + "/" + n.shot) : "");
const tall = () => v.videoHeight > v.videoWidth;
const sortNotes = (a) => a.sort((x, y) => x.t - y.t);
const noteOf = (el) => S.notes.find((x) => x.id === el?.closest("[data-id]")?.dataset.id);
const timeOf = (n) => fmt(n.t) + (n.t2 != null ? "〜" + fmt(n.t2) : "");
const tagBadge = (name) => (name ? `<span class="badge tag" style="--c:${esc(tagColor(name))}">${esc(name)}</span>` : "");
const restart = (el, cls = "on") => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

/* ================= 動画の一覧 ================= */
async function loadVideos() {
  try { S.videos = await api("/api/videos"); } catch { return; }
  S.knownVideos ??= new Set(S.videos.map((x) => x.rel));
  if (S.rel) S.video = S.videos.find((x) => x.rel === S.rel) ?? S.video;
  renderPicker();
}
function renderPicker() {
  const e = S.video;
  mountPicker({
    ic: "film", tip: "動画を選ぶ（/）", onOpen: openPicker,
    title: e ? e.name : S.videos.length ? "動画を選ぶ" : "動画がありません",
    sub: e ? `${e.project ?? ""}${e.mtime ? " · " + ago(e.mtime) : ""}` : "",
    badge: e?.open ? `<span class="badge accent" title="未対応のメモ">${icon("ring", "s")}${e.open}</span>` : "",
  });
}
function openPicker(anchor = visiblePicker()) {
  const seen = store.get("seen", {}), since = store.get("since", 0);
  listPicker(anchor, {
    items: () => S.videos, group: (x) => x.project, match: (x, q) => x.rel.toLowerCase().includes(q), selected: (x) => x.rel === S.rel,
    placeholder: "動画を探す", empty: S.videos.length ? "見つかりません" : "動画がまだありません",
    foot: `<span class="num">${S.videos.length}本</span><span class="grow"></span>${iconBtn("refresh", "探し直す", "data-reload", "ghost sm")}`,
    onReload: loadVideos, onPick: (x) => openVideo(x.rel),
    row: (x) => {
      const fresh = !seen[x.rel] && x.mtime > since && Date.now() - x.mtime < 3 * 86400000;
      const live = x.request && x.request.status !== "done" && x.request.video === x.rel;
      return `${icon("film", "s")}<span class="grow"><span class="name ellipsis block">${esc(x.name)}</span>
        <span class="meta ellipsis block">${esc(x.dir.split("/").slice(1).join("/") || x.dir)} · ${ago(x.mtime)} · ${sizeStr(x.size)}</span></span>
        ${fresh ? '<span class="dot accent" title="新しい動画"></span>' : ""}
        ${live ? `<span class="st-ic sent" title="Claude 対応中">${icon("spark")}</span>` : ""}
        ${x.total ? (x.open ? `<span class="badge" title="未対応のメモ">${icon("ring", "s")}${x.open}</span>` : `<span class="badge ok" title="メモはすべて対応済み">${icon("check", "s")}${x.total}</span>`) : ""}`;
    },
  });
}

/* ================= 動画を開く ================= */
async function openVideo(rel, { t } = {}) {
  if (S.draft && !(await confirmBox("書きかけのメモがあります。捨てて別の動画を開きますか？", { ok: "捨てて開く", danger: true }))) return;
  closeComposer();
  S.rel = rel; S.editing = null; S.activeId = null;
  S.video = S.videos.find((x) => x.rel === rel) ?? { rel, name: rel.split("/").pop(), project: rel.split("/")[0], dir: dirOf(rel), mtime: 0 };
  store.set("lastVideo", rel);
  const seen = store.get("seen", {}); seen[rel] = Date.now(); store.set("seen", seen);
  history.replaceState(null, "", "?v=" + enc(rel));
  setTitle(S.video.name);
  $("#playerEmpty").hidden = true; v.hidden = false; player.classList.remove("novideo");
  v.src = fileUrl(rel);
  if (!touch) hv.src = v.src;
  const pos = t ?? Number(store.get("pos:" + rel, 0));
  v.addEventListener("loadedmetadata", () => { if (pos && pos < v.duration - 0.5) v.currentTime = pos; renderList(); renderMarks(); renderPrev(); tl.setAttribute("aria-valuemax", String(Math.round(v.duration))); }, { once: true });
  const m = $("#sendMsg"); if (m) m.value = store.get("msg:" + rel, "");
  renderPicker(); renderTransport();
  S.notes = []; S.mtime = 0; renderList();
  await Promise.all([loadNotes(), loadVersions(), pollClaude()]);
  // Claude が直して作った版なら、直す前の版（依頼を送った版）と比べる
  const src = S.reqs.find((q) => q.resultVideo === rel)?.video;
  if (src && src !== S.prevRel && S.versions.some((x) => x.rel === src)) { S.prevRel = src; await loadPrev(); }
  renderAll();
}
function showNoVideo() {
  v.hidden = true; player.classList.add("novideo");
  const el = $("#playerEmpty");
  el.hidden = false;
  const vf = workspace.settings.videoFolders ?? ["out"];
  const where = vf.length ? `${vf.map((f) => `<b>${esc(f)}</b>`).join("・")} フォルダ` : "作業フォルダ";
  el.innerHTML = `<div class="art">${icon("film")}</div><h3>動画がまだありません</h3><p>${where}に動画を置くと、ここに出ます</p>${workspace.settings.root ? `<p class="faint">${icon("folder", "s")} ${esc(workspace.settings.root)}</p>` : ""}`;
}

/* ================= メモ：読み込み・保存 ================= */
async function loadNotes() {
  if (!S.rel) return;
  try {
    const r = await api(`/api/notes?video=${enc(S.rel)}`);
    S.notes = sortNotes(r.notes); S.mtime = r.mtime;
  } catch (e) { if (!e.offline) toast(e.message, { kind: "err" }); }
}
const applyLocal = (notes, body) => {
  notes = [...notes];
  if (body.op === "upsert") {
    const i = notes.findIndex((n) => n.id === body.note.id);
    const n = { ...body.note };
    if (i >= 0 && notes[i].reply && n.reply === undefined) n.reply = notes[i].reply;
    if (i >= 0) notes[i] = n; else notes.push(n);
  } else notes = notes.filter((n) => n.id !== body.id);
  return sortNotes(notes);
};
/** 画面にはすぐ反映し、サーバーへは順番に送る（つながらない間は溜めておく） */
function commit(body, extra = {}) {
  S.notes = applyLocal(S.notes, body);
  S.pending.push({ video: S.rel, body, ...extra });
  renderAll();
  flush();
}
async function flush() {
  if (S.saving) return;
  while (S.pending.length) {
    S.saving = true;
    bar.setSave("busy");
    const o = S.pending[0];
    try {
      if (o.upload) { // 画像を先に上げる
        const r = await api(`/api/shot?video=${enc(o.video)}`, o.upload);
        o.body.note.shot = r.path; delete o.upload;
      }
      const note = o.body.note ? { ...o.body.note } : null;
      if (note) delete note._local;
      const r = await api(`/api/notes/op?video=${enc(o.video)}`, note ? { ...o.body, note } : o.body);
      S.pending.shift();
      if (o.video === S.rel) {
        let ns = r.notes;
        for (const p of S.pending) if (p.video === S.rel) ns = applyLocal(ns, p.body);
        // 画像を上げ終わるまでは手元の画像を見せ続ける
        for (const n of ns) { const mine = S.notes.find((x) => x.id === n.id); if (mine?._local && !n.shot) n._local = mine._local; }
        S.notes = ns; S.mtime = r.mtime;
        renderAll();
      }
    } catch (e) {
      S.saving = false;
      if (e.offline) { bar.setSave("err", `未保存 ${S.pending.length}件（つながりしだい保存します）`); return; }
      S.pending.shift();
      toast(`保存できませんでした：${e.message}`, { kind: "err" });
    }
  }
  S.saving = false;
  bar.setSave("ok");
}
conn.on((ok) => ok && flush());
addEventListener("beforeunload", (e) => { if (S.pending.length || S.draft) { e.preventDefault(); e.returnValue = ""; } });

// Claudeの返信・別の端末の変更を取り込む
setInterval(async () => {
  if (!S.rel || S.pending.length || S.saving || S.editing || document.hidden) return;
  try {
    const r = await api(`/api/notes?video=${enc(S.rel)}`);
    if (r.mtime === S.mtime) return;
    const fresh = r.notes.filter((n) => n.reply && !S.notes.find((o) => o.id === n.id && o.reply === n.reply)).length;
    S.notes = sortNotes(r.notes); S.mtime = r.mtime;
    renderAll();
    if (fresh) toast(`Claude から返事が ${fresh} 件`, { kind: "claude" });
  } catch {}
}, 3000);

/* ================= 前の版 ================= */
async function loadVersions() {
  S.versions = []; S.prevNotes = [];
  try { S.versions = await api(`/api/versions?video=${enc(S.rel)}`); } catch { return; }
  const others = S.versions.filter((x) => x.rel !== S.rel);
  const cur = S.versions.find((x) => x.rel === S.rel);
  // 比べる版：メモのあるいちばん近い前の版 → いちばん近い前の版 → メモのある版
  const older = others.filter((x) => cur?.version != null && x.version != null && x.version < cur.version);
  const pick = older.filter((x) => x.total).pop() ?? older.pop() ?? others.filter((x) => x.total).pop() ?? others[others.length - 1];
  S.prevRel = pick?.rel ?? null;
  await loadPrev();
}
async function loadPrev() {
  S.prevNotes = [];
  if (!S.prevRel) return;
  try { S.prevNotes = sortNotes((await api(`/api/notes?video=${enc(S.prevRel)}`)).notes); } catch {}
}
const verifiedKey = () => `verified:${S.rel}`;

/* ================= 再生まわり ================= */
const setRate = (r) => { v.playbackRate = r; store.set("rate", r); renderTransport(); };
/** 真ん中でアイコンが弾む（再生したとき） */
const pulse = (name) => { const el = $("#ovPulse"); el.innerHTML = icon(name); restart(el); };
/** 左右に「◀◀ 5秒」の波紋（続けて押すと秒数が足される） */
let seekAcc = { side: "", n: 0, at: 0 };
function showSeek(d) {
  const side = d < 0 ? "L" : "R", now = Date.now();
  seekAcc = seekAcc.side === side && now - seekAcc.at < 900 ? { side, n: seekAcc.n + Math.abs(d), at: now } : { side, n: Math.abs(d), at: now };
  const el = $("#ovSeek" + side);
  el.innerHTML = `<div class="in">${icon(d < 0 ? "back" : "fwd")}<span class="num">${+seekAcc.n.toFixed(1)}秒</span></div>`;
  restart(el);
}
const seek = (d, show) => { if (!v.duration) return; v.currentTime = clamp(v.currentTime + d, 0, v.duration); if (show) showSeek(d); };
const togglePlay = () => { if (!S.rel) return; if (v.paused) { v.play(); pulse("play"); } else v.pause(); };
function jumpTo(t, id) { v.pause(); v.currentTime = t; if (id) setActive(id, true); }
function jumpNote(dir) {
  const t = v.currentTime, list = S.notes;
  const n = dir > 0 ? list.find((x) => x.t > t + 0.25) : [...list].reverse().find((x) => x.t < t - 0.25);
  if (n) jumpTo(n.t, n.id);
}
function toggleFullscreen() { if (document.fullscreenElement) document.exitFullscreen(); else player.requestFullscreen?.().catch(() => {}); }
v.addEventListener("play", () => { player.classList.remove("paused"); renderTransport(); });
v.addEventListener("pause", () => { player.classList.add("paused"); renderTransport(); });
v.addEventListener("volumechange", () => { store.set("muted", v.muted); renderTransport(); });
v.addEventListener("error", () => { if (S.rel && v.error) toast("動画を読み込めませんでした（ブラウザが対応していない形式かもしれません）", { kind: "err" }); });
const updBuf = () => { const d = v.duration; if (v.buffered.length && d) $("#tlBuf").style.width = (v.buffered.end(v.buffered.length - 1) / d) * 100 + "%"; };
v.addEventListener("progress", updBuf); v.addEventListener("loadeddata", updBuf);
$("#ovPlay").innerHTML = icon("play");
v.muted = !!store.get("muted", false);
v.playbackRate = store.get("rate", 1);

/* 画面を押す：マウスは1回で再生・停止、ダブルクリックで全画面。
 * 指は1回で再生・停止、左右をダブルタップで5秒もどる・すすむ（続けてたたくと足される）、真ん中のダブルタップで全画面 */
let lastTap = 0, tapTimer = null, lastTouch = 0, tapSeek = null;
player.addEventListener("pointerup", (e) => {
  if (e.pointerType === "mouse" || !S.rel || e.target !== v) return;
  lastTouch = Date.now();
  const r = player.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
  const side = x < 0.38 ? -5 : x > 0.62 ? 5 : 0;
  if (tapSeek && Date.now() < tapSeek.until && side === tapSeek.side) { seek(side, true); tapSeek.until = Date.now() + 700; return; }
  if (Date.now() - lastTap < 300) {
    clearTimeout(tapTimer); lastTap = 0;
    if (side) { seek(side, true); tapSeek = { side, until: Date.now() + 700 }; } else toggleFullscreen();
    return;
  }
  lastTap = Date.now(); tapSeek = null;
  tapTimer = setTimeout(togglePlay, 280);
});
player.addEventListener("click", (e) => {
  if (Date.now() - lastTouch < 700) return; // 指の操作は上で済んでいる
  if (e.target === v || e.target.closest("#ovPlay")) togglePlay();
});
v.addEventListener("dblclick", () => { if (Date.now() - lastTouch > 700) toggleFullscreen(); });

function renderTransport() {
  $("#transport").innerHTML = `
    <button class="btn primary play" data-a="play" title="${v.paused ? "再生" : "一時停止"}（Space）" aria-label="${v.paused ? "再生" : "一時停止"}">${icon(v.paused ? "play" : "pause")}</button>
    ${iconBtn("back", "5秒もどる（J）", 'data-a="b5"')}
    ${iconBtn("frameL", "1コマもどる（,）", 'data-a="f-"', "ghost hide-s")}
    ${iconBtn("frameR", "1コマすすむ（.）", 'data-a="f+"', "ghost hide-s")}
    ${iconBtn("fwd", "5秒すすむ（L）", 'data-a="f5"')}
    <span class="tc num" id="tc"></span>
    <span class="sep hide-s"></span>
    ${iconBtn("prevNote", "前のメモへ（P）", 'data-a="pn"', "ghost hide-s")}
    ${iconBtn("nextNote", "次のメモへ（N）", 'data-a="nn"', "ghost hide-s")}
    <span class="grow hide-s"></span>
    <button class="btn ghost rate hide-s" data-a="rate" title="再生速度（[ と ] でも）">${v.playbackRate}x</button>
    ${iconBtn(v.muted ? "mute" : "volume", v.muted ? "音を出す" : "音を消す", 'data-a="mute"', "ghost hide-s")}
    ${iconBtn("expand", "全画面（F）", 'data-a="fs"', "ghost hide-s")}
    <button class="btn primary memo" data-a="memo" title="今の場面にメモ（M）" ${S.rel ? "" : "disabled"}>${icon("notePlus")}メモ</button>`;
  tick(true);
}
$("#transport").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  ({
    play: togglePlay, b5: () => seek(-5, true), f5: () => seek(5, true), "f-": () => { v.pause(); seek(-1 / 30); }, "f+": () => { v.pause(); seek(1 / 30); },
    pn: () => jumpNote(-1), nn: () => jumpNote(1), mute: () => (v.muted = !v.muted), fs: toggleFullscreen, memo: () => openComposer(),
    rate: () => setRate(RATES[(RATES.indexOf(v.playbackRate) + 1) % RATES.length]),
  })[b.dataset.a]?.();
});

/* 毎フレーム：変わったところだけ書き換える */
let lastPos = 0, lastActive = null, lastT = -1, lastD = -1, lastOv = "";
function tick(force) {
  const d = v.duration || 0, t = v.currentTime || 0;
  if (t !== lastT || d !== lastD || force) {
    lastT = t; lastD = d;
    const tc = $("#tc");
    if (tc) tc.innerHTML = `${fmt(t)} <span class="faint">/ ${fmt(d)}</span>`;
    $("#ovTime").textContent = fmt(t);
    const p = d ? (t / d) * 100 : 0;
    $("#tlPlayed").style.width = p + "%"; $("#tlHead").style.left = p + "%";
    tl.setAttribute("aria-valuenow", String(Math.round(t)));
    if (S.rel && Math.abs(t - lastPos) > 0.5) { lastPos = t; store.set("pos:" + S.rel, +t.toFixed(1)); }
  }
  // 今の場面のメモ：一覧で光らせ、動画の下に出す
  const near = S.notes.find((n) => (n.t2 != null ? t >= n.t - 0.3 && t <= n.t2 + 0.3 : Math.abs(n.t - t) < 1.2));
  const nid = near?.id ?? null;
  if (nid !== lastActive) { lastActive = nid; setActive(nid); }
  const ovKey = near && !S.draft ? near.id + "\n" + near.text : "";
  if (ovKey !== lastOv) {
    lastOv = ovKey;
    const ov = $("#ovNote");
    if (ovKey) { ov.innerHTML = `${icon("msg", "s")}<span>${esc(near.text)}</span>`; ov.classList.add("show"); } else ov.classList.remove("show");
  }
  if (!force) requestAnimationFrame(() => tick());
}
function setActive(id, scroll) {
  S.activeId = id;
  $$(".note[data-id]", $("#list")).forEach((el) => el.classList.toggle("active", el.dataset.id === id));
  if (scroll && id) $(`.note[data-id="${id}"]`, $("#list"))?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

/* ================= タイムライン ================= */
const hv = document.createElement("video"); hv.muted = true; hv.preload = "auto"; // なぞったときの小さな画面
let hvBusy = false, hvWant = null;
hv.addEventListener("seeked", () => { try { const c = $("#tlCanvas"); c.height = Math.round((c.width * hv.videoHeight) / hv.videoWidth) || 180; c.getContext("2d").drawImage(hv, 0, 0, c.width, c.height); } catch {} hvBusy = false; if (hvWant != null) { const w = hvWant; hvWant = null; hvSeek(w); } });
const hvSeek = (t) => { if (hvBusy) { hvWant = t; return; } hvBusy = true; hv.currentTime = t; };
const tlTime = (x) => { const r = tl.getBoundingClientRect(); return clamp((x - r.left) / r.width, 0, 1) * (v.duration || 0); };
const markNote = (el) => S.notes.find((x) => x.id === el.dataset.id) ?? S.prevNotes.find((x) => x.id === el.dataset.id);
let dragging = false;
tl.addEventListener("pointerdown", (e) => {
  if (!v.duration) return;
  const m = e.target.closest(".tl-mark");
  if (m) { const n = markNote(m); if (n) { jumpTo(n.t, S.notes.includes(n) ? n.id : null); return; } }
  dragging = true; tl.classList.add("drag"); tl.setPointerCapture(e.pointerId); v.currentTime = tlTime(e.clientX);
});
tl.addEventListener("pointermove", (e) => {
  if (dragging) v.currentTime = tlTime(e.clientX);
  if (e.pointerType !== "mouse" || !v.duration) return;
  const r = tl.getBoundingClientRect(), t = tlTime(e.clientX), box = $("#tlHover");
  box.style.display = "flex"; box.style.left = clamp(e.clientX - r.left, 104, r.width - 104) + "px";
  const m = e.target.closest(".tl-mark"), n = m && markNote(m);
  $("#tlHoverTime").innerHTML = n ? `<span class="tip">${fmt(n.t)}　${esc(n.text.slice(0, 80))}</span>` : fmt(t);
  hvSeek(n ? n.t : t);
});
const endDrag = () => { dragging = false; tl.classList.remove("drag"); };
tl.addEventListener("pointerup", endDrag); tl.addEventListener("pointercancel", endDrag);
tl.addEventListener("pointerleave", () => ($("#tlHover").style.display = "none"));
function renderMarks() {
  const d = v.duration || 0;
  if (!d) { $("#tlMarks").innerHTML = ""; return; }
  const mark = (n, ghost) => {
    const left = (n.t / d) * 100, c = tagColor(n.tag);
    const range = n.t2 != null ? `<div class="tl-range ${n.done ? "done" : ""}" style="--c:${c};left:${left}%;width:${((n.t2 - n.t) / d) * 100}%"></div>` : "";
    return `${range}<div class="tl-mark ${n.done && !ghost ? "done" : ""} ${ghost ? "ghost" : ""} ${n.id === S.flashId ? "new" : ""}" data-id="${esc(n.id)}" style="--c:${ghost ? "#9aa3b8" : c};left:${left}%"></div>`;
  };
  $("#tlMarks").innerHTML = (S.tab === "prev" ? S.prevNotes.map((n) => mark(n, true)).join("") : "") + S.notes.map((n) => mark(n)).join("");
}

/* ================= メモを書く（画像に丸・矢印も描ける） ================= */
const COLORS = [["#ff3b30", "赤"], ["#ffd60a", "黄"], ["#32d2ff", "水色"], ["#ffffff", "白"]];
const TOOLS = [["arrow", "矢印"], ["rect", "四角"], ["circle", "丸"], ["pen", "手書き"]];
const waitSeek = () => new Promise((r) => (v.seeking ? v.addEventListener("seeked", () => setTimeout(r, 40), { once: true }) : r()));
const base = document.createElement("canvas"); // 動画の1コマ
function grab() {
  const w = Math.min(1280, v.videoWidth || 1280);
  base.width = w; base.height = Math.round((w * (v.videoHeight || 720)) / (v.videoWidth || 1280));
  try { base.getContext("2d").drawImage(v, 0, 0, base.width, base.height); return true; } catch { return false; }
}
async function openComposer({ t, text = "", tag = "" } = {}) {
  if (!S.rel || !v.duration) return;
  if (S.draft) { $("#cmpText")?.focus(); return; }
  S.wasPlaying = !v.paused; v.pause();
  if (t != null) v.currentTime = t;
  await waitSeek();
  S.draft = { id: uid("n"), t: +v.currentTime.toFixed(2), t2: null, tag, text, shapes: [], tool: store.get("tool", "arrow"), color: store.get("color", COLORS[0][0]) };
  grab();
  const n = store.get("annHint", 0); // はじめの3回だけ、なぞって描けることを動きで見せる
  S.draft.hint = n < 3; if (S.draft.hint) store.set("annHint", n + 1);
  renderComposer();
  restart($("#ovFlash"));
  if (!touch) { const ta = $("#cmpText"); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}
function renderComposer() {
  const d = S.draft, el = $("#composer");
  if (!d) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  el.innerHTML = `
    <div class="ann">
      <div class="ann-stage"><canvas id="annCanvas" aria-label="場面の画像（なぞって書き込めます）"></canvas>${d.hint ? `<span class="ann-hint">${icon("hand")}</span>` : ""}</div>
      <div class="ann-tools">
        <div class="seg" role="group" aria-label="書き込む形">${TOOLS.map(([k, l]) => `<button data-tool="${k}" aria-pressed="${d.tool === k}" title="${l}" aria-label="${l}">${icon(k, "s")}</button>`).join("")}</div>
        <span class="vsep"></span>
        ${COLORS.map(([c, name]) => `<button class="swatch" data-color="${c}" style="--c:${c}" aria-pressed="${d.color === c}" title="${name}" aria-label="${name}"></button>`).join("")}
        <span class="grow"></span>
        ${iconBtn("undo", "書き込みを1つ戻す", `data-ann="undo" ${d.shapes.length ? "" : "disabled"}`, "ghost sm")}
        ${iconBtn("trash", "書き込みを全部消す", `data-ann="clear" ${d.shapes.length ? "" : "disabled"}`, "ghost sm")}
      </div>
    </div>
    <div class="cmp-form">
      <div class="cmp-time">
        <span class="t num" id="cmpT">${fmt(d.t)}</span>
        ${iconBtn("left", "0.5秒前へ（Alt+←）", 'data-nudge="-0.5"', "ghost sm")}
        ${iconBtn("right", "0.5秒後へ（Alt+→）", 'data-nudge="0.5"', "ghost sm")}
        ${d.t2 != null ? `<span class="range num">〜 ${fmt(d.t2)}${iconBtn("x", "範囲をやめる", 'data-range="clear"', "ghost sm")}</span>` : iconBtn("range", "ここまでを範囲に：動画を先へ進めてから押す（Alt+R）", 'data-range="set"', "ghost sm")}
      </div>
      <div class="tagpick" role="group" aria-label="分類">${tags().map((t, i) => `<button data-tag="${esc(t.name)}" style="--c:${esc(t.color)}" aria-pressed="${d.tag === t.name}" ${i < 9 && !touch ? `title="Alt+${i + 1}"` : ""}>${esc(t.name)}</button>`).join("")}</div>
      <textarea class="textarea cmp-text" id="cmpText" placeholder="気になったこと">${esc(d.text)}</textarea>
      <div class="cmp-foot">
        <button class="btn primary" data-cmp="save" title="保存（Enter）">${icon("check", "s")}保存</button>
        ${iconBtn("x", "やめる（Esc）", 'data-cmp="cancel"')}
      </div>
    </div>`;
  const c = $("#annCanvas");
  c.width = base.width; c.height = base.height;
  drawAnn();
  bindCanvas(c);
}
function drawShape(ctx, s) {
  const lw = Math.max(3, Math.hypot(ctx.canvas.width, ctx.canvas.height) / 220); // 縦長の動画でも見た目の太さをそろえる
  ctx.save();
  ctx.strokeStyle = s.color; ctx.fillStyle = s.color; ctx.lineWidth = lw; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = lw * 1.2;
  const [a, b] = [s.pts[0], s.pts[s.pts.length - 1]];
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
  ctx.beginPath();
  if (s.tool === "pen") {
    ctx.moveTo(a.x, a.y);
    for (let i = 1; i < s.pts.length - 1; i++) { const p = s.pts[i], q = s.pts[i + 1]; ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2); }
    ctx.lineTo(b.x, b.y); ctx.stroke();
  } else if (s.tool === "rect") {
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, lw); else ctx.rect(x, y, w, h);
    ctx.stroke();
  } else if (s.tool === "circle") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2 || 1, h / 2 || 1, 0, 0, Math.PI * 2); ctx.stroke();
  } else { // 矢印：先が b
    const ang = Math.atan2(b.y - a.y, b.x - a.x), hl = lw * 4.2;
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x - Math.cos(ang) * hl * 0.6, b.y - Math.sin(ang) * hl * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - hl * Math.cos(ang - 0.45), b.y - hl * Math.sin(ang - 0.45));
    ctx.lineTo(b.x - hl * Math.cos(ang + 0.45), b.y - hl * Math.sin(ang + 0.45));
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawAnn(live) {
  const c = $("#annCanvas"); if (!c) return;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.drawImage(base, 0, 0);
  for (const s of S.draft.shapes) drawShape(ctx, s);
  if (live) drawShape(ctx, live);
}
function bindCanvas(c) {
  let cur = null;
  const pt = (e) => { const r = c.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height }; };
  c.addEventListener("pointerdown", (e) => {
    e.preventDefault(); c.setPointerCapture(e.pointerId);
    $(".ann-hint")?.remove();
    const p = pt(e); cur = { tool: S.draft.tool, color: S.draft.color, pts: [p, p] };
  });
  c.addEventListener("pointermove", (e) => { if (!cur) return; const p = pt(e); if (cur.tool === "pen") cur.pts.push(p); else cur.pts[1] = p; drawAnn(cur); });
  const up = () => {
    if (!cur) return;
    const [a, b] = [cur.pts[0], cur.pts[cur.pts.length - 1]];
    const big = cur.tool === "pen" ? cur.pts.length > 2 : Math.hypot(b.x - a.x, b.y - a.y) > c.width / 80;
    if (big) S.draft.shapes.push(cur);
    cur = null; drawAnn(); refreshAnnTools();
  };
  c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
}
function refreshAnnTools() {
  const n = S.draft?.shapes.length ?? 0;
  $$("[data-ann]", $("#composer")).forEach((b) => (b.disabled = !n));
}
async function nudge(dt) {
  const d = S.draft; if (!d) return;
  d.text = $("#cmpText").value;
  d.t = +clamp(d.t + dt, 0, v.duration).toFixed(2); v.currentTime = d.t; await waitSeek(); grab();
  const el = $("#cmpT"); el.textContent = fmt(d.t); el.classList.add("bump"); setTimeout(() => el.classList.remove("bump"), 150);
  drawAnn();
}
$("#composer").addEventListener("click", (e) => {
  const d = S.draft; if (!d) return;
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.tool) { d.tool = b.dataset.tool; store.set("tool", d.tool); $$("[data-tool]", $("#composer")).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }
  else if (b.dataset.color) { d.color = b.dataset.color; store.set("color", d.color); $$("[data-color]", $("#composer")).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }
  else if (b.dataset.ann === "undo") { d.shapes.pop(); drawAnn(); refreshAnnTools(); }
  else if (b.dataset.ann === "clear") { d.shapes = []; drawAnn(); refreshAnnTools(); }
  else if (b.dataset.tag != null) setTag(b.dataset.tag);
  else if (b.dataset.nudge) nudge(Number(b.dataset.nudge));
  else if (b.dataset.range) setRange(b.dataset.range === "clear");
  else if (b.dataset.cmp === "save") return saveDraft();
  else if (b.dataset.cmp === "cancel") return cancelDraft();
  if (!touch) $("#cmpText")?.focus();
});
$("#composer").addEventListener("keydown", (e) => {
  if (e.target.id !== "cmpText") return;
  e.stopPropagation();
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !touch) { e.preventDefault(); saveDraft(); } // スマホの改行キーは改行のまま
  else if (e.key === "Escape") { e.preventDefault(); cancelDraft(); }
  else if (e.altKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); const t = tags()[Number(e.key) - 1]; if (t) setTag(t.name); }
  else if (e.altKey && e.key.toLowerCase() === "r") { e.preventDefault(); setRange(false); }
  else if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { e.preventDefault(); nudge(e.key === "ArrowLeft" ? -0.5 : 0.5); }
});
function setTag(name) {
  const d = S.draft; d.tag = d.tag === name ? "" : name;
  $$("[data-tag]", $("#composer")).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.tag === d.tag)));
}
function setRange(clear) {
  const d = S.draft;
  d.text = $("#cmpText").value;
  if (clear) d.t2 = null;
  else if (v.currentTime <= d.t + 0.2) { toast("動画を少し先へ進めてから押すと、そこまでを範囲にできます"); return; }
  else d.t2 = +v.currentTime.toFixed(2);
  d.hint = false; renderComposer();
  if (!touch) $("#cmpText").focus();
}
function saveDraft() {
  const d = S.draft; if (!d) return;
  const ta = $("#cmpText"), text = ta.value.trim();
  if (!text) { ta.focus(); restart(ta, "shake"); return; }
  const c = $("#annCanvas"), from = c.getBoundingClientRect();
  let data = null;
  try { data = c.toDataURL("image/jpeg", 0.9); } catch {}
  const note = { id: d.id, t: d.t, t2: d.t2, tag: d.tag, text, done: false, created: new Date().toISOString(), author: prefs.get().name || "" };
  if (data) note._local = data;
  const resume = prefs.get().resume && S.wasPlaying;
  closeComposer();
  if (S.filter === "done") { S.filter = "open"; store.set("filter", "open"); }
  S.flashId = note.id; setTimeout(() => (S.flashId = null), 900);
  commit({ op: "upsert", note }, data ? { upload: { name: `${note.id}_${fmt(note.t).replace(/[:.]/g, "")}.jpg`, data } } : {});
  if (data) flyTo(data, from, note.id);
  if (resume) v.play();
}
/** 保存したメモの画像が、一覧のそのメモへ飛んでいく */
function flyTo(src, from, id) {
  if (S.tab !== "notes" || !from.width || matchMedia("(max-width: 820px)").matches) return; // スマホは一覧が画面の外なので飛ばさない（ページごと動いてしまう）
  const thumb = $(`.note[data-id="${id}"] .note-thumb`, $("#list"));
  if (!thumb) return;
  thumb.scrollIntoView({ block: "nearest" });
  const to = thumb.getBoundingClientRect();
  if (to.bottom < 0 || to.top > innerHeight) return;
  const img = Object.assign(document.createElement("img"), { src, className: "fly" });
  Object.assign(img.style, { left: from.left + "px", top: from.top + "px", width: from.width + "px", height: from.height + "px", transformOrigin: "0 0" });
  document.body.append(img);
  thumb.style.visibility = "hidden";
  img.animate([{ transform: "none" }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})` }], { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
  setTimeout(() => { img.remove(); thumb.style.visibility = ""; }, 520); // 動きの終わりを待たない（見えていないタブでは止まるため）
}
function cancelDraft() { const resume = S.wasPlaying; closeComposer(); if (resume) v.play(); }
function closeComposer() { S.draft = null; renderComposer(); }

/* ================= メモ一覧 ================= */
const stIc = (cls, ic, tip) => `<span class="st-ic ${cls}" role="img" title="${esc(tip)}" aria-label="${esc(tip)}">${icon(ic)}</span>`;
const statusIc = (n) => (n.done ? stIc("done", "check", "対応済み") : n.sentAt ? stIc("sent", "send", `送信済み（${fullDate(n.sentAt)}）`) : stIc("draft", "pen", "下書き：まだ送っていません"));
const thumbHtml = (n, rel) => {
  const url = shotUrl(n, rel);
  return `<div class="note-thumb ${tall() ? "tall" : ""}">${url ? `<img src="${esc(url)}" alt="" loading="lazy" data-big />` : icon("image")}${n._local && !n.shot ? `<span class="busy" title="画像を保存中">${icon("refresh", "s spin")}</span>` : ""}</div>`;
};
function renderList() {
  const el = $("#list");
  const open = S.notes.filter((n) => !n.done).length, done = S.notes.length - open;
  $("#cOpen").textContent = open || ""; $("#cAll").textContent = S.notes.length || ""; $("#cDone").textContent = done || "";
  $("#cntNotes").textContent = S.notes.length || "";
  $$("#filter button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === S.filter)));
  if (!S.rel) { el.innerHTML = ""; return; }
  const q = S.q.trim().toLowerCase();
  const shown = S.notes.filter((n) => (S.filter === "all" ? true : S.filter === "done" ? n.done : !n.done))
    .filter((n) => !q || [n.text, n.tag, n.author, n.reply].some((x) => String(x ?? "").toLowerCase().includes(q)));
  if (!shown.length) {
    el.innerHTML = !S.notes.length
      ? `<div class="empty"><div class="art">${icon("notePlus")}</div><h3>まだメモはありません</h3><p>気になる場面で <span class="kbd key-hint">M</span> か「メモ」</p></div>`
      : q ? `<div class="empty"><div class="art">${icon("search")}</div><h3>「${esc(S.q)}」は見つかりません</h3></div>`
      : S.filter === "open" ? `<div class="empty"><div class="art" style="color:var(--ok)">${icon("checkCircle")}</div><h3>未対応はありません</h3><p>${icon("check", "s")} ${done}件</p></div>`
      : `<div class="empty"><div class="art">${icon("ring")}</div><h3>対応済みはまだありません</h3></div>`;
    return;
  }
  el.innerHTML = shown.map((n) => {
    const editing = S.editing === n.id;
    return `<article class="note ${n.done ? "done" : ""} ${n.id === S.activeId ? "active" : ""} ${editing ? "editing" : ""} ${n.id === S.flashId ? "pop-in" : ""}" data-id="${esc(n.id)}" style="--c:${esc(tagColor(n.tag))}" tabindex="0" aria-label="${timeOf(n)} のメモ">
      ${thumbHtml(n)}
      <div style="min-width:0">
        <div class="note-top">
          <button class="tchip num" data-jump title="この場面へ">${timeOf(n)}</button>${tagBadge(n.tag)}
          <span class="grow"></span>
          <span class="note-acts">
            ${iconBtn("check", n.done ? "未対応に戻す" : "対応済みにする", 'data-act="done"', `ghost hide-touch ${n.done ? "ok-on" : ""}`)}
            ${iconBtn("edit", "書き直す", 'data-act="edit"', "ghost hide-touch")}
            ${iconBtn("more", "そのほか", 'data-act="more"')}
          </span>
          ${statusIc(n)}
        </div>
        ${editing ? `<div class="note-edit">
            <div class="tagpick">${tags().map((t) => `<button data-etag="${esc(t.name)}" style="--c:${esc(t.color)}" aria-pressed="${n.tag === t.name}">${esc(t.name)}</button>`).join("")}</div>
            <textarea class="textarea" data-etext>${esc(n.text)}</textarea>
            <div class="row"><button class="btn primary sm" data-act="esave" title="保存（Enter）">${icon("check", "s")}保存</button>${iconBtn("x", "やめる（Esc）", 'data-act="ecancel"', "ghost sm")}</div></div>`
          : `<div class="note-text">${esc(n.text)}</div>`}
        <div class="note-meta">${n.author ? `${avatar(n.author)}<span>${esc(n.author)}</span><span>·</span>` : ""}<span title="${esc(fullDate(n.created))}">${ago(n.created)}</span></div>
        ${n.reply ? `<div class="reply">${avatar("", true)}<div>${esc(n.reply)}</div></div>` : ""}
      </div>
    </article>`;
  }).join("");
  if (S.editing) { const ta = $("[data-etext]", el); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
}
function saveEdit(n, el) {
  const text = $("[data-etext]", el).value.trim();
  const tag = $("[data-etag][aria-pressed=true]", el)?.dataset.etag ?? "";
  S.editing = null;
  if (!text || (text === n.text && tag === (n.tag ?? ""))) return renderList();
  const note = { ...n, text, tag };
  if (text !== n.text) delete note.sentAt; // 書き直したら、もう一度送る
  commit({ op: "upsert", note });
}
const toggleDone = (n) => commit({ op: "upsert", note: { ...n, done: !n.done } });
function deleteNote(n) {
  commit({ op: "delete", id: n.id });
  toast("メモを削除しました", { action: { label: "元に戻す", icon: "undo", fn: () => commit({ op: "upsert", note: n }) } });
}
$("#list").addEventListener("click", (e) => {
  const card = e.target.closest(".note"), n = noteOf(card); if (!n) return;
  const actEl = e.target.closest("[data-act]"), act = actEl?.dataset.act;
  if (e.target.closest("[data-big]")) return lightbox(e.target.closest("[data-big]").src);
  if (act === "done") return toggleDone(n);
  if (act === "edit") { S.editing = n.id; return renderList(); }
  if (act === "esave") return saveEdit(n, card);
  if (act === "ecancel") { S.editing = null; return renderList(); }
  if (act === "more") return menu(actEl, [
    { label: n.done ? "未対応に戻す" : "対応済みにする", icon: n.done ? "ring" : "check", fn: () => toggleDone(n) },
    { label: "書き直す", icon: "edit", fn: () => { S.editing = n.id; renderList(); } },
    { label: "時刻を今の場面に合わせる", icon: "clock", hint: fmt(v.currentTime), fn: () => commit({ op: "upsert", note: { ...n, t: +v.currentTime.toFixed(2), t2: n.t2 != null && n.t2 > v.currentTime ? n.t2 : null } }) },
    ...(shotUrl(n) ? [{ label: "画像を大きく見る", icon: "image", fn: () => lightbox(shotUrl(n)) }] : []),
    { label: "本文をコピー", icon: "copy", fn: () => copyText(`${fmt(n.t)} ${n.text}`) },
    "-",
    { label: "削除", icon: "trash", danger: true, fn: () => deleteNote(n) },
  ], { width: 300 });
  const et = e.target.closest("[data-etag]");
  if (et) { $$("[data-etag]", card).forEach((b) => b.setAttribute("aria-pressed", String(b === et && b.getAttribute("aria-pressed") !== "true"))); return; }
  if (S.editing === n.id) return;
  jumpTo(n.t, n.id);
});
$("#list").addEventListener("keydown", (e) => {
  const ta = e.target.closest("[data-etext]");
  if (ta) {
    e.stopPropagation();
    const card = ta.closest(".note"), n = noteOf(card);
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !touch) { e.preventDefault(); saveEdit(n, card); }
    if (e.key === "Escape") { e.preventDefault(); S.editing = null; renderList(); }
    return;
  }
  const card = e.target.closest(".note");
  if (card && e.key === "Enter" && e.target === card) { const n = noteOf(card); if (n) jumpTo(n.t, n.id); }
});
// 指で：右へ払う＝対応済み（戻す）、左へ払う＝削除
const notEditing = (el) => !el.classList.contains("editing");
swipeable($("#list"), ".note", {
  right: { icon: (el) => (noteOf(el)?.done ? "ring" : "check"), when: notEditing, run: (el) => { const n = noteOf(el); if (n) toggleDone(n); } },
  left: { icon: "trash", away: true, when: notEditing, run: (el) => { const n = noteOf(el); if (n) deleteNote(n); } },
});
$("#filter").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b) { S.filter = b.dataset.f; store.set("filter", S.filter); renderList(); } });
$("#q").addEventListener("input", (e) => { S.q = e.target.value; renderList(); });
$("#q").addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { e.target.value = ""; S.q = ""; renderList(); e.target.blur(); } });
$("#notesMore").onclick = (e) => menu(e.currentTarget, [
  { label: "Markdown でコピー", icon: "copy", fn: () => copyText(toMd()) },
  { label: "Markdown で保存（.md）", icon: "download", fn: () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([toMd()], { type: "text/markdown" })); a.download = (S.video?.name ?? "memo").replace(/\.\w+$/, "") + ".review.md"; a.click(); } },
]);
function toMd() {
  const lines = [`# レビューメモ：${S.video?.name ?? ""}`, ""];
  for (const n of S.notes) {
    lines.push(`- [${n.done ? "x" : " "}] **${timeOf(n)}** ${n.tag ? `［${n.tag}］` : ""}${n.text.replace(/\n/g, " / ")}${n.author ? `（${n.author}）` : ""}`);
    if (n.reply) lines.push(`  - 🤖 ${n.reply.replace(/\n/g, " / ")}`);
  }
  return lines.join("\n") + "\n";
}

/* ================= 前の版 ================= */
function renderPrev() {
  const el = $("#pPrev");
  const others = S.versions.filter((x) => x.rel !== S.rel);
  $("#cntPrev").textContent = S.prevNotes.length || "";
  const cur = S.versions.find((x) => x.rel === S.rel), cmp = S.versions.find((x) => x.rel === S.prevRel);
  $("#prevLabel").textContent = cmp && cur?.version != null && cmp.version != null && cmp.version > cur.version ? "他の版" : "前の版";
  if (!others.length) {
    el.innerHTML = `<div class="empty" style="flex:1"><div class="art">${icon("history")}</div><h3>前の版はありません</h3><p>「名前_v1」「名前_v2」のように版番号を付けると見比べられます</p></div>`;
    return;
  }
  const ok = new Set(store.get(verifiedKey(), []));
  const checked = S.prevNotes.filter((n) => ok.has(n.id)).length, total = S.prevNotes.length;
  const keepScroll = $("#prevList")?.scrollTop ?? 0; // 描き直しても読んでいた位置のまま
  el.innerHTML = `
    <div class="panel-head">
      <select class="select" id="prevSel" aria-label="比べる版">${others.map((x) => `<option value="${esc(x.rel)}" ${x.rel === S.prevRel ? "selected" : ""}>${esc(x.name)}（${x.total}）</option>`).join("")}</select>
      ${total ? `<span class="meter ${checked === total ? "full" : ""}" title="直ったか確かめた数"><span class="bar"><span style="width:${(checked / total) * 100}%"></span></span>${icon("check", "s")}<span class="num">${checked}/${total}</span></span>` : ""}
    </div>
    <div class="list scroll" id="prevList">${total ? S.prevNotes.map((n) => {
      const isOk = ok.has(n.id);
      return `<article class="note prev-note ${isOk ? "ok" : ""}" data-pid="${esc(n.id)}" style="--c:${esc(tagColor(n.tag))}">
        ${thumbHtml(n, S.prevRel)}
        <div style="min-width:0">
          <div class="note-top"><button class="tchip num" data-pjump title="今の動画のこの場面へ">${timeOf(n)}</button>${tagBadge(n.tag)}<span class="grow"></span>
            ${iconBtn("check", isOk ? "直ってた（取り消す）" : "直ってた", "data-pok", `ghost sm ${isOk ? "ok-on" : ""}`)}
            ${iconBtn("notePlus", "まだ気になる：メモにする", "data-pmemo", "ghost sm")}</div>
          <div class="note-text">${esc(n.text)}</div>
          ${n.reply ? `<div class="reply">${avatar("", true)}<div>${esc(n.reply)}</div></div>` : ""}
        </div></article>`;
    }).join("") : `<div class="empty"><div class="art">${icon("msg")}</div><h3>この版にはメモがありません</h3></div>`}</div>`;
  $("#prevList").scrollTop = keepScroll;
  $("#prevSel").onchange = async (e) => { S.prevRel = e.target.value; await loadPrev(); renderPrev(); $("#prevList").scrollTop = 0; renderMarks(); };
}
function togglePrevOk(id) {
  const ok = new Set(store.get(verifiedKey(), []));
  ok.has(id) ? ok.delete(id) : ok.add(id);
  store.set(verifiedKey(), [...ok]); renderPrev();
}
$("#pPrev").addEventListener("click", (e) => {
  const card = e.target.closest("[data-pid]"); if (!card) return;
  const n = S.prevNotes.find((x) => x.id === card.dataset.pid); if (!n) return;
  if (e.target.closest("[data-big]")) return lightbox(e.target.closest("[data-big]").src);
  if (e.target.closest("[data-pok]")) return togglePrevOk(n.id);
  if (e.target.closest("[data-pmemo]")) return openComposer({ t: n.t, text: `${n.text}\n→ `, tag: n.tag || "" });
  if (v.duration) jumpTo(Math.min(n.t, v.duration - 0.05));
});
swipeable($("#pPrev"), ".prev-note", { right: { icon: "check", run: (el) => togglePrevOk(el.dataset.pid) } });

/* ================= 依頼（Claude） ================= */
// 同時に2回走ると「終わりました」が二重に出るので、走っている間は同じものを待つ
let pollP = null;
const pollClaude = () => (pollP ??= pollClaudeOnce().finally(() => (pollP = null)));
async function pollClaudeOnce() {
  try {
    const r = await api(`/api/claude?video=${enc(S.rel ?? "")}`);
    const prevDone = new Set(S.reqs.filter((x) => x.status === "done").map((x) => x.id));
    const newlyDone = r.requests.filter((q) => q.status === "done" && !prevDone.has(q.id) && S.reqs.some((x) => x.id === q.id));
    S.alive = r.alive; S.reqs = r.requests;
    for (const q of newlyDone) {
      if (q.resultVideo && q.resultVideo !== S.rel) announce(q.resultVideo, true); // 新しい版のお知らせと1つにまとめる
      else toast("Claude の対応が終わりました", { kind: "claude", timeout: 8000 });
    }
    const live = S.reqs.find((q) => q.status !== "done" && q.video === S.rel);
    bar.setClaude({ alive: S.alive, busy: !!live, text: live ? LIVE[live.status] : "" });
    renderReqs(); renderSend();
  } catch {
    bar.setClaude({ alive: false });
  }
}
setInterval(() => !document.hidden && pollClaude(), 3000);
$("#claudePill").onclick = (e) => claudeInfo(e.currentTarget, S.alive);
const reqSig = (r) => r ? [r.id, r.status, r.progress?.length ?? 0, r.result ?? "", r.resultVideo ?? ""].join("|") : "";
let lastReqsSig = null;
function renderReqs() {
  const mine = S.reqs.filter((r) => r.kind !== "plan");
  $("#cntReqs").textContent = mine.length || "";
  const sig = S.rel + "#" + mine.map(reqSig).join(",");
  if (sig === lastReqsSig) return; // 変わっていなければ描き直さない（動きが毎回やり直しにならないように）
  lastReqsSig = sig;
  const el = $("#reqList");
  if (!mine.length) { el.innerHTML = `<div class="empty"><div class="art">${icon("inbox")}</div><h3>まだ依頼はありません</h3><p>送ると、ここに進み具合と Claude のまとめが出ます</p></div>`; return; }
  el.innerHTML = mine.map((r) => {
    const logs = (r.progress ?? []).slice(-3).reverse();
    const other = r.video !== S.rel;
    return `<div class="req ${r.status !== "done" ? "live" : ""}">
      <div class="req-top">${stepper(r)}<span class="grow"></span><span class="faint" title="${esc(fullDate(r.created))}">${ago(r.created)}</span></div>
      <div class="row" style="gap:6px;flex-wrap:wrap"><span class="badge" title="送ったメモ">${icon("msg", "s")}${r.notes.length}</span>${other ? `<span class="badge" title="${esc(r.video)}">${icon("film", "s")}${esc(r.video.split("/").pop())}</span>` : ""}${r.author ? `<span class="row" style="gap:6px;font-size:var(--fs-xs);color:var(--text-3)">${avatar(r.author)}${esc(r.author)}</span>` : ""}</div>
      ${r.message ? `<div class="req-msg">${esc(r.message)}</div>` : ""}
      ${r.status !== "done" ? logs.map((l) => `<div class="req-log">${icon("spark", "s")}<span>${esc(l.text)} <span class="faint">${ago(l.at)}</span></span></div>`).join("") : ""}
      ${r.result ? `<div class="reply">${avatar("", true)}<div>${esc(r.result)}</div></div>` : ""}
      ${r.resultVideo && r.resultVideo !== S.rel ? `<div><button class="btn primary sm" data-open="${esc(r.resultVideo)}" title="${esc(r.resultVideo)}">${icon("play", "s")}新しい版を開く</button></div>` : ""}
    </div>`;
  }).join("");
}
$("#reqList").addEventListener("click", (e) => { const b = e.target.closest("[data-open]"); if (b) openVideo(b.dataset.open); });

/* ================= Claudeに送る ================= */
const growTa = (t) => { t.style.height = "auto"; t.style.height = Math.min(140, t.scrollHeight + 2) + "px"; };
let lastSendSig = null;
function renderSend() {
  const el = $("#sendbox");
  if (!S.rel) { el.hidden = true; return; }
  el.hidden = false;
  const unsent = S.notes.filter((n) => !n.done && !n.sentAt).length;
  const live = S.reqs.find((q) => q.status !== "done" && q.video === S.rel);
  const keep = $("#sendMsg")?.value ?? store.get("msg:" + S.rel, "");
  const can = !!(unsent || keep.trim());
  const inner = `${icon("send")}<span>送る</span>${unsent ? `<span class="n">${unsent}</span>` : ""}`;
  const tip = `${unsent ? `未送信のメモ ${unsent}件を` : ""}Claude に送る（Ctrl+Enter）`;
  const sig = [S.rel, unsent, reqSig(live), can].join("#");
  if (document.activeElement?.id === "sendMsg" || sig === lastSendSig) { // 入力中・変化なしは作り直さない
    const b = $("#sendBtn"); if (b) { b.disabled = !can; b.innerHTML = inner; b.dataset.tip = tip; }
    return;
  }
  lastSendSig = sig;
  const last = live?.progress?.[live.progress.length - 1];
  el.innerHTML = `
    ${live ? `<div class="live-card"><div class="row">${stepper(live)}<span class="grow"></span><span class="faint">${ago(live.updated ?? live.created)}</span></div>${last ? `<div class="req-log">${icon("spark", "s")}<span>${esc(last.text)}</span></div>` : ""}</div>` : ""}
    <div class="send-row">
      <textarea class="textarea" id="sendMsg" rows="1" placeholder="全体へのひとこと（任意）" aria-label="全体へのひとこと">${esc(keep)}</textarea>
      <button class="btn claude send" id="sendBtn" title="${esc(tip)}" ${can ? "" : "disabled"}>${inner}</button>
    </div>`;
  const ta = $("#sendMsg");
  growTa(ta);
  ta.addEventListener("input", () => { growTa(ta); store.set("msg:" + S.rel, ta.value); renderSend(); });
  ta.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
  $("#sendBtn").onclick = send;
}
async function send() {
  const btn = $("#sendBtn"); if (!btn || btn.disabled) return;
  btn.disabled = true;
  await flush();
  if (S.pending.length) { toast("保存が終わっていないので送れません（接続を確かめてください）", { kind: "err" }); btn.disabled = false; return; }
  try {
    const r = await api("/api/send", { video: S.rel, message: $("#sendMsg").value, author: prefs.get().name });
    restart(btn, "fly");
    await sleep(380);
    $("#sendMsg").value = ""; store.del("msg:" + S.rel);
    document.activeElement?.blur();
    await loadNotes(); await pollClaude(); lastSendSig = null; renderAll();
    toast(r.alive ? `Claude に届きました（メモ ${r.request.notes.length}件）` : "受付箱に入れました。Claude が来たら拾います", { kind: "claude" });
  } catch (e) { toast(e.message, { kind: "err" }); btn.disabled = false; }
}

/* ================= 新しい動画ができたら知らせる ================= */
// 書き出されたとき（動画が増えた）と、Claude が「終わった」と言ったときの両方から呼ばれる。同じ動画は1つのお知らせにまとめる
let noticeEl = null;
const announced = new Set();
function announce(rel, fromClaude) {
  if (announced.has(rel) && !fromClaude) return;
  if (announced.has(rel) && fromClaude && !noticeEl?.isConnected) return; // もう閉じた・開いた
  announced.add(rel);
  const name = S.videos.find((x) => x.rel === rel)?.name ?? rel.split("/").pop();
  noticeEl?.remove();
  noticeEl = document.createElement("div");
  noticeEl.className = "notice new";
  noticeEl.innerHTML = `${icon("spark")}<span>${fromClaude ? "Claude が直しました：" : ""}<b>${esc(name)}</b>${fromClaude ? "" : " ができました"}</span><button class="btn primary sm" data-o>${icon("play", "s")}開く</button>${iconBtn("x", "閉じる", "data-x", "ghost sm")}`;
  const el = noticeEl;
  el.querySelector("[data-o]").onclick = () => { el.remove(); openVideo(rel); };
  el.querySelector("[data-x]").onclick = () => el.remove();
  document.body.append(el);
}
setInterval(async () => {
  if (document.hidden) return;
  const before = S.knownVideos;
  await loadVideos();
  if (!before) return;
  const fresh = S.videos.filter((x) => !before.has(x.rel));
  if (!fresh.length) return;
  S.knownVideos = new Set(S.videos.map((x) => x.rel));
  if (!S.rel) return openVideo(fresh[0].rel);
  const x = fresh.find((f) => S.video && f.series === S.video.series && f.dir === S.video.dir) ?? fresh[0];
  announce(x.rel, false);
}, 6000);

/* ================= 右側のタブ ================= */
function setTab(t) {
  S.tab = t; store.set("tab", t);
  $$("#sideTabs [data-tab]").forEach((b) => { b.setAttribute("aria-pressed", String(b.dataset.tab === t)); b.setAttribute("aria-selected", String(b.dataset.tab === t)); });
  $("#pNotes").hidden = t !== "notes"; $("#pPrev").hidden = t !== "prev"; $("#pReqs").hidden = t !== "reqs";
  renderMarks();
}
$("#sideTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) setTab(b.dataset.tab); });

function renderAll() { renderList(); renderMarks(); renderPrev(); renderReqs(); renderSend(); renderPicker(); }

/* ================= キーボード ================= */
addEventListener("keydown", (e) => {
  if (anyModal() || e.isComposing || e.target.closest?.(".pop")) return;
  const tag = e.target.tagName;
  if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || e.target.isContentEditable) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  const run = (f) => { e.preventDefault(); f(); };
  if (k === " " || k === "k" || k === "K") run(togglePlay);
  else if (k === "m" || k === "M" || (k === "Enter" && !e.target.closest(".note, button, a"))) run(() => openComposer());
  else if (k === "ArrowLeft") run(() => seek(e.shiftKey ? -0.1 : -1, !e.shiftKey));
  else if (k === "ArrowRight") run(() => seek(e.shiftKey ? 0.1 : 1, !e.shiftKey));
  else if (k === "j" || k === "J") run(() => seek(-5, true));
  else if (k === "l" || k === "L") run(() => seek(5, true));
  else if (k === ",") run(() => { v.pause(); seek(-1 / 30); });
  else if (k === ".") run(() => { v.pause(); seek(1 / 30); });
  else if (k === "n" || k === "N") run(() => jumpNote(1));
  else if (k === "p" || k === "P") run(() => jumpNote(-1));
  else if (k === "f" || k === "F") run(toggleFullscreen);
  else if (k === "[" || k === "]") run(() => { const i = RATES.indexOf(v.playbackRate); setRate(RATES[clamp((i < 0 ? 1 : i) + (k === "]" ? 1 : -1), 0, RATES.length - 1)]); });
  else if (k === "/") run(() => openPicker());
  else if (k === "?") run(help);
  else if (k === "Escape" && S.draft) run(cancelDraft);
});
function help() {
  openHelp({
    title: "動画レビューの使い方",
    intro: steps3([["play", "見る", "気になったら止める"], ["notePlus", "メモ", "画像をなぞって印も付けられる"], ["send", "送る", "まとめて Claude へ。返事は各メモに"]]),
    keys: [["Space / K", "再生・一時停止"], ["M / Enter", "今の場面にメモ"], ["← / →", "1秒もどる・すすむ（Shiftで0.1秒）"], ["J / L", "5秒もどる・すすむ"], [", / .", "1コマもどる・すすむ"], ["P / N", "前・次のメモの場面へ"], ["[ / ]", "再生速度"], ["F", "全画面"], ["/", "動画を選ぶ"], ["?", "この使い方"], ["Alt+1〜9", "（メモ中）分類"], ["Alt+← / Alt+→", "（メモ中）0.5秒ずらす"], ["Alt+R", "（メモ中）ここまでを範囲に"], ["Ctrl+Enter", "（ひとこと入力中）送る"]],
    extra: `<div class="section-title">印</div><div class="legend">
        <span class="st-ic draft">${icon("pen")}</span><span>下書き（まだ送っていない）</span>
        <span class="st-ic sent">${icon("send")}</span><span>送信済み（書き直すともう一度送れる）</span>
        <span class="st-ic done">${icon("check")}</span><span>対応済み</span></div>
      <div class="section-title">指で</div><div class="legend">
        <span class="st-ic">${icon("swipe")}</span><span>メモを右へ払う＝対応済み ／ 左へ払う＝削除</span>
        <span class="st-ic">${icon("hand")}</span><span>動画の左右をダブルタップ＝5秒もどる・すすむ ／ 真ん中＝全画面</span></div>`,
  });
}
$("#helpBtn").onclick = help;
$("#settingsBtn").onclick = () => openSettings({ onChange: () => { lastReqsSig = lastSendSig = null; renderAll(); if (S.draft) { S.draft.text = $("#cmpText").value; renderComposer(); } } });

/* ================= はじめ ================= */
(async function init() {
  if (store.get("since") == null) store.set("since", Date.now());
  renderTransport();
  requestAnimationFrame(() => tick());
  setTab(S.tab);
  await workspace.load();
  await loadVideos();
  const qs = new URLSearchParams(location.search);
  const want = qs.get("v") ?? store.get("lastVideo");
  const t = qs.get("t") != null ? Number(qs.get("t")) : undefined;
  if (want && S.videos.some((x) => x.rel === want)) await openVideo(want, { t });
  else if (S.videos.length) await openVideo(S.videos[0].rel);
  else { setTitle(""); showNoVideo(); renderAll(); pollClaude(); }
  welcome();
})();
