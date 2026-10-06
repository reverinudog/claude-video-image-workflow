// 演出カタログ：motion-kit の部品を、短い動画（映像）と再生ボタン（効果音）で一覧する。
// データは /api/catalog（motion-kit/catalog/data.json。node motion-kit/tools/catalog.mjs で作る）
import { $, $$, esc, icon, iconBtn, api, fileUrl, mountTopbar, setTitle, claudeInfo, openSettings, openHelp, modal, store } from "./common.js";

const bar = mountTopbar("catalog");
setTitle("");
const S = { data: null, group: store.get("catGroup", "all"), q: "", alive: false };

// 迷ったときの出発点（motion-kit/CATALOG.md「場面ごとの組み合わせ」と同じ）。名前を押すとその部品へ
const RECIPES = [
  { t: "解説・PR（ナレーションあり）", text: ["band", "bubble", "rise"], fx: ["Flash＋Shake＋FocusLines", "Figure（立ち絵）"], tr: ["slide"], se: ["pop", "sparkle"] },
  { t: "ゲームのトレーラー", text: ["rise", "drop", "slam"], fx: ["embers", "Sparks＋Burst"], tr: ["whip", "zoom", "dipWhite"], se: ["riser_4s", "boom", "whoosh_short"] },
  { t: "怪奇・ミステリー", text: ["fade", "melt", "縦書き"], fx: ["Fog（霧）", "Spotlight", "horror", "Glitch"], tr: ["dipBlack", "ink", "glitch"], se: ["drone_dark", "tension", "braam", "stinger"] },
  { t: "ポップ・リアクション", text: ["pop", "wave", "stamp", "variety"], fx: ["Halftone（網点）", "Confetti"], tr: ["slide", "iris"], se: ["pop", "chime_ok", "buzz_ng"] },
  { t: "デジタル・AI", text: ["scramble", "type", "flicker"], fx: ["Scanlines（走査線）", "Glitch", "ChromaticAberration"], tr: ["glitch", "blinds"], se: ["glitch", "zap", "blip"] },
  { t: "締め・ロゴ", text: ["zoomOut", "light", "trackSlow"], fx: ["Aurora", "Flare"], tr: ["dipWhite"], se: ["sub_long", "shimmer_up"] },
];

const keyOf = (name) => { const i = name.indexOf("："); return i >= 0 ? name.slice(i + 1) : name; };
const kindOf = (name) => { const i = name.indexOf("："); return i >= 0 ? name.slice(0, i) : ""; };
const clipUrl = (id, ext) => fileUrl(`motion-kit/catalog/clips/${id}.${ext}`);
const seUrl = (n) => fileUrl(`motion-kit/public/se/${n}.wav`);

