// レビューツール：2つの画面（動画レビュー・構成メモ）で共通の部品。依存なし
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const uid = (p = "") => p + Math.random().toString(36).slice(2, 9);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
/** 秒 → 00:00.0（59.96秒が「00:60.0」にならないよう、先に0.1秒単位へ丸める） */
export const fmt = (t) => { t = Math.round(Math.max(0, t || 0) * 10) / 10; const m = Math.floor(t / 60); return `${String(m).padStart(2, "0")}:${(t - m * 60).toFixed(1).padStart(4, "0")}`; };
export const ago = (d) => {
  const t = typeof d === "number" ? d : new Date(d).getTime();
  if (!t) return "";
  const s = (Date.now() - t) / 1000;
  if (s < 45) return "たった今";
  if (s < 3600) return `${Math.round(s / 60)}分前`;
  if (s < 86400) return `${Math.round(s / 3600)}時間前`;
  if (s < 172800) return "昨日";
  const x = new Date(t); return `${x.getMonth() + 1}/${x.getDate()}`;
};
export const fullDate = (d) => { const t = new Date(d); return isNaN(t) ? "" : t.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); };
export const sizeStr = (b) => (b > 1e9 ? (b / 1e9).toFixed(1) + " GB" : b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB");
export const touch = matchMedia("(hover: none)").matches;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- アイコン（24×24 の線画） ---------- */
const I = {
  logo: '<path d="M4 5h16v14H4z"/><path d="m10 9 5 3-5 3z"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  play: '<path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.3-7.2a.8.8 0 0 0 0-1.4L8.2 4.1A.8.8 0 0 0 7 4.8z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/>',
  back: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/>',
  fwd: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  frameL: '<path d="M17 6 10 12l7 6z" fill="currentColor" stroke="none"/><path d="M7 6v12"/>',
  frameR: '<path d="m7 6 7 6-7 6z" fill="currentColor" stroke="none"/><path d="M17 6v12"/>',
  prevNote: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  nextNote: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  note: '<path d="M21 14.5a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v6M9 10h6"/>',
  msg: '<path d="M21 14.5a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.3 2.4 2.4 4.8-5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  send: '<path d="M21.5 2.5 10.5 13.5"/><path d="m21.5 2.5-7 19-4-8-8-4z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.5-2.7 4"/><path d="M12 17.3h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  grip: '<circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
  pen: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  arrow: '<path d="M5 19 19 5"/><path d="M10 5h9v9"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="2"/>',
  circle: '<ellipse cx="12" cy="12" rx="8.5" ry="7"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7.5V12l3 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  spark: '<path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7-5.6-1.9L10.1 9z"/><path d="M19 3v3M17.5 4.5h3"/>',
  volume: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 6 6M22 9l-6 6"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  loop: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  diff: '<path d="M12 3v14M5 10h14"/><path d="M5 21h14"/>',
  wifiOff: '<path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.6-1.8M2 8.8A15 15 0 0 1 6.2 6M22 8.8A15 15 0 0 0 11 5M12 20h.01"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2" fill="currentColor"/><circle cx="12" cy="7.5" r="1.2" fill="currentColor"/><circle cx="16" cy="10" r="1.2" fill="currentColor"/><path d="M12 21a2.5 2.5 0 0 1 0-5h2a3 3 0 0 0 3-3"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  ring: '<circle cx="12" cy="12" r="8"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/>',
  range: '<path d="M5 6v12M19 6v12"/><path d="M8.5 12h7"/><path d="m13 9 3 3-3 3"/>',
  cloudCheck: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-8.96 6 6 0 0 1 11.52 1.46A3.75 3.75 0 0 1 17.25 18.5z"/><path d="m9.5 14 2 2 3.5-3.5"/>',
  cloudOff: '<path d="M3 3l18 18"/><path d="M8.2 8.2A6 6 0 0 0 6.4 9.54 4.5 4.5 0 0 0 7 18.5h10.25c.3 0 .6-.03.88-.1M20.5 16.2A3.75 3.75 0 0 0 17.9 11a6 6 0 0 0-7.1-4.7"/>',
  hand: '<path d="M9 11.5V5.5a1.5 1.5 0 0 1 3 0V10m0-1a1.5 1.5 0 0 1 3 0v2m0-.5a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-.7a6 6 0 0 1-4.8-2.4L4.3 15.2a1.6 1.6 0 0 1 2.4-2.1L9 15"/>',
  plusCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  notePlus: '<path d="M21 14.5a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v6M9 10h6"/>',
  swipe: '<path d="M4 8h10M4 8l3-3M4 8l3 3"/><path d="M20 16H10m10 0-3-3m3 3-3 3"/>',
};
export const icon = (name, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name] ?? ""}</svg>`;
/** アイコンだけのボタン（説明は title＝ふきだし と aria-label＝読み上げ） */
export const iconBtn = (ic, tip, attrs = "", cls = "ghost") => `<button class="btn icon ${cls}" title="${esc(tip)}" aria-label="${esc(tip)}" ${attrs}>${icon(ic, "s")}</button>`;
/** HTML に書いた data-ic="名前" をアイコンにする（中身のない span は置き換え、ほかは先頭に足す） */
export function fillIcons(root = document) {
  for (const el of $$("[data-ic]", root)) {
    const ic = icon(el.dataset.ic, "s");
    el.removeAttribute("data-ic");
    if (el.tagName === "SPAN" && !el.childNodes.length) el.outerHTML = ic; else el.insertAdjacentHTML("afterbegin", ic);
  }
}

/* ---------- 保存（端末ごと）---------- */
export const store = {
  get(k, d = null) { try { const v = localStorage.getItem("rt:" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("rt:" + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem("rt:" + k); } catch {} },
};
/** 端末ごとの好み（名前・見た目など） */
export const prefs = {
  get() { return { name: "", theme: "auto", resume: true, ...(store.get("prefs") ?? {}) }; },
  set(patch) { const p = { ...prefs.get(), ...patch }; store.set("prefs", p); applyTheme(); return p; },
};
export function applyTheme() {
  const t = prefs.get().theme;
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
applyTheme();

/* ---------- サーバーとのやりとり ---------- */
export async function api(path, body, opts = {}) {
  let r;
  try {
    r = await fetch(path, { method: body !== undefined ? "POST" : "GET", headers: body !== undefined ? { "Content-Type": "application/json" } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined, cache: "no-store", keepalive: !!opts.keepalive });
  } catch {
    const e = new Error("サーバーに接続できません"); e.offline = true; conn.fail(); throw e;
  }
  conn.good();
  let j = null;
  try { j = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(j?.error || `エラーが起きました（${r.status}）`); e.status = r.status; e.data = j; throw e; }
  return j;
}
/** 作業フォルダ内のファイルのURL */
export const fileUrl = (rel) => "/file/" + rel.split("/").map(encodeURIComponent).join("/");

/* 接続の見張り：切れたら上にお知らせ、戻ったら消す */
export const conn = {
  ok: true, listeners: new Set(), el: null,
  fail() {
    if (!this.ok) return;
    this.ok = false;
    this.el = document.createElement("div");
    this.el.className = "notice err"; this.el.setAttribute("role", "status");
    this.el.innerHTML = `${icon("wifiOff")}<span>サーバーにつながりません。つながりしだい続きを保存します</span>`;
    document.body.append(this.el);
    this.listeners.forEach((f) => f(false));
  },
  good() {
    if (this.ok) return;
    this.ok = true; this.el?.remove(); this.el = null;
    toast("つながりました", { kind: "ok" });
    this.listeners.forEach((f) => f(true));
  },
  on(f) { this.listeners.add(f); },
};
setInterval(() => { if (!conn.ok) fetch("/api/health", { cache: "no-store" }).then((r) => r.ok && conn.good()).catch(() => {}); }, 4000);

/* ---------- 通知 ---------- */
let toastBox;
export function toast(msg, { kind = "info", action, timeout } = {}) {
  toastBox ??= Object.assign(document.createElement("div"), { className: "toasts" });
  if (!toastBox.isConnected) { toastBox.setAttribute("aria-live", "polite"); document.body.append(toastBox); }
  const ic = { ok: "checkCircle", err: "x", claude: "spark", info: "msg" }[kind] ?? "msg";
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = `${icon(ic)}<span class="msg">${esc(msg)}</span>${action ? `<button class="btn sm">${action.icon ? icon(action.icon, "s") : ""}${esc(action.label)}</button>` : ""}<button class="btn ghost icon sm" aria-label="閉じる">${icon("x", "s")}</button>`;
  let timer;
  const close = () => { clearTimeout(timer); el.classList.add("out"); setTimeout(() => el.remove(), 200); };
  const arm = () => { clearTimeout(timer); timer = setTimeout(close, timeout ?? (action ? 7000 : 3000)); };
  if (action) el.querySelector(".btn:not(.ghost)").onclick = () => { close(); action.fn(); };
  el.querySelector(".btn.ghost").onclick = close;
  // マウスを乗せている間は消さない（「元に戻す」を押す前に消えないように）
  el.addEventListener("pointerenter", () => clearTimeout(timer));
  el.addEventListener("pointerleave", arm);
  toastBox.append(el);
  while (toastBox.children.length > 3) toastBox.firstChild.remove();
  arm();
  return close;
}
/** ボタンを一瞬 ✓ にする（コピーしたときなど、文字の通知の代わり） */
export function flashDone(btn, ms = 1200) {
  if (!btn) return;
  const keep = btn.innerHTML;
  btn.classList.add("did");
  const ic = btn.querySelector(".i");
  if (ic) ic.outerHTML = icon("check", ic.classList.contains("s") ? "s" : ""); else btn.insertAdjacentHTML("afterbegin", icon("check", "s"));
  setTimeout(() => { btn.classList.remove("did"); btn.innerHTML = keep; }, ms);
}
export async function copyText(text, btn) {
  try { await navigator.clipboard.writeText(text); } catch {
    // http で開いているとき（LAN で共有など）は clipboard が使えないので、昔ながらのやり方で
    const ta = Object.assign(document.createElement("textarea"), { value: text }); ta.style.cssText = "position:fixed;opacity:0";
    document.body.append(ta); ta.select();
    const ok = document.execCommand("copy"); ta.remove();
    if (!ok) return toast("コピーできませんでした", { kind: "err" });
  }
  if (btn?.isConnected) flashDone(btn); else toast("コピーしました", { kind: "ok", timeout: 1600 });
}

/* ---------- ふきだしの説明：title を持つものにマウスを乗せると出る ---------- */
(function tooltips() {
  if (matchMedia("(hover: none)").matches) return;
  let tip = null, timer = null, cur = null;
  const hide = () => { clearTimeout(timer); timer = null; tip?.remove(); tip = null; cur = null; };
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const el = e.target.closest("[title], [data-tip]");
    if (el === cur) return;
    hide();
    if (!el) return;
    // 本物の title はブラウザの説明と二重になるので data-tip へ移す（読み上げ用に aria-label も残す）
    if (el.hasAttribute("title")) {
      const t = el.getAttribute("title"); el.removeAttribute("title");
      if (!t) return;
      el.dataset.tip = t;
      if (!el.getAttribute("aria-label") && !el.textContent.trim()) el.setAttribute("aria-label", t);
    }
    if (!el.dataset.tip) return;
    cur = el;
    timer = setTimeout(() => {
      if (!cur?.isConnected) return;
      tip = document.createElement("div");
      tip.className = "tt"; tip.textContent = cur.dataset.tip; tip.setAttribute("role", "tooltip");
      document.body.append(tip);
      const r = cur.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      const top = r.top - h - 8 > 4 ? r.top - h - 8 : r.bottom + 8;
      tip.style.left = clamp(r.left + r.width / 2 - w / 2, 6, innerWidth - w - 6) + "px"; tip.style.top = top + "px";
    }, 380);
  });
  document.addEventListener("pointerout", (e) => { if (cur && !cur.contains(e.relatedTarget)) hide(); });
  addEventListener("pointerdown", hide, true); addEventListener("keydown", hide, true); addEventListener("scroll", hide, true);
})();

/* ---------- ダイアログ ---------- */
const openModals = [];
export function modal({ title, body, foot, wide, onClose, label }) {
  const back = document.createElement("div");
  back.className = "modal-back";
  back.innerHTML = `<div class="modal ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(label ?? title ?? "")}">
    ${title ? `<div class="modal-head"><h2>${title}</h2><span class="grow"></span><button class="btn ghost icon" data-close aria-label="閉じる">${icon("x")}</button></div>` : ""}
    <div class="modal-body scroll"></div>${foot ? `<div class="modal-foot"></div>` : ""}</div>`;
  const box = back.firstElementChild;
  const bodyEl = box.querySelector(".modal-body");
  if (typeof body === "string") bodyEl.innerHTML = body; else if (body) bodyEl.append(body);
  if (foot) { const f = box.querySelector(".modal-foot"); if (typeof foot === "string") f.innerHTML = foot; else f.append(foot); }
  const prevFocus = document.activeElement;
  const close = () => {
    if (!back.isConnected) return;
    back.remove(); openModals.splice(openModals.indexOf(api_), 1);
    document.removeEventListener("keydown", onKey, true); onClose?.(); prevFocus?.focus?.();
  };
  const onKey = (e) => {
    if (openModals[openModals.length - 1] !== api_) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") { // ダイアログの中だけを行き来する
      const f = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', box).filter((x) => !x.disabled && x.offsetParent);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  };
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
  box.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKey, true);
  document.body.append(back);
  const api_ = { el: box, body: bodyEl, close };
  openModals.push(api_);
  setTimeout(() => (box.querySelector("[autofocus]") ?? box.querySelector(".modal-body input, .modal-body textarea, .modal-foot .btn.primary, .modal-foot .btn") ?? box).focus?.(), 30);
  return api_;
}
export const anyModal = () => openModals.length > 0;
/** ダイアログの下のボタン列（display:contents の入れ物） */
export const footer = (html) => Object.assign(document.createElement("div"), { style: "display:contents", innerHTML: html });
export function confirmBox(msg, { ok = "OK", danger } = {}) {
  return new Promise((res) => {
    const f = footer(`<button class="btn" data-close>やめる</button><button class="btn ${danger ? "danger" : "primary"}" data-ok>${esc(ok)}</button>`);
    let v = false;
    const m = modal({ title: "確認", body: `<p style="margin:4px 0 0;line-height:1.8">${msg}</p>`, foot: f, onClose: () => res(v) });
    f.querySelector("[data-ok]").onclick = () => { v = true; m.close(); };
  });
}
export function lightbox(src) {
  const el = document.createElement("div");
  el.className = "lightbox"; el.innerHTML = `<img alt="" src="${esc(src)}" />`;
  const close = () => { el.remove(); document.removeEventListener("keydown", k, true); };
  const k = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  el.onclick = close; document.addEventListener("keydown", k, true);
  document.body.append(el);
}

/* ---------- ポップオーバー（選ぶ一覧・メニュー） ---------- */
let openPop = null;
export function popover(anchor, content, { width = 420, align = "center", onClose } = {}) {
  openPop?.close();
  const el = document.createElement("div");
  el.className = "pop"; el.setAttribute("role", "dialog");
  if (typeof content === "string") el.innerHTML = content; else el.append(content);
  document.body.append(el);
  anchor.setAttribute("aria-expanded", "true");
  const place = () => {
    if (!anchor.isConnected) return close();
    const r = anchor.getBoundingClientRect();
    const w = Math.min(width, innerWidth - 16);
    el.style.width = w + "px";
    let x = align === "right" ? r.right - w : align === "left" ? r.left : r.left + r.width / 2 - w / 2;
    x = clamp(x, 8, innerWidth - w - 8);
    // 下に入らなければ上に出す
    const below = r.bottom + 8, h = el.offsetHeight;
    el.style.left = x + "px";
    el.style.top = (below + h > innerHeight - 8 && r.top - h - 8 > 8 ? r.top - h - 8 : below) + "px";
  };
  place();
  const close = () => {
    if (openPop !== api_) return;
    openPop = null; el.remove(); anchor.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", out, true); document.removeEventListener("keydown", key, true); removeEventListener("resize", place);
    onClose?.();
  };
  const out = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) close(); };
  const key = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); anchor.focus?.(); } };
  setTimeout(() => document.addEventListener("mousedown", out, true), 0);
  document.addEventListener("keydown", key, true);
  addEventListener("resize", place);
  const api_ = { el, close, place };
  openPop = api_;
  return api_;
}
/** メニュー：items = [{label, icon, fn, danger, hint}] と区切り "-"。↑↓で選べる */
export function menu(anchor, items, opts = {}) {
  const box = document.createElement("div");
  box.className = "pop-body menu"; box.setAttribute("role", "menu");
  box.innerHTML = items.map((it, i) => (it === "-" ? `<div class="sep"></div>` : `<button class="opt ${it.danger ? "danger" : ""}" role="menuitem" data-i="${i}">${it.icon ? icon(it.icon, "s") : ""}<span class="grow">${esc(it.label)}</span>${it.hint ? `<span class="meta">${esc(it.hint)}</span>` : ""}</button>`)).join("");
  const p = popover(anchor, box, { width: opts.width ?? 260, align: opts.align ?? "right" });
  box.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) { p.close(); items[Number(b.dataset.i)].fn(); } });
  box.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const opts_ = $$(".opt", box), i = opts_.indexOf(document.activeElement);
    opts_[(i + (e.key === "ArrowDown" ? 1 : -1) + opts_.length) % opts_.length]?.focus();
  });
  box.querySelector(".opt")?.focus();
  return p;
}
/**
 * 探せる一覧（動画・構成メモを選ぶ）
 * items: 並べるもの / group(x): 見出し / row(x): ボタンの中身 / match(x, q): 検索 / selected(x) / onPick(x)
 * foot: 下の欄のHTML（[data-reload] があれば onReload を呼んで描き直す）
 */
export function listPicker(anchor, { items, group, row, match, selected, onPick, placeholder, foot = "", empty = "見つかりません", width = 580, onReload, onFoot }) {
  const box = document.createElement("div");
  box.style.display = "contents";
  box.innerHTML = `<div class="pop-head"><div class="searchbox">${icon("search", "s")}<input class="input" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" /></div></div>
    <div class="pop-body scroll" role="listbox"></div><div class="pop-foot">${foot}</div>`;
  const pop = popover(anchor, box, { width });
  const input = box.querySelector("input"), body = box.querySelector(".pop-body");
  let hl = 0, flat = [];
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const list = items().filter((x) => !q || match(x, q));
    const groups = new Map();
    for (const x of list) { const g = group(x); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(x); }
    flat = []; hl = clamp(hl, 0, Math.max(0, list.length - 1));
    let html = "";
    for (const [g, xs] of groups) {
      html += `<div class="group">${icon("folder", "s")}<span class="ellipsis">${esc(g)}</span><span class="grow"></span><span class="num">${xs.length}</span></div>`;
      for (const x of xs) { const i = flat.push(x) - 1; html += `<button class="opt ${i === hl ? "hl" : ""}" role="option" aria-selected="${!!selected(x)}" data-i="${i}">${row(x)}</button>`; }
    }
    body.innerHTML = html || `<div class="empty-opt">${empty}</div>`;
    body.querySelector(".hl")?.scrollIntoView({ block: "nearest" });
  };
  draw(); pop.place(); input.focus();
  input.addEventListener("input", () => { hl = 0; draw(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); hl = Math.min(flat.length - 1, hl + 1); draw(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); hl = Math.max(0, hl - 1); draw(); }
    else if (e.key === "Enter" && flat[hl] && !e.isComposing) { e.preventDefault(); pop.close(); onPick(flat[hl]); }
  });
  body.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) { pop.close(); onPick(flat[Number(b.dataset.i)]); } });
  const rl = box.querySelector("[data-reload]");
  if (rl) rl.onclick = async () => { rl.querySelector(".i")?.classList.add("spin"); await onReload?.(); draw(); rl.querySelector(".i")?.classList.remove("spin"); };
  onFoot?.(box, pop);
  return pop;
}
/** 上のバー（と狭い画面では本文の上）に「選ぶボタン」を置く */
export function mountPicker({ ic, title, sub = "", badge = "", tip, onOpen }) {
  const html = `<button class="picker-btn" data-pick aria-haspopup="dialog" aria-expanded="false" title="${esc(tip)}">${icon(ic)}
    <span class="grow"><span class="ttl ellipsis block">${esc(title)}</span>${sub ? `<span class="sub ellipsis block">${esc(sub)}</span>` : ""}</span>${badge}${icon("down", "s")}</button>`;
  // 中身が同じなら作り直さない（開いている一覧の位置がずれたり、ふきだしが消えたりしないように）
  for (const slot of [$("#pickerSlot"), $("#mPickSlot")]) if (slot && slot.dataset.html !== html) { slot.innerHTML = html; slot.dataset.html = html; }
  $$("[data-pick]").forEach((b) => (b.onclick = () => onOpen(b)));
}
/** 今見えている方の「選ぶボタン」 */
export const visiblePicker = () => $$("[data-pick]").find((b) => b.offsetParent) ?? $("[data-pick]");

/* ---------- 指でスワイプ（カードを右・左へ払う） ----------
 * right/left: { icon, when?(el), run(el), away? }  away=true なら払ったカードをそのまま外へ飛ばす（削除） */
export function swipeable(container, selector, { right, left }) {
  let st = null, justSwiped = false;
  const TH = () => Math.min(110, st.el.offsetWidth * 0.32);
  container.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || e.target.closest("textarea, input, select, [data-noswipe]")) return;
    const el = e.target.closest(selector);
    if (el) st = { el, x: e.clientX, y: e.clientY, dx: 0, on: false, id: e.pointerId, armed: false };
  });
  container.addEventListener("pointermove", (e) => {
    if (!st || e.pointerId !== st.id) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!st.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { st = null; return; }
      if (Math.abs(dx) < 12) return;
      st.on = true; st.el.classList.add("swiping");
      try { st.el.setPointerCapture(e.pointerId); } catch {}
      st.under = document.createElement("div"); st.under.className = "swipe-under";
      Object.assign(st.under.style, { top: st.el.offsetTop + "px", left: st.el.offsetLeft + "px", width: st.el.offsetWidth + "px", height: st.el.offsetHeight + "px" });
      st.el.before(st.under);
    }
    const side = dx > 0 ? right : left;
    const ok = side && side.when?.(st.el) !== false;
    st.dx = ok ? dx : dx * 0.15; // 払えない向きは少しだけ動いて戻る
    st.el.style.transform = `translateX(${st.dx}px)`;
    const armed = ok && Math.abs(dx) > TH();
    if (armed && !st.armed) navigator.vibrate?.(8);
    st.armed = armed;
    st.under.className = `swipe-under ${dx > 0 ? "right" : "left"} ${armed ? "armed" : ""}`;
    st.under.innerHTML = ok ? icon(typeof side.icon === "function" ? side.icon(st.el) : side.icon) : "";
  });
  const end = (e) => {
    if (!st || e.pointerId !== st.id) return;
    const s = st; st = null;
    if (!s.on) return;
    justSwiped = true; setTimeout(() => (justSwiped = false), 60);
    const side = s.dx > 0 ? right : left;
    const commit = e.type === "pointerup" && s.armed && side; // 途中で取り消された（スクロールに変わった等）ときは何もしない
    const back = () => { s.under.remove(); s.el.classList.remove("swiping"); s.el.style.transform = ""; };
    // 動きの終わりを待たずにタイマーで進める（見えていないタブでは動きが止まるため）
    if (commit && side.away) {
      s.el.animate([{ transform: `translateX(${s.dx}px)` }, { transform: `translateX(${Math.sign(s.dx) * (s.el.offsetWidth + 40)}px)`, opacity: 0 }], { duration: 180, easing: "ease-in", fill: "forwards" });
      setTimeout(() => { back(); side.run(s.el); }, 180);
      return;
    }
    s.el.animate([{ transform: `translateX(${s.dx}px)` }, { transform: "none" }], commit ? { duration: 260, easing: "cubic-bezier(.34,1.56,.64,1)" } : { duration: 200, easing: "ease-out" });
    s.el.style.transform = "";
    setTimeout(back, commit ? 260 : 200);
    if (commit) side.run(s.el);
  };
  container.addEventListener("pointerup", end); container.addEventListener("pointercancel", end);
  container.addEventListener("click", (e) => { if (justSwiped) { e.stopPropagation(); e.preventDefault(); } }, true);
}

/* ---------- 人の印 ---------- */
export const colorOf = (name) => { let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 55% 48%)`; };
export const avatar = (name, claude) => (claude ? `<span class="avatar claude" title="Claude">${icon("spark")}</span>` : `<span class="avatar" style="--c:${colorOf(name || "?")}" title="${esc(name || "")}">${esc((name || "?").trim().slice(0, 1).toUpperCase())}</span>`);

