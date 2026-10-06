/**
 * Kinetic：動く文字（リリックモーション）の本体。書き方は markup.ts、入り方・消え方・出ている間の動きはこのファイルの ENTERS / EXITS / HOLDS。
 *
 *   <Kinetic text="_TRPG風の_|*本格*[0.4]*RPG*" at={0.2} until={2.4} size={220} enter="slam" exit="blur" />
 *
 * 安っぽく見せないための約束（docs/lessons/trailer.md・ゲーム紹介動画 v1→v2）
 *   ・同じ入り方を続けない（rise／track／fade／slam を使い分け、slam は「ここぞ」だけ）
 *   ・助詞は _小さく_、キーワードは *差し色* で大きさと色に差をつける
 *   ・全部を中央に置かない。左右・上下に振る
 *   ・出ている間もゆっくり寄る（hold="drift"）。消えるときはぼけて字間が開く（exit="blur"）
 *   ・テロップに飾り（白い罫線・縁の光・小さな英字）を足さない。後ろはやわらかい暗がり（shade）で十分
 */
import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { clamp01, ease, key, prog, rand, rands, seedOf, tf, useSize, useT } from "../core";
import { fam, type FontKey, useGlyphs } from "../fonts";
import { type Ch, estimateWidth, parse, plainText } from "./markup";

/* ============================== 型 ============================== */
/** 1文字ぶんの状態（距離は em、ぼけは px） */
type CS = { x?: number; y?: number; s?: number; sx?: number; sy?: number; r?: number; rx?: number; ry?: number; skx?: number; op?: number; blur?: number; glyph?: string; weight?: number; glow?: number; white?: number };
/** かたまり全体の状態 */
type BS = { spacing?: number; blur?: number; op?: number; s?: number; x?: number; y?: number; skx?: number; mask?: string; bright?: number; jitter?: number; goo?: number; bar?: { from: number; to: number }; band?: string; outlineFirst?: number };

type Ctx = { k: number; n: number; size: number; seed: number; t: number; fr: number; dur: number; local: number };
type EnterDef = {
  /** 既定の長さ（秒）と1文字ごとのずれ（秒） */
  dur: number;
  stagger: number;
  /** マスク（文字ごとに枠で切る：下からせり上がる系） */
  clip?: boolean;
  char?: (p: number, c: Ctx) => CS;
  block?: (p: number, c: Ctx) => BS;
  note: string;
};
type ExitDef = { dur: number; stagger: number; clip?: boolean; reverse?: boolean; char?: (q: number, c: Ctx) => CS; block?: (q: number, c: Ctx) => BS; note: string };

const SCR = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFXYZ#$%&@";