async function load() {
  try { S.data = await api("/api/catalog"); }
  catch (e) { $("#main").innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  renderBar(); render();
}

function groups() {
  const g = [];
  for (const it of S.data.items) if (!g.includes(it.group)) g.push(it.group);
  return [...g, "効果音"];
}

function renderBar() {
  const counts = {};
  for (const it of S.data.items) counts[it.group] = (counts[it.group] ?? 0) + 1;
  counts["効果音"] = S.data.se.length;
  const chip = (k, label, n) => `<button class="cat-chip" data-g="${esc(k)}" aria-pressed="${S.group === k}">${esc(label)}${n !== undefined ? `<span class="n">${n}</span>` : ""}</button>`;
  $("#catBar").innerHTML = `
    <label class="searchbox">${icon("search", "s")}<input class="input" id="q" type="search" placeholder="探す（例：怪奇・slam・祝い）" aria-label="探す" /></label>
    <div class="cat-chips" role="toolbar" aria-label="分類">${chip("all", "すべて")}${chip("recipes", "迷ったら")}${groups().map((g) => chip(g, g, counts[g])).join("")}</div>
    <span id="motionSlot"></span>`;
  const motionBtn = () => {
    const on = motionOn();
    $("#motionSlot").innerHTML = iconBtn(on ? "pause" : "play", on ? "一覧の動きを止める（端末が重いとき）" : "一覧を動かす", `id="motionBtn" aria-pressed="${on}"`);
    $("#motionBtn").onclick = () => { store.set("catMotion", !motionOn()); motionBtn(); wire(); };
  };
  motionBtn();
  $("#q").value = S.q;
  $("#q").oninput = (e) => { S.q = e.target.value.trim(); render(); };
  $$(".cat-chip").forEach((b) => (b.onclick = () => { S.group = b.dataset.g; store.set("catGroup", S.group); $$(".cat-chip").forEach((x) => x.setAttribute("aria-pressed", x === b)); render(); window.scrollTo({ top: 0 }); }));
}

const match = (s) => !S.q || s.toLowerCase().includes(S.q.toLowerCase());

function render() {
  const d = S.data;
  const showG = (g) => S.group === "all" || S.group === g;
  let html = S.group === "all" && !S.q ? `<p class="cat-intro">${icon("spark", "s")} 一覧はぜんぶループで動きます（重いときはバーの ⏸ で止められます）。押すと大きく見られます。指示は「<b>slam</b> で」「<b>つなぎ：whip</b> にして」のように名前で伝えればそのまま通じます。（${esc(d.made)} 更新）</p>` : "";
  // 迷ったとき用の組み合わせは文章が多いので、「すべて」では一番下に（まず映像の一覧を見せる）
  if (S.group === "recipes" && !S.q) html += recipesHtml();
  let any = false;
  for (const g of groups()) {
    if (!showG(g)) continue;
    if (g === "効果音") {
      const se = d.se.filter((e) => match(`${e.name} ${e.note} ${e.cat}`));
      if (!se.length) continue;
      any = true;
      html += `<section class="cat-sec" id="sec-se"><h2>効果音<span class="n">${se.length}</span></h2><p class="sub">Python で合成した音（ダウンロード不要）。押すと鳴ります。長さは拍に合わせて作り直せます</p><div class="se-list">${se.map(seHtml).join("")}</div></section>`;
      continue;
    }
    const items = d.items.filter((it) => it.group === g && match(`${it.name} ${it.note} ${it.group}`));
    if (!items.length) continue;
    any = true;
    html += `<section class="cat-sec"><h2>${esc(g)}<span class="n">${items.length}</span></h2><div class="cat-grid">${items.map(cardHtml).join("")}</div></section>`;
  }
  if (S.group === "all" && !S.q) html += recipesHtml();
  if (!any && S.group !== "recipes") html += `<div class="empty">見つかりません</div>`;
  $("#main").innerHTML = html;
  wire();
}

const cardHtml = (it) => `
  <div class="card" tabindex="0" role="button" data-id="${it.id}" data-key="${esc(keyOf(it.name))}" data-name="${esc(it.name)}" aria-label="${esc(it.name)}を大きく見る">
    <div class="media"><img src="${clipUrl(it.id, "jpg")}" alt="" loading="lazy" /><span class="play">${icon("expand", "s")}</span></div>
    <div class="body"><div class="ttl">${kindOf(it.name) ? `<span class="kind">${esc(kindOf(it.name))}</span>` : ""}<span class="key" title="${esc(keyOf(it.name))}">${esc(keyOf(it.name))}</span></div>${it.note ? `<div class="note">${esc(it.note)}</div>` : ""}</div>
  </div>`;

const seHtml = (e) => `
  <div class="se" data-se="${esc(e.name)}" data-key="${esc(e.name)}">
    <button class="pbtn" aria-label="${esc(e.name)}を鳴らす" title="鳴らす">${icon("play", "s")}<span class="bar" style="width:0"></span></button>
    <div class="grow"><div class="row"><span class="name">${esc(e.name)}</span><span class="meta">${esc(e.cat)}・${e.dur.toFixed(2)}秒</span></div><div class="note">${esc(e.note)}</div></div>
  </div>`;

function recipesHtml() {
  const pk = (k) => `<button class="pk" data-jump="${esc(k)}">${esc(k)}</button>`;
  const row = (label, ks) => `<div class="row2"><b>${label}</b>${ks.map(pk).join("")}</div>`;
  return `<section class="cat-sec" id="sec-recipes"><h2>迷ったら：場面ごとの組み合わせ</h2><p class="sub">出発点の例。題材に合わせて変えます。名前を押すとその部品へ</p><div class="recipes">${RECIPES.map((r) => `<div class="recipe"><h3>${esc(r.t)}</h3>${row("文字", r.text)}${row("効果", r.fx)}${row("つなぎ", r.tr)}${row("音", r.se)}</div>`).join("")}</div></section>`;
}

/* ---------- 一覧の動画は全部ループで動かす（重くしない工夫つき） ----------
 * ・一覧用の軽い動画（384x216・24fps、_s.mp4）を使う。大きく見るときだけ 960x540
 * ・画面の近く（上下 600px）に来たものだけ動画を付けて再生、離れたら止める
 * ・さらに遠く（上下 2000px の外）に出たら動画を外して、ブラウザの再生器とメモリを返す
 * ・再生が始まるまでは静止画を見せる（黒くならない）。タブが裏に回ったら全部止める
 * ・上のバーの「動き」ボタンで全部止められる（端末が重いとき） */
let near, far;
const motionOn = () => store.get("catMotion", true);
function attach(card) {
  const media = card.querySelector(".media");
  let v = media.querySelector("video");
  if (!v) {
    v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = "auto";
    v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("disablepictureinpicture", "");
    v.className = "loop";
    v.addEventListener("playing", () => card.classList.add("live"), { once: true });
    v.src = clipUrl(`${card.dataset.id}_s`, "mp4");
    media.append(v);
  }
  if (!document.hidden) v.play().then(() => card.classList.remove("blocked")).catch(() => card.classList.add("blocked"));
}
function detach(card) {
  const v = card.querySelector("video.loop");
  if (!v) return;
  v.pause(); v.removeAttribute("src"); v.load(); v.remove();
  card.classList.remove("live");
}
function wire() {
  near?.disconnect(); far?.disconnect();
  const cards = $$(".card");
  if (motionOn()) {
    near = new IntersectionObserver((ents) => {
      for (const e of ents) {
        if (e.isIntersecting) attach(e.target);
        else e.target.querySelector("video.loop")?.pause();
      }
    }, { rootMargin: "600px 0px" });
    far = new IntersectionObserver((ents) => { for (const e of ents) if (!e.isIntersecting) detach(e.target); }, { rootMargin: "2000px 0px" });
    cards.forEach((c) => { near.observe(c); far.observe(c); });
  } else cards.forEach(detach);
  cards.forEach((c) => {
    c.onclick = () => openBig(c.dataset.id);
    c.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBig(c.dataset.id); } };
  });
  $$(".se").forEach((row) => { row.onclick = () => playSe(row); });
  $$("[data-jump]").forEach((b) => (b.onclick = () => jump(b.dataset.jump)));
}
// タブが裏に回ったら全部止め、戻ったら見えている所だけ再開
document.addEventListener("visibilitychange", () => {
  const vs = $$("video.loop");
  if (document.hidden) vs.forEach((v) => v.pause());
  else if (motionOn()) $$(".card").forEach((c) => { const v = c.querySelector("video.loop"); if (v) { const r = c.getBoundingClientRect(); if (r.bottom > -600 && r.top < innerHeight + 600) v.play().catch(() => {}); } });
});