/* ---------- Claude への依頼の進み具合（送信→受付→対応中→完了）をアイコンでつなぐ ---------- */
export const STEPS = [["sent", "send", "送信"], ["received", "inbox", "Claudeが受付"], ["working", "spark", "Claudeが対応中"], ["done", "check", "完了"]];
export const LIVE = { sent: "送信済み", received: "Claude 受付済み", working: "Claude 対応中", done: "完了" };
export function stepper(r) {
  const si = STEPS.findIndex((s) => s[0] === r.status), fin = r.status === "done";
  return `<div class="stepper ${fin ? "fin" : ""}" role="img" aria-label="${esc(LIVE[r.status] ?? "")}">${STEPS.map(([, ic, label], i) =>
    `${i ? `<span class="ln ${i <= si ? "on" : ""}"></span>` : ""}<span class="s ${fin ? "" : i < si ? "on" : i === si ? "now" : ""}" title="${label}">${icon(ic, "s")}</span>`).join("")}</div>`;
}

/* ---------- 作業フォルダの設定（分類タグなど）：1回だけ読む ---------- */
export const workspace = {
  settings: { workspaceName: "", tags: [] }, _p: null,
  load(force) { if (!this._p || force) this._p = api("/api/settings").then((s) => (this.settings = s)).catch(() => this.settings); return this._p; },
};
/** タブの題名：「中身｜画面｜作業フォルダ名」 */
let pageName = "";
export function setTitle(what) {
  const ws = workspace.settings.workspaceName;
  document.title = [what, pageName, ws].filter(Boolean).join("｜");
}