/* ============================== 入り方 ============================== */
export const ENTERS = {
  rise: { dur: 0.36, stagger: 0.04, clip: true, note: "下からせり上がる（マスク）。説明・標準の入り", char: (p) => ({ y: (1 - ease.expo(p)) * 1.15 }) },
  drop: { dur: 0.36, stagger: 0.04, clip: true, note: "上から降りてくる（マスク）。rise と交互に使うと単調にならない", char: (p) => ({ y: -(1 - ease.expo(p)) * 1.15 }) },
  track: { dur: 0.55, stagger: 0, note: "字間が詰まりながらぼけから現れる。静かな一言・締めのコピー", block: (p) => { const e = ease.expo(p); return { spacing: (1 - e) * 0.6, blur: (1 - e) * 18, op: clamp01(p * 2) }; } },
  trackSlow: { dur: 1.0, stagger: 0, note: "track をゆっくり大きく。曲の静かな所・冒頭のため", block: (p) => { const e = ease.expo(p); return { spacing: (1 - e) * 0.9, blur: (1 - e) * 18, op: clamp01(p * 2) }; } },
  slam: { dur: 0.27, stagger: 0, note: "大きく出て叩きつけ（残像つき）。ここぞだけ。続けて使わない", char: (_p, c) => ({ s: key(c.local, [0, 0.1, 0.2, 0.27], [1.75, 0.95, 1.02, 1]), op: clamp01(c.local / 0.034), blur: key(c.local, [0, 0.1], [8, 0]) }) },
  stamp: { dur: 0.2, stagger: 0, note: "ハンコのように少し傾いて押される。強い断定・判定", char: (_p, c) => ({ s: key(c.local, [0, 0.12, 0.2], [2.1, 0.97, 1], ease.cubic), r: key(c.local, [0, 0.12], [-9, 0]), op: clamp01(c.local / 0.04) }) },
  type: { dur: 0.1, stagger: 0.066, note: "1文字ずつ打つ。入力・セリフ・AIの返答", char: (p) => ({ op: p > 0 ? 1 : 0, s: 1 + (1 - ease.expo(p)) * 0.3 }) },
  fade: { dur: 0.6, stagger: 0.05, note: "1文字ずつぼけからふわっと。叙情・余韻・やさしい語り", char: (p) => { const e = ease.cubic(p); return { op: e, blur: (1 - e) * 12, y: (1 - e) * 0.12 }; } },
  float: { dur: 0.7, stagger: 0.06, note: "1文字ずつ少し下から浮かび上がる。穏やか・前向き", char: (p) => { const e = ease.expo(p); return { op: clamp01(p * 1.6), y: (1 - e) * 0.5 }; } },
  pop: { dur: 0.35, stagger: 0.035, note: "ぽんっと弾んで出る。かわいい・明るい・リアクション", char: (p) => ({ s: ease.back(p), op: clamp01(p * 4) }) },
  wave: { dur: 0.45, stagger: 0.045, note: "跳ねて着地する波。楽しい・ゆるい", char: (p) => ({ y: -Math.sin(clamp01(p) * Math.PI) * 0.45, op: clamp01(p * 5), s: 0.85 + 0.15 * ease.back(p) }) },
  zoomOut: { dur: 0.6, stagger: 0, note: "手前の大きい所から引いて止まる（カメラが引く）。タイトル・宣言", block: (p) => { const e = ease.expo(p); return { s: 1 + (1 - e) * 0.6, blur: (1 - e) * 14, op: clamp01(p * 2.5) }; } },
  zoomIn: { dur: 0.7, stagger: 0, note: "遠くから近づいてくる。登場・予感", block: (p) => { const e = ease.expo(p); return { s: 0.72 + 0.28 * e, blur: (1 - e) * 10, op: clamp01(p * 2) }; } },
  wipe: { dur: 0.6, stagger: 0, note: "左から右へやわらかく拭き出す（縦書きは上から下）。説明の見出し", block: (p) => { const e = ease.inOut(p); return { mask: `linear-gradient(var(--wipe-dir), #000 ${e * 130 - 30}%, transparent ${e * 130}%)` }; } },
  light: { dur: 0.75, stagger: 0, note: "光の帯がなぞって現れる。神秘・きらめき・ロゴ", block: (p) => { const e = ease.inOut(p); const c = e * 130 - 10; return { mask: `linear-gradient(var(--wipe-dir), #000 ${c - 20}%, transparent ${c}%)`, band: `linear-gradient(var(--wipe-dir), transparent ${c - 24}%, #000 ${c - 10}%, transparent ${c + 2}%)` }; } },
  bar: { dur: 0.6, stagger: 0, note: "色の帯が走って、抜けたあとに文字が残る。シャープな見出し・章立て", block: (p) => ({ bar: { from: ease.inOut(clamp01(p * 2)), to: ease.inOut(clamp01(p * 2 - 1)) }, mask: `linear-gradient(var(--wipe-dir), #000 ${ease.inOut(clamp01(p * 2 - 0.9)) * 101}%, transparent ${ease.inOut(clamp01(p * 2 - 0.9)) * 101 + 0.5}%)` }) },
  split: { dur: 0.45, stagger: 0.03, note: "1文字ずつ左右交互から寄る。対比・テンポのいい連打", char: (p, c) => { const e = ease.expo(p); return { x: (c.k % 2 ? -1 : 1) * (1 - e) * 1.2, op: clamp01(p * 2.5), blur: (1 - e) * 6 }; } },
  flip: { dur: 0.5, stagger: 0.04, note: "1文字ずつ奥から手前へ回って起き上がる。めくる・切り替わる", char: (p) => { const e = ease.expo(p); return { rx: (1 - e) * -95, op: clamp01(p * 3), y: (1 - e) * 0.15 }; } },
  skew: { dur: 0.42, stagger: 0.02, note: "斜めに傾いて横から滑り込む。スピード・勢い", char: (p) => { const e = ease.expo(p); return { x: -(1 - e) * 2.2, skx: (1 - e) * -28, op: clamp01(p * 3), blur: (1 - e) * 10 }; } },
  scramble: { dur: 0.5, stagger: 0.035, note: "でたらめな文字が回って正しい字に決まる。AI・解析・ハッキング", char: (p, c) => (p >= 1 ? {} : { op: p > 0 ? 0.85 : 0, glyph: SCR[Math.floor(rand(Math.floor(c.fr / 2) * 7.3 + c.k * 13.1 + c.seed) * SCR.length)], white: 0.3 }) },
  flicker: { dur: 0.45, stagger: 0.05, note: "蛍光灯のように明滅してから点く。ネオン・不穏・夜", char: (p, c) => (p >= 1 ? {} : { op: p <= 0 ? 0 : rand(Math.floor(c.fr / 2) * 3.1 + c.k * 7.7 + c.seed) < 0.25 + p * 0.7 ? 1 : 0.08, glow: 1 - p }) },
  weight: { dur: 0.7, stagger: 0.03, note: "細い線から太く育つ（太さが自由な書体のみ：gothic・notoSerif・cinzel・montserrat・oswald・orbitron・playfair）", char: (p) => { const e = ease.expo(p); return { weight: 100 + e * 800, op: clamp01(p * 3) }; } },
  outline: { dur: 0.9, stagger: 0, note: "縁取りが先に描かれて、あとから中が満ちる。設計図・予告・余韻", block: (p) => ({ outlineFirst: p }) },
  melt: { dur: 0.8, stagger: 0, note: "インクがにじんで形になる（にじみの閾値）。怪奇・和・記憶", block: (p) => ({ goo: 1 - ease.cubic(p), op: clamp01(p * 3) }) },
  none: { dur: 0, stagger: 0, note: "そのまま出す", char: () => ({}) },
} satisfies Record<string, EnterDef>;
export type EnterName = keyof typeof ENTERS;