/* ---------- 効果音 ---------- */
let audio = null, audioRow = null, raf = 0;
function playSe(row) {
  const stop = () => { audio?.pause(); audioRow?.classList.remove("on"); if (audioRow) { audioRow.querySelector(".pbtn").innerHTML = `${icon("play", "s")}<span class="bar" style="width:0"></span>`; } cancelAnimationFrame(raf); };
  const same = audioRow === row && audio && !audio.paused;
  stop();
  if (same) { audio = audioRow = null; return; }
  audio = new Audio(seUrl(row.dataset.se)); audioRow = row;
  row.classList.add("on");
  row.querySelector(".pbtn").innerHTML = `${icon("pause", "s")}<span class="bar" style="width:0"></span>`;
  audio.volume = 0.8;
  audio.play().catch(() => {});
  audio.onended = stop;
  const tick = () => { const b = row.querySelector(".bar"); if (b && audio.duration) b.style.width = `${(audio.currentTime / audio.duration) * 100}%`; raf = requestAnimationFrame(tick); };
  tick();
}

/* ---------- 大きく見る（前後の部品へ移れる） ---------- */
function openBig(id) {
  const list = $$(".card").map((c) => c.dataset.id);
  let i = list.indexOf(id);
  const body = document.createElement("div");
  body.className = "big";
  const show = () => {
    const it = S.data.items.find((x) => x.id === list[i]);
    body.innerHTML = `<video src="${clipUrl(it.id, "mp4")}" autoplay muted loop playsinline controls></video>
      <div class="key">${esc(it.name)}</div><div class="note">${esc(it.note || "")}</div>
      <div class="how">${esc(it.group)}　｜　指示のときは「${esc(keyOf(it.name))}」の名前で伝えればそのまま通じます</div>
      <div class="nav">${iconBtn("left", "前の部品（←）", 'data-prev', "")}${iconBtn("right", "次の部品（→）", 'data-next', "")}<span class="grow"></span><span class="faint num">${i + 1} / ${list.length}</span></div>`;
    body.querySelector("[data-prev]").onclick = () => { i = (i - 1 + list.length) % list.length; show(); };
    body.querySelector("[data-next]").onclick = () => { i = (i + 1) % list.length; show(); };
  };
  show();
  const onKey = (e) => { if (e.key === "ArrowLeft") body.querySelector("[data-prev]")?.click(); if (e.key === "ArrowRight") body.querySelector("[data-next]")?.click(); };
  document.addEventListener("keydown", onKey);
  modal({ title: "演出を大きく見る", body, wide: true, onClose: () => document.removeEventListener("keydown", onKey) });
}