/* ---------- 上のバー ---------- */
export function mountTopbar(page) {
  pageName = page === "plan" ? "構成メモ" : page === "catalog" ? "演出カタログ" : page === "image" ? "画像レビュー" : "動画レビュー";
  const el = $("#topbar");
  el.className = "topbar";
  el.innerHTML = `
    <a class="brand" href="/" aria-label="レビューツール"><span class="logo">${icon("logo")}</span><span class="name" id="brandName">レビューツール</span></a>
    <nav class="tabs" aria-label="ページ">
      <a href="/" ${page === "review" ? 'aria-current="page"' : ""}>${icon("film", "s")}動画レビュー</a>
      <a href="/image" ${page === "image" ? 'aria-current="page"' : ""}>${icon("image", "s")}画像レビュー</a>
      <a href="/plan" ${page === "plan" ? 'aria-current="page"' : ""}>${icon("doc", "s")}構成メモ</a>
      <a href="/catalog" ${page === "catalog" ? 'aria-current="page"' : ""}>${icon("spark", "s")}演出カタログ</a>
    </nav>
    <div class="slot" id="pickerSlot"></div>
    <div class="right">
      <span class="save-state" id="saveState" role="status"></span>
      <button class="claude-pill" id="claudePill" type="button" aria-label="Claudeとの連携"><span class="face">${icon("spark")}<span class="dot"></span></span><span class="txt"></span></button>
      <button class="btn ghost icon" id="settingsBtn" title="設定">${icon("settings")}</button>
      <button class="btn ghost icon" id="helpBtn" title="使い方（?）">${icon("help")}</button>
    </div>`;
  workspace.load().then((s) => { if (s.workspaceName) $("#brandName").textContent = s.workspaceName; });
  let restTimer;
  return {
    /** 保存の状態：busy＝回るアイコン／ok＝雲に✓（少しして薄くなる）／err＝赤い雲と短い文字 */
    setSave(state, text = "") {
      const s = $("#saveState");
      clearTimeout(restTimer);
      if (!state) { s.className = "save-state"; s.innerHTML = ""; return; }
      s.className = `save-state ${state}`;
      const ic = state === "err" ? icon("cloudOff", "s") : state === "busy" ? icon("refresh", "s spin") : icon("cloudCheck", "s");
      s.innerHTML = `${ic}${state === "err" ? `<span class="txt">${esc(text.split("（")[0])}</span>` : ""}`;
      s.dataset.tip = text || (state === "ok" ? "保存済み" : state === "busy" ? "保存中…" : "");
      s.setAttribute("aria-label", s.dataset.tip);
      if (state === "ok") restTimer = setTimeout(() => s.classList.add("rest"), 1800);
    },
    setClaude({ alive, busy, text }) {
      const b = $("#claudePill");
      b.className = `claude-pill ${busy ? "busy" : alive ? "on" : ""}`;
      b.querySelector(".dot").className = `dot ${alive && !busy ? "live" : ""}`;
      b.querySelector(".txt").textContent = busy ? text || "対応中" : "";
      b.dataset.tip = busy ? `${text || "Claude 対応中"}` : alive ? "Claude 待機中：送るとすぐ届きます" : "Claude オフライン：送った内容は受付箱に残り、あとで拾われます";
      b.setAttribute("aria-label", b.dataset.tip);
    },
  };
}
/** Claudeの状態の説明（上のバーの顔を押したとき） */
export function claudeInfo(anchor, alive) {
  const box = document.createElement("div");
  box.className = "pop-body";
  box.style.padding = "14px 16px";
  const cmd = "node review-tool/listen.mjs";
  box.innerHTML = `
    <div class="row" style="gap:10px;margin-bottom:10px">${avatar("", true)}<b>${alive ? "Claude 待機中" : "Claude オフライン"}</b><span class="dot ${alive ? "live" : ""}" style="margin-left:auto"></span></div>
    <p class="help-text" style="margin:0 0 12px;font-size:var(--fs-s)">${alive ? "送るとすぐ届きます。進み具合と返事はこの画面に出ます。" : "送った内容は受付箱に残り、Claude が来たら拾います。"}</p>
    ${alive ? "" : `<div class="label" style="margin-bottom:6px">Claude Code で待ち受ける</div><div class="code-row"><code>${cmd}</code><button class="btn sm" data-copy title="コピー">${icon("copy", "s")}</button></div>`}`;
  box.querySelector("[data-copy]")?.addEventListener("click", (e) => copyText(cmd, e.currentTarget));
  popover(anchor, box, { width: 340, align: "right" });
}