/* ============================== 消え方 ============================== */
export const EXITS = {
  blur: { dur: 0.2, stagger: 0, note: "ぼけて字間が開いて消える（既定）", block: (q) => { const e = ease.inQuad(q); return { spacing: e * 0.25, blur: e * 14, op: 1 - e }; } },
  cut: { dur: 0, stagger: 0, note: "その場で切る（連打・拍で切り替えるとき）", block: () => ({}) },
  fade: { dur: 0.3, stagger: 0, note: "そのまま薄くなる", block: (q) => ({ op: 1 - q }) },
  sink: { dur: 0.3, stagger: 0.025, clip: true, note: "下へ沈む（マスク）。rise の対", char: (q) => ({ y: ease.inCubic(q) * 1.15 }) },
  riseOut: { dur: 0.3, stagger: 0.025, clip: true, note: "上へ抜ける（マスク）。次の行が下から来るとき", char: (q) => ({ y: -ease.inCubic(q) * 1.15 }) },
  through: { dur: 0.3, stagger: 0, note: "カメラに向かって飛んでくる（拡大＋ぼけ）。次の場面へ突き抜ける", block: (q) => { const e = ease.inCubic(q); return { s: 1 + e * 0.9, blur: e * 16, op: 1 - e }; } },
  shrink: { dur: 0.3, stagger: 0, note: "小さくしぼんで消える", block: (q) => { const e = ease.inCubic(q); return { s: 1 - e * 0.35, op: 1 - e }; } },
  scatter: { dur: 0.5, stagger: 0.01, note: "文字がばらけて漂い消える。崩壊・夢の終わり", char: (q, c) => { const e = ease.inQuad(q); return { x: rands(c.k * 3.7 + c.seed) * e * 1.6, y: rands(c.k * 5.3 + c.seed) * e * 1.2 - e * 0.4, r: rands(c.k * 9.1 + c.seed) * e * 45, blur: e * 8, op: 1 - e }; } },
  fall: { dur: 0.55, stagger: 0.03, note: "1文字ずつ重力で落ちる。失敗・脱力・コミカル", char: (q, c) => ({ y: q * q * 3.2, r: rands(c.k * 4.1 + c.seed) * q * 35, op: 1 - ease.inCubic(q) }) },
  wipe: { dur: 0.4, stagger: 0, note: "左から右へ拭き消す", block: (q) => { const e = ease.inOut(q); return { mask: `linear-gradient(var(--wipe-dir), transparent ${e * 130 - 30}%, #000 ${e * 130}%)` }; } },
  glitch: { dur: 0.3, stagger: 0, note: "色ズレとガタつきで途切れる。デジタル・不穏", block: (q, c) => ({ jitter: q, op: q > 0.85 ? 0 : rand(Math.floor(c.fr) * 1.7 + c.seed) < 0.2 + q * 0.5 ? 0.3 : 1 }) },
  light: { dur: 0.35, stagger: 0, note: "白く飛んで消える（露出オーバー）。場面の白み・回想へ", block: (q) => ({ bright: q * 3, blur: q * 10, op: 1 - q * q }) },
  untype: { dur: 0.05, stagger: 0.035, reverse: true, note: "後ろの文字から1文字ずつ消える（バックスペース）。言い直し・取り消し", char: (q) => ({ op: q > 0 ? 0 : 1 }) },
} satisfies Record<string, ExitDef>;
export type ExitName = keyof typeof EXITS;