/* ---------- 迷ったら → 部品へ ---------- */
function jump(k) {
  const find = () => $$("[data-key]").find((c) => c.dataset.key === k) ?? $$("[data-name]").find((c) => c.dataset.name.includes(k));
  let el = find();
  if (!el) { S.group = "all"; S.q = ""; renderBar(); render(); el = find(); }
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("hit");
  setTimeout(() => el.classList.remove("hit"), 1800);
}

/* ---------- 上のバー ---------- */
async function health() {
  try { const h = await api("/api/health"); S.alive = h.alive; bar.setClaude({ alive: h.alive }); } catch { bar.setClaude({ alive: false }); }
}
$("#claudePill").onclick = (e) => claudeInfo(e.currentTarget, S.alive);
$("#settingsBtn").onclick = () => openSettings({ onChange: () => {} });
$("#helpBtn").onclick = () => openHelp({
  title: "演出カタログの使い方",
  intro: `<p>motion-kit（動画の部品箱）の部品を、短い動画で一覧しています。上の分類で絞り込み、検索で「怪奇」「祝い」のように使いどころからも探せます。</p>
    <p>動画を押すと大きく見られます（← → で前後の部品へ）。効果音は行を押すと鳴ります。</p>
    <p>気に入った部品は「動画レビュー」のメモや構成メモで、名前（例：<b>slam</b>・<b>つなぎ：whip</b>）を書けばそのまま通じます。</p>`,
  keys: [["← / →", "大きく見ているときに前後の部品へ"], ["Esc", "閉じる"]],
});
health(); setInterval(health, 15000);
load();