/* ---------- 設定 ---------- */
export function openSettings({ onChange } = {}) {
  const p = prefs.get(), ws = workspace.settings;
  const tags = (ws.tags ?? []).map((t) => ({ ...t }));
  const body = document.createElement("div");
  const tagRows = () => tags.map((t, i) => `<div class="t"><input type="color" value="${esc(t.color)}" data-c="${i}" aria-label="色" /><input class="input" value="${esc(t.name)}" data-n="${i}" maxlength="20" aria-label="分類の名前" placeholder="分類の名前" /><button class="btn ghost icon" data-del="${i}" title="この分類を消す">${icon("trash", "s")}</button></div>`).join("");
  body.innerHTML = `
    <div class="section-title" style="margin-top:4px">${icon("user", "s")} この端末</div>
    <div class="stack" style="gap:14px">
      <div class="field"><label for="setName">名前（メモとコメントに付きます）</label><input class="input" id="setName" value="${esc(p.name)}" maxlength="30" placeholder="例：やまだ" /></div>
      <div class="field"><span class="label">見た目</span><div class="seg" id="setTheme">
        <button data-v="auto" title="端末に合わせる">${icon("settings", "s")}自動</button><button data-v="dark">${icon("moon", "s")}ダーク</button><button data-v="light">${icon("sun", "s")}ライト</button></div></div>
      <label class="check"><input type="checkbox" id="setResume" ${p.resume ? "checked" : ""} />メモを保存したら続きを再生</label>
    </div>
    <div class="section-title">${icon("folder", "s")} この作業フォルダ（みんな共通）</div>
    <div class="stack" style="gap:14px">
      <div class="field"><label for="setWs">上のバーに出す名前</label><input class="input" id="setWs" value="${esc(ws.workspaceName ?? "")}" maxlength="60" placeholder="レビューツール" /></div>
      <div class="field"><span class="label">メモの分類</span><div class="tag-edit" id="tagEdit">${tagRows()}</div>
        <div><button class="btn sm" id="addTag">${icon("plus", "s")}分類</button></div></div>
    </div>`;
  const foot = footer(`<button class="btn" data-close>やめる</button><button class="btn primary" id="setSave">${icon("check", "s")}保存</button>`);
  const before = p.theme;
  let theme = p.theme, saved = false;
  const m = modal({ title: "設定", body, foot, onClose: () => { if (!saved) prefs.set({ theme: before }); } });
  const seg = body.querySelector("#setTheme");
  const paint = () => $$("button", seg).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === theme)));
  paint();
  // 見た目は押したらすぐ試せる（保存しなければ戻す）
  seg.onclick = (e) => { const b = e.target.closest("button"); if (b) { theme = b.dataset.v; paint(); prefs.set({ theme }); } };
  const te = body.querySelector("#tagEdit");
  te.addEventListener("input", (e) => { const i = e.target.dataset.n ?? e.target.dataset.c; if (i == null) return; if (e.target.dataset.n != null) tags[i].name = e.target.value; else tags[i].color = e.target.value; });
  te.addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (b) { tags.splice(Number(b.dataset.del), 1); te.innerHTML = tagRows(); } });
  body.querySelector("#addTag").onclick = () => { tags.push({ name: "", color: "#9aa3b8" }); te.innerHTML = tagRows(); te.querySelector(`[data-n="${tags.length - 1}"]`).focus(); };
  foot.querySelector("#setSave").onclick = async () => {
    try {
      workspace.settings = await api("/api/settings", { workspaceName: body.querySelector("#setWs").value.trim(), tags: tags.filter((t) => t.name.trim()) });
      workspace._p = Promise.resolve(workspace.settings);
    } catch (e) { return toast(e.message, { kind: "err" }); }
    prefs.set({ name: body.querySelector("#setName").value.trim(), theme, resume: body.querySelector("#setResume").checked });
    saved = true;
    $("#brandName").textContent = workspace.settings.workspaceName || "レビューツール";
    m.close(); onChange?.();
  };
}