export type HoldName = "drift" | "none" | "float" | "breathe" | "sway";
export const HOLDS: Record<HoldName, string> = {
  drift: "出ている間ゆっくり寄り続ける（既定・3.5%）",
  none: "止まったまま",
  float: "1文字ずつかすかに上下する。浮遊・水中・夢",
  breathe: "ゆっくり大きさが呼吸する",
  sway: "ゆっくり左右に傾く。酔い・不安定",
};

/* ============================== 部品 ============================== */
export type KineticProps = {
  text: string;
  /** 出る秒・消え終わる秒（親の Sequence の頭から）。until を省くと消えない */
  at?: number;
  until?: number;
  /** 文字のかたまりの基準点（px、既定は画面の中央）。align で基準点のどこに合わせるか */
  x?: number;
  y?: number;
  align?: "center" | "left" | "right";
  /** 行どうしのそろえ方（既定は align と同じ）。右上に置いて左そろえ、など */
  textAlign?: "center" | "left" | "right";
  size: number;
  /** 幅がこれを超えそうなら全体を縮める（px） */
  maxW?: number;
  font?: FontKey;
  /** 英数字の書体（既定は font と同じ） */
  latin?: FontKey;
  weight?: number;
  smallWeight?: number;
  color?: string;
  /** 差し色。色か linear-gradient(...) */
  a1?: string;
  a2?: string;
  enter?: EnterName;
  exit?: ExitName;
  hold?: HoldName;
  /** 入りの長さ（秒）・1文字ずつのずれ（秒）。省くと入り方ごとの既定 */
  dur?: number;
  stagger?: number;
  exitDur?: number;
  /** [n] の単位（秒）。拍で書くなら1拍の秒 */
  unit?: number;
  /** 文字の後ろをやわらかく暗くする（0〜1、0でなし） */
  shade?: number;
  /** 影（既定あり）。false で影なし、文字列で filter の drop-shadow を差し替え */
  shadow?: boolean | string;
  /** 縁取り */
  stroke?: { w: number; color: string };
  /** 光彩（色） */
  glow?: string;
  /** 叩きつけの瞬間に赤青の残像が左右から集まる（slam・stamp 向け） */
  ghost?: boolean;
  /** slam の尾（既定あり） */
  trail?: boolean;
  vertical?: boolean;
  spacing?: number;
  lineHeight?: number;
  smallScale?: number;
  bigScale?: number;
  /** drift の寄る量（既定 0.035） */
  drift?: number;
  /** 入りの終わりに下線を引く（色） */
  underline?: string;
  /** 文字全体の傾き（度） */
  rotate?: number;
  seed?: number;
  style?: React.CSSProperties;
};

export const GOLD = "linear-gradient(180deg, #fff6da 0%, #f6d27e 38%, #d9a446 62%, #a8752a 100%)";
const isGrad = (s: string) => s.includes("gradient(");

let gooId = 0;

export const Kinetic: React.FC<KineticProps> = (p) => {
  const t = useT();
  const { w: W, h: H, fps } = useSize();
  const {
    text, at = 0, until, align = "center", size: size0, font = "mincho", latin, weight = 800, smallWeight, color = "#f7f2e6",
    a1 = GOLD, a2 = "#e3342f", enter = "rise", exit = "blur", hold = "drift", unit = 1, shade = 0, shadow = true,
    vertical = false, spacing = 0.03, lineHeight = 1.15, smallScale = 0.5, bigScale = 1.3, drift = 0.035, rotate = 0,
  } = p;
  const lines = useMemo(() => parse(text), [text]);
  const seed = p.seed ?? seedOf(text);
  const latinFont = latin ?? font;
  const plain = plainText(lines);
  useGlyphs(font, weight, plain);
  useGlyphs(font, smallWeight ?? Math.min(weight, 500), plain);
  if (latinFont !== font) useGlyphs(latinFont, weight, plain.replace(/[^\x20-\x7e]/g, ""));
  const gid = useMemo(() => `kgoo${gooId++}`, []);

  const E: EnterDef = ENTERS[enter];
  const X: ExitDef = EXITS[exit];
  const dur = p.dur ?? E.dur;
  const stagger = p.stagger ?? E.stagger;
  const exitDur = p.exitDur ?? X.dur;
  const fr = Math.round(t * fps);
  const total = lines.reduce((a, l) => a + l.length, 0);
  const lastStart = at + (total - 1) * stagger + Math.max(0, ...lines.flat().map((c) => c.dt * unit));
  if (t < at || (until !== undefined && t >= until)) return null;

  // 幅に収める
  const wEst = Math.max(...lines.map((l) => estimateWidth(l, smallScale, bigScale, spacing)));
  const size = p.maxW && !vertical ? Math.min(size0, p.maxW / Math.max(0.1, wEst)) : size0;

  // かたまり全体：入り（最初の文字の時刻）／消え
  const bIn = E.block ? E.block(dur > 0 ? clamp01((t - at) / dur) : 1, { k: 0, n: total, size, seed, t, fr, dur, local: t - at }) : {};
  const exitStart = until === undefined ? Infinity : until - exitDur - (total - 1) * X.stagger;
  const qBlock = until === undefined ? 0 : exitDur > 0 ? clamp01((t - exitStart) / exitDur) : 0;
  const bOut = X.block && t >= exitStart ? X.block(qBlock, { k: 0, n: total, size, seed, t, fr, dur: exitDur, local: t - exitStart }) : {};
  const B: BS = { ...bIn };
  B.spacing = (bIn.spacing ?? 0) + (bOut.spacing ?? 0);
  B.blur = (bIn.blur ?? 0) + (bOut.blur ?? 0);
  B.op = (bIn.op ?? 1) * (bOut.op ?? 1);
  B.s = (bIn.s ?? 1) * (bOut.s ?? 1);
  B.mask = bOut.mask ?? bIn.mask;
  B.bright = bOut.bright;
  B.jitter = bOut.jitter;

  // 出ている間
  const holdEnd = until ?? at + 6;
  let holdS = 1, holdR = 0;
  if (hold === "drift") holdS = 1 + drift * prog(t, at, holdEnd);
  if (hold === "breathe") holdS = 1 + 0.018 * Math.sin((t - at) * Math.PI);
  if (hold === "sway") holdR = Math.sin((t - at) * 1.3) * 1.6;

  const anchorX = p.x ?? W / 2;
  const anchorY = p.y ?? H / 2;
  const tx = align === "center" ? "-50%" : align === "right" ? "-100%" : "0%";
  const origin = align === "left" ? "0% 50%" : align === "right" ? "100% 50%" : "50% 50%";
  const spacingEm = spacing + (B.spacing ?? 0);

  // 1文字ごとの進み具合
  const charIn = (ch: Ch, k: number) => {
    const t0 = at + ch.dt * unit + k * stagger;
    const local = t - t0;
    const pr = dur > 0 ? clamp01(local / dur) : local >= 0 ? 1 : 0;
    return { pr: local < 0 ? -1 : pr, local, t0 };
  };
  const charOut = (k: number) => {
    if (until === undefined || !X.char) return null;
    const s0 = exitStart + (X.reverse ? total - 1 - k : k) * X.stagger;
    if (t < s0) return null;
    return { q: exitDur > 0 ? clamp01((t - s0) / exitDur) : 1, local: t - s0 };
  };

  const fillOf = (ch: Ch): React.CSSProperties => {
    const col = ch.a1 ? a1 : ch.a2 ? a2 : color;
    if (ch.outline) return { color: "transparent", WebkitTextStroke: `${Math.max(1.5, size * 0.012)}px ${isGrad(col) ? "#f6d27e" : col}` };
    if (isGrad(col)) return { backgroundImage: col, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" };
    return { color: col };
  };

  type Mode = "main" | "red" | "blue" | "trail" | "outline" | "band";
  const charView = (ch: Ch, k: number, mode: Mode, trailScale = 1) => {
    const { pr, local } = charIn(ch, k);
    const ctx: Ctx = { k, n: total, size, seed, t, fr, dur, local };
    let st: CS = {};
    if (pr < 0) st = { op: 0 };
    else if (E.char && (pr < 1 || enter === "slam" || enter === "stamp")) st = E.char(pr, ctx);
    const o = charOut(k);
    if (o && X.char) {
      const so = X.char(o.q, { ...ctx, local: o.local });
      st = { ...st, x: (st.x ?? 0) + (so.x ?? 0), y: (st.y ?? 0) + (so.y ?? 0), r: (st.r ?? 0) + (so.r ?? 0), blur: (st.blur ?? 0) + (so.blur ?? 0), op: (st.op ?? 1) * (so.op ?? 1) };
    }
    const chSize = size * (ch.small ? smallScale : ch.big ? bigScale : 1);
    const famCss = fam(ch.latin ? latinFont : font);
    const wt = st.weight ?? (ch.small ? smallWeight ?? Math.min(weight, 500) : weight);
    // 震え
    let jx = 0, jy = 0, jr = 0;
    if (ch.shake && pr >= 0) {
      const q = Math.floor(fr / 2);
      jx = rands(q * 7 + ch.i) * chSize * 0.025;
      jy = rands(q * 13 + ch.i * 3) * chSize * 0.025;
      jr = rands(q * 5 + ch.i) * 2;
    }
    if (hold === "float" && pr >= 1) jy += Math.sin((t - at) * 2.2 + k * 0.7) * chSize * 0.04;
    // 赤青の残像・尾
    let gx = 0, op = st.op ?? 1;
    if (mode === "red" || mode === "blue") {
      const gc = local < 0 ? 0 : key(local, [0, 0.3], [1, 0], ease.quad);
      gx = (mode === "red" ? -1 : 1) * chSize * 0.45 * gc;
      op *= 0.75 * gc;
    } else if (mode === "trail") op *= local < 0 ? 0 : key(local, [0, 0.2], [1, 0]);
    const solid = mode === "red" ? "#ff3b3b" : mode === "blue" ? "#3bb8ff" : mode === "band" ? "#fffdf4" : null;
    let fill: React.CSSProperties = solid ? { color: solid } : fillOf(ch);
    if (mode === "outline") fill = { color: "transparent", WebkitTextStroke: `${Math.max(1.5, size * 0.012)}px ${isGrad(ch.a1 ? a1 : color) ? "#f6d27e" : ch.a1 ? a1 : ch.a2 ? a2 : color}` };
    const filt: string[] = [];
    if ((st.blur ?? 0) > 0.15) filt.push(`blur(${st.blur}px)`);
    if (st.white) filt.push(`brightness(${1 + st.white})`);
    const glowCss = st.glow ? { textShadow: `0 0 ${chSize * 0.15}px rgba(255,255,255,${0.8 * st.glow})` } : p.glow && mode === "main" ? { textShadow: `0 0 ${chSize * 0.12}px ${p.glow}, 0 0 ${chSize * 0.3}px ${p.glow}` } : {};
    const strokeCss = p.stroke && mode === "main" && !ch.outline ? { WebkitTextStroke: `${p.stroke.w}px ${p.stroke.color}`, paintOrder: "stroke fill" } : {};
    const transform = tf({ x: (st.x ?? 0) * chSize + jx + gx, y: (st.y ?? 0) * chSize + jy, s: (st.s ?? 1) * trailScale, sx: st.sx, sy: st.sy, r: (st.r ?? 0) + jr, rx: st.rx, skx: st.skx });
    const glyph = ch.dash ? (
      // 線（──）：字間を打ち消して、文字の高さの真ん中に1本
      <span style={{ display: "inline-block", [vertical ? "height" : "width"]: `${ch.dash}em`, [vertical ? "width" : "height"]: "0.075em", fontSize: chSize, verticalAlign: vertical ? undefined : "0.32em", margin: vertical ? "0.08em 0.46em" : "0 0 0 0.08em", marginRight: vertical ? undefined : `-${spacingEm}em`,
        transform, transformOrigin: vertical ? "50% 0%" : "0% 50%", opacity: op, background: solid ?? (ch.a1 ? a1 : ch.a2 ? a2 : color), filter: filt.join(" ") || undefined }} />
    ) : (
      <span style={{ display: "inline-block", fontFamily: famCss, fontWeight: wt, fontSize: chSize, lineHeight, transform, opacity: op, filter: filt.join(" ") || undefined, position: "relative", ...fill, ...strokeCss, ...glowCss }}>
        {st.glyph ?? (ch.c === " " ? "\u00a0" : ch.c)}
        {ch.ruby && (
          <span style={{ position: "absolute", left: vertical ? "100%" : "50%", top: vertical ? "50%" : "-0.05em", transform: vertical ? "translate(0.1em,-50%)" : "translate(-50%,-100%)", fontSize: "0.32em", fontWeight: 500, whiteSpace: "nowrap", letterSpacing: "0.05em", writingMode: vertical ? "vertical-rl" : undefined, ...fill }}>{ch.ruby}</span>
        )}
      </span>
    );
    const clip = (E.clip && pr < 1) || (X.clip && o);
    return clip ? (
      <span key={ch.i} style={{ display: "inline-block", overflow: "hidden", padding: vertical ? "0 0.08em" : "0.08em 0 0.02em", verticalAlign: "baseline", perspective: enter === "flip" ? 600 : undefined }}>{glyph}</span>
    ) : (
      <span key={ch.i} style={{ display: "inline-block", perspective: enter === "flip" ? 600 : undefined }}>{glyph}</span>
    );
  };

  const wd = vertical ? "180deg" : "90deg";
  const ow = B.outlineFirst === undefined ? 0 : ease.inOut(clamp01(B.outlineFirst / 0.6)) * 120;
  const outlineMask = B.outlineFirst === undefined ? undefined : `linear-gradient(var(--wipe-dir), #000 ${ow - 20}%, transparent ${ow}%)`;
  const maskOf = (m?: string): React.CSSProperties => (m ? { WebkitMaskImage: m.split("var(--wipe-dir)").join(wd), maskImage: m.split("var(--wipe-dir)").join(wd) } : {});
  const block = (mode: Mode, trailScale = 1, extra: React.CSSProperties = {}, inner: React.CSSProperties = {}) => {
    let k = 0;
    const jit = B.jitter ? { x: rands(fr * 1.3 + seed) * size * 0.08 * B.jitter, y: rands(fr * 2.1 + seed) * size * 0.02 * B.jitter } : { x: 0, y: 0 };
    return (
      <div style={{ position: "absolute", left: anchorX + (B.x ?? 0) + jit.x, top: anchorY + (B.y ?? 0) + jit.y, transform: `translate(${tx}, -50%) scale(${holdS * (B.s ?? 1)}) rotate(${rotate + holdR}deg)${B.skx ? ` skewX(${B.skx}deg)` : ""}`, transformOrigin: origin,
        textAlign: p.textAlign ?? align, whiteSpace: "nowrap", letterSpacing: `${spacingEm}em`, writingMode: vertical ? "vertical-rl" : undefined, ...extra }}>
        {/* 色の帯（bar）：文字のかたまりの大きさに合わせて走る */}
        {B.bar && mode === "main" && (
          <div style={{ position: "absolute", inset: vertical ? "-0.1em 0" : "0.04em -0.1em", overflow: "hidden" }}>
            <div style={{ position: "absolute", [vertical ? "left" : "top"]: 0, [vertical ? "right" : "bottom"]: 0, [vertical ? "top" : "left"]: `${Math.min(1, B.bar.to) * 100}%`, [vertical ? "height" : "width"]: `${Math.max(0, B.bar.from - B.bar.to) * 100}%`, background: isGrad(a1) ? "#d9a446" : a1 }} />
          </div>
        )}
        <div style={{ ...maskOf(mode === "band" ? B.band : mode === "outline" ? outlineMask : B.mask), ...inner }}>
          {lines.map((l, li) => (
            <div key={li} style={{ lineHeight: vertical ? 1.05 : 1.12, [vertical ? "marginLeft" : "marginTop"]: li ? size * 0.05 : 0 }}>
              {l.map((ch) => charView(ch, k++, mode, trailScale))}
            </div>
          ))}
        </div>
        {/* 下線：入りの終わりから引く */}
        {p.underline && mode === "main" && (() => {
          const u = prog(t, lastStart + dur * 0.6, lastStart + dur * 0.6 + 0.4, ease.expo);
          return <div style={{ position: "absolute", [vertical ? "right" : "left"]: vertical ? "-0.25em" : 0, [vertical ? "top" : "bottom"]: vertical ? 0 : "-0.12em", [vertical ? "height" : "width"]: "100%", [vertical ? "width" : "height"]: Math.max(3, size * 0.035), fontSize: size, background: p.underline, transform: vertical ? `scaleY(${u})` : `scaleX(${u})`, transformOrigin: vertical ? "50% 0%" : "0% 50%" }} />;
        })()}
      </div>
    );
  };

  // slam の尾・残像は、どれかの文字が出て間もない間だけ
  const recent = (sec: number) => {
    let k = 0;
    return lines.some((l) => l.some((ch) => { const c = t - (at + ch.dt * unit + k++ * stagger); return c >= 0 && c < sec; }));
  };
  const trail = (p.trail ?? true) && (enter === "slam" || enter === "stamp") && recent(0.2);
  const ghost = !!p.ghost && recent(0.3);

  const drop = shadow === true ? `drop-shadow(0 ${size * 0.03}px ${size * 0.12}px rgba(0,0,0,0.85))` : shadow || "";
  const filters = [B.blur && B.blur > 0.2 ? `blur(${B.blur}px)` : "", B.bright ? `brightness(${1 + B.bright})` : "", B.goo ? `url(#${gid})` : "", drop].filter(Boolean).join(" ");
  const shadeOp = shade > 0 ? key(t - at, [0, 0.2], [0, 1]) * (B.op ?? 1) : 0;
  const nMax = Math.max(...lines.map((l) => l.length));
  const ew = vertical ? lines.length * size * 1.2 : wEst * size, eh = vertical ? nMax * size : lines.length * size * 1.15;
  const sx = anchorX + (align === "left" ? ew / 2 : align === "right" ? -ew / 2 : 0);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", ...p.style }}>
      {B.goo ? (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <filter id={gid} x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation={B.goo * size * 0.09} />
            <feColorMatrix type="matrix" values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${18} ${-7 - B.goo * 2}`} />
          </filter>
        </svg>
      ) : null}
      {shadeOp > 0 && (
        <div style={{ position: "absolute", left: sx - ew * 0.75 - size, top: anchorY - eh * 0.9 - size * 0.5, width: ew * 1.5 + size * 2, height: eh * 1.8 + size,
          background: `radial-gradient(closest-side, rgba(2,3,7,${shade}) 0%, rgba(2,3,7,${shade * 0.6}) 50%, transparent 100%)`, opacity: shadeOp }} />
      )}
      <AbsoluteFill style={{ opacity: B.op, filter: filters || undefined }}>
        {trail && (<>{block("trail", 1.25, { opacity: 0.22 })}{block("trail", 1.55, { opacity: 0.1 })}</>)}
        {(ghost || B.jitter) && (<>{block("red", 1, { mixBlendMode: "screen", marginLeft: -size * 0.06 * (B.jitter ?? 0) })}{block("blue", 1, { mixBlendMode: "screen", marginLeft: size * 0.06 * (B.jitter ?? 0) })}</>)}
        {B.outlineFirst !== undefined ? (
          <>
            {block("outline")}
            {block("main", 1, {}, { opacity: ease.cubic(clamp01((B.outlineFirst - 0.45) / 0.55)) })}
          </>
        ) : block("main")}
      </AbsoluteFill>
      {B.band && (
        <AbsoluteFill style={{ opacity: B.op, mixBlendMode: "screen", filter: `blur(1px) drop-shadow(0 0 ${size * 0.08}px rgba(255,240,200,0.9))` }}>
          {block("band")}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

/** 入り方・消え方の一覧（見本ギャラリーとカタログ用） */
export const ENTER_LIST = Object.entries(ENTERS).map(([k, v]) => ({ key: k as EnterName, note: v.note }));
export const EXIT_LIST = Object.entries(EXITS).map(([k, v]) => ({ key: k as ExitName, note: v.note }));