/* ---------- 使い方 ---------- */
export function openHelp({ title = "使い方", intro = "", keys = [], extra = "" }) {
  const k = (s) => s.split("+").map((x) => `<span class="kbd">${esc(x)}</span>`).join("");
  modal({
    title, wide: true,
    body: `${intro}${keys.length && !matchMedia("(hover: none)").matches ? `<div class="section-title">キーボード</div><div class="keys">${keys.map(([a, b]) => `<div class="k"><span>${esc(b)}</span><span>${a.split(" / ").map(k).join('<span class="faint">/</span>')}</span></div>`).join("")}</div>` : ""}${extra}`,
  });
}
/** 3つの手順（アイコンつき） */
export const steps3 = (list) => `<div class="steps3">${list.map(([ic, t, d]) => `<div class="st"><span class="ic">${icon(ic)}</span><div><b>${t}</b><div>${d}</div></div></div>`).join("")}</div>`;

/* ---------- はじめて開いたとき ---------- */
export function welcome({ onDone } = {}) {
  if (store.get("welcomed")) return false;
  const body = document.createElement("div");
  body.innerHTML = `${steps3([["play", "見る", "気になったら止める"], ["note", "メモ", "画像に丸や矢印も"], ["send", "送る", "Claude が直して返す"]])}
    <div class="field" style="margin-top:18px"><label for="wName">あなたの名前（メモに付きます）</label><input class="input" id="wName" maxlength="30" placeholder="例：やまだ" autofocus /></div>`;
  const foot = footer(`<button class="btn" data-close>あとで</button><button class="btn primary" id="wGo">はじめる${icon("right", "s")}</button>`);
  const m = modal({ title: "ようこそ", body, foot, onClose: () => { store.set("welcomed", true); onDone?.(); } });
  const go = () => { const n = body.querySelector("#wName").value.trim(); if (n) prefs.set({ name: n }); m.close(); };
  foot.querySelector("#wGo").onclick = go;
  body.querySelector("#wName").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); go(); } });
  return true;
}
