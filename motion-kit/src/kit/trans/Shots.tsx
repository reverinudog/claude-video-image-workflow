/**
 * ショットを並べて、切り替わりにつなぎ（トランジション）を入れる。
 *
 *   <Shots shots={[
 *     { len: 2.4, node: <A /> },
 *     { len: 1.6, node: <B />, in: { type: "whip", dir: "left" } },   // A→B を横に流してつなぐ
 *     { len: 3.2, node: <C />, in: { type: "iris", x: 1400, y: 500 } },
 *   ]} />
 *
 * ・つなぎは切り替わりの瞬間（各ショットの頭）をまたいで dur 秒（前後半分ずつ）重なる。拍に合わせた切り替わりの位置は変わらない
 * ・ショットの中の 0 秒は切り替わりの瞬間（つなぎの前半は負の秒）。kit の部品（useT）はこれに合わせて動く
 * ・つなぎは「意味があるときだけ」。毎回派手なつなぎを挟まない（visual-design.md「無関係な派手な切り替えを毎回挟む」）
 *   基本は cut。場面が変わる区切りに fade／dipBlack、勢いを出す連打に whip／slide、ここぞの転換に zoom／iris／glitch
 */
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01, ease, key, prog, rand, TimeShift, useSize } from "../core";
import { Glitch } from "../fx/filters";

export type TransName = keyof typeof TRANS;
export type TransIn = { type: TransName; dur?: number; dir?: "left" | "right" | "up" | "down"; x?: number; y?: number; color?: string };
export type ShotDef = { len: number; node: React.ReactNode; in?: TransIn; name?: string };

/** つなぎの一覧（既定の長さ・使いどころ） */
export const TRANS = {
  cut: { dur: 0, note: "そのまま切る（基本）" },
  fade: { dur: 0.5, note: "重ねて入れ替わる。静かな場面の移り" },
  dipBlack: { dur: 0.8, note: "いったん黒に落ちて次へ。章・時間の区切り" },
  dipWhite: { dur: 0.6, note: "白く飛んで次へ。回想・まぶしい・ため→どどーん" },
  flash: { dur: 0.25, note: "切り替わりの瞬間に一瞬光る。拍の頭・叩きつけ" },
  wipe: { dur: 0.5, note: "やわらかい境目で拭き取る。説明の場面の移り" },
  diag: { dur: 0.45, note: "斜めの鋭い境目＋光の線。シャープ・スポーツ" },
  iris: { dur: 0.6, note: "丸く開いて次が見える（x・y が中心）。注目・のぞき込む" },
  square: { dur: 0.55, note: "四角く開く。謎・正体" },
  blinds: { dur: 0.55, note: "ブラインドのような縞で入れ替わる。レトロ・テンポ" },
  slide: { dur: 0.45, note: "押し出して横から入る。並べて見せる・次の項目" },
  whip: { dur: 0.3, note: "素早く横に流す（ぶれ）。勢い・連打・場所の移動" },
  zoom: { dur: 0.5, note: "前の画面に突っ込んで抜けた先が次。突入・本題へ" },
  cube: { dur: 0.6, note: "立方体が回るように入れ替わる。画面の切り替え・比較" },
  glitch: { dur: 0.3, note: "色ズレとノイズで切り替わる。デジタル・AI・不穏" },
  ink: { dur: 0.8, note: "にじむ形で広がる。和・怪奇・記憶" },
  shutter: { dur: 0.5, note: "上下から閉じて開く。カメラ・場面の確定" },
  doors: { dur: 0.6, note: "前の画面が左右に割れて開く。開幕・扉" },
  lightLeak: { dur: 0.8, note: "暖かい光が漏れながら入れ替わる。懐かしさ・青春" },
} as const;
export const TRANS_LIST = Object.entries(TRANS).map(([k, v]) => ({ key: k as TransName, note: v.note }));

/** ある瞬間の前後のショット A（出ていく）・B（入ってくる）の見た目 */
type Look = { a: React.CSSProperties; b: React.CSSProperties; over?: React.ReactNode; aWrap?: (n: React.ReactNode) => React.ReactNode; bWrap?: (n: React.ReactNode) => React.ReactNode; bOnTop?: boolean };

const vec = (dir: TransIn["dir"]) => (dir === "right" ? [1, 0] : dir === "up" ? [0, -1] : dir === "down" ? [0, 1] : [-1, 0]);

const look = (tr: TransIn, p: number, W: number, H: number, cutAt: number): Look => {
  const [vx, vy] = vec(tr.dir);
  const deg = vx > 0 ? 270 : vy < 0 ? 0 : vy > 0 ? 180 : 90; // 進む向きの linear-gradient の角度
  const cx = tr.x ?? W / 2, cy = tr.y ?? H / 2;
  const e = ease.inOut(p);
  switch (tr.type) {
    case "fade": return { a: {}, b: { opacity: e } };
    case "dipBlack": return { a: { opacity: 1 - prog(p, 0, 0.5, ease.inOut) }, b: { opacity: prog(p, 0.5, 1, ease.inOut) } };
    case "dipWhite": return { a: { opacity: p < 0.5 ? 1 : 0 }, b: { opacity: p >= 0.5 ? 1 : 0 }, over: <AbsoluteFill style={{ background: tr.color ?? "#fffaf0", opacity: key(p, [0, 0.5, 1], [0, 1, 0], ease.inOut) }} /> };
    case "flash": return { a: { opacity: p < 0.5 ? 1 : 0 }, b: { opacity: p >= 0.5 ? 1 : 0 }, over: <AbsoluteFill style={{ background: tr.color ?? "#fff8e8", opacity: key(p, [0.35, 0.5, 1], [0, 0.85, 0]) }} /> };
    case "wipe": { const c = e * 130 - 15; const m = `linear-gradient(${deg}deg, #000 ${c - 15}%, transparent ${c}%)`; return { a: {}, b: { WebkitMaskImage: m, maskImage: m } }; }
    case "diag": {
      // 境目は上が先に進む斜めの線。dir="right" なら右から左へ
      const s = e * (W + H * 0.6) - H * 0.3;
      const right = tr.dir === "right";
      const top = right ? W - s - H * 0.3 : s + H * 0.3, bot = right ? W - s + H * 0.3 : s - H * 0.3;
      return { a: {}, b: { clipPath: right ? `polygon(${top}px 0, 100% 0, 100% 100%, ${bot}px 100%)` : `polygon(0 0, ${top}px 0, ${bot}px 100%, 0 100%)` },
        over: p > 0.02 && p < 0.98 ? <svg width={W} height={H} style={{ position: "absolute", mixBlendMode: "screen", filter: "drop-shadow(0 0 10px rgba(255,220,150,0.9))" }}><line x1={top} y1={0} x2={bot} y2={H} stroke="rgba(255,240,210,0.9)" strokeWidth={6} /></svg> : null };
    }
    case "iris": { const r = ease.inCubic(p) * Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)); return { a: {}, b: { clipPath: `circle(${r}px at ${cx}px ${cy}px)` } }; }
    case "square": { const s = ease.inCubic(p) * Math.max(W, H) * 0.75; return { a: {}, b: { clipPath: `inset(${Math.max(0, cy - s)}px ${Math.max(0, W - cx - s)}px ${Math.max(0, H - cy - s)}px ${Math.max(0, cx - s)}px)` } }; }
    case "blinds": { const bw = 120; const m = `repeating-linear-gradient(${deg}deg, #000 0px, #000 ${e * bw}px, transparent ${e * bw}px, transparent ${bw}px)`; return { a: {}, b: { WebkitMaskImage: m, maskImage: m } }; }
    case "slide": { const q = ease.inOut(p); return { a: { transform: `translate(${vx * W * q}px, ${vy * H * q}px)` }, b: { transform: `translate(${-vx * W * (1 - q)}px, ${-vy * H * (1 - q)}px)` } }; }
    case "whip": {
      const q = Easing5(p);
      const sp = Math.sin(Math.PI * p); // ぶれの量
      const blur = (n: React.ReactNode, id: string) => <HBlur id={id} amount={sp * 40} vertical={vy !== 0}>{n}</HBlur>;
      return { a: { transform: `translate(${vx * W * q}px, ${vy * H * q}px)` }, b: { transform: `translate(${-vx * W * (1 - q)}px, ${-vy * H * (1 - q)}px)` }, aWrap: (n) => blur(n, "whipA"), bWrap: (n) => blur(n, "whipB") };
    }
    case "zoom": {
      return { a: { transform: `scale(${1 + 1.2 * ease.inCubic(clamp01(p / 0.6))})`, opacity: 1 - prog(p, 0.35, 0.6), filter: `blur(${16 * prog(p, 0.1, 0.6)}px)` },
        b: { transform: `scale(${0.8 + 0.2 * prog(p, 0.4, 1, ease.expo)})`, opacity: prog(p, 0.4, 0.65), filter: `blur(${10 * (1 - prog(p, 0.4, 0.9))}px)` },
        over: <AbsoluteFill style={{ background: "#fff8e8", opacity: key(p, [0.4, 0.5, 0.75], [0, 0.35, 0]) }} /> };
    }
    case "cube": {
      // 画面の奥 W/2 にある立方体の中心のまわりを回す。A は正面→左の面、B は右の面→正面。
      // 重なりの前後は CSS では決まらないので、半分までは A を手前、半分からは B を手前に
      const q = ease.inOut(p);
      const s = vx > 0 ? -1 : 1; // dir="right" なら逆回り
      const P = W * 1.6, phi = 90 * q * s;
      const face = (rot: number) => `perspective(${P}px) translateZ(${-W / 2}px) rotateY(${rot}deg) translateZ(${W / 2}px)`;
      return { a: { transform: face(-phi), filter: `brightness(${1 - 0.55 * q})` }, b: { transform: face(90 * s - phi), filter: `brightness(${0.45 + 0.55 * q})` }, bOnTop: p >= 0.5 };
    }
    case "glitch": { const d = tr.dur ?? TRANS.glitch.dur; return { a: { opacity: p < 0.5 ? 1 : 0 }, b: { opacity: p >= 0.5 ? 1 : 0 }, aWrap: (n) => <Glitch at={cutAt - d / 2} dur={d} power={1}>{n}</Glitch>, bWrap: (n) => <Glitch at={cutAt - d / 2} dur={d} power={1} seed={3}>{n}</Glitch> }; }
    case "ink": {
      const r = ease.inCubic(p) * Math.hypot(W, H) * 0.62;
      const sc = 60 + 120 * Math.sin(Math.PI * p);
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'><filter id='f' x='-50%' y='-50%' width='200%' height='200%'><feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='3' seed='4'/><feDisplacementMap in='SourceGraphic' scale='${sc}'/><feGaussianBlur stdDeviation='3'/></filter><circle cx='${cx}' cy='${cy}' r='${r}' fill='black' filter='url(#f)'/></svg>`;
      const m = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
      return { a: {}, b: { WebkitMaskImage: m, maskImage: m, WebkitMaskSize: "100% 100%" } };
    }
    case "shutter": {
      const c = key(p, [0, 0.5, 1], [0, 1, 0], ease.inOut);
      return { a: { opacity: p < 0.5 ? 1 : 0 }, b: { opacity: p >= 0.5 ? 1 : 0 }, over: <><div style={{ position: "absolute", left: 0, right: 0, top: 0, height: (H / 2) * c, background: "#050505" }} /><div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: (H / 2) * c, background: "#050505" }} /></> };
    }
    case "doors": {
      const q = ease.inCubic(p);
      return { a: {}, b: {}, bOnTop: false, aWrap: (n) => (
        <AbsoluteFill>
          <AbsoluteFill style={{ clipPath: "inset(0 50% 0 0)", transform: `translateX(${-W * 0.5 * q}px)` }}>{n}</AbsoluteFill>
          <AbsoluteFill style={{ clipPath: "inset(0 0 0 50%)", transform: `translateX(${W * 0.5 * q}px)` }}>{n}</AbsoluteFill>
        </AbsoluteFill>
      ) };
    }
    case "lightLeak": {
      const pk = Math.sin(Math.PI * p);
      return { a: {}, b: { opacity: ease.inOut(p) }, over: <AbsoluteFill style={{ mixBlendMode: "screen", opacity: pk, background: `radial-gradient(ellipse 60% 90% at ${20 + 60 * p}% 40%, rgba(255,150,60,0.9), transparent 70%), radial-gradient(ellipse 40% 60% at ${90 - 50 * p}% 70%, rgba(255,220,140,0.7), transparent 70%)` }} /> };
    }
    default: return { a: {}, b: {} };
  }
};

// whip 用：真ん中で一番速い（前半は加速、後半は減速）
const Easing5 = (p: number) => (p < 0.5 ? 16 * p ** 5 : 1 - Math.pow(-2 * p + 2, 5) / 2);

/** 横（または縦）だけのぶれ */
const HBlur: React.FC<{ id: string; amount: number; vertical?: boolean; children: React.ReactNode }> = ({ id, amount, vertical, children }) => {
  if (amount < 0.5) return <AbsoluteFill>{children}</AbsoluteFill>;
  const fid = `${id}${Math.round(rand(amount) * 1e6)}`;
  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{ position: "absolute" }}><filter id={fid} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation={vertical ? `0 ${amount}` : `${amount} 0`} /></filter></svg>
      <AbsoluteFill style={{ filter: `url(#${fid})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/** ショットを並べる。start＝最初のショットの頭（秒） */
export const Shots: React.FC<{ shots: ShotDef[]; start?: number }> = ({ shots, start = 0 }) => {
  const fr = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { w, h } = useSize();
  const t = fr / fps;
  // 各ショットの切り替わりの時刻
  const cuts: number[] = [];
  let acc = start;
  for (const s of shots) { cuts.push(acc); acc += s.len; }
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {shots.map((s, i) => {
        const tin = s.in && s.in.type !== "cut" ? s.in.dur ?? TRANS[s.in.type].dur : 0;
        const next = shots[i + 1];
        const tout = next?.in && next.in.type !== "cut" ? next.in.dur ?? TRANS[next.in.type].dur : 0;
        const a = cuts[i] - tin / 2, b = cuts[i] + s.len + tout / 2;
        const f0 = Math.round(a * fps), f1 = Math.round(b * fps);
        if (fr < f0 || fr >= f1) return null;
        // 入りのつなぎの中か／出のつなぎの中か
        let style: React.CSSProperties = {}, wrap = (n: React.ReactNode) => n, over: React.ReactNode = null, z = 1;
        if (tin > 0 && t < cuts[i] + tin / 2) {
          // ショットの中の時間では、切り替わりの瞬間＝入ってくるショットの 0 秒・出ていくショットの len 秒
          const L = look(s.in!, clamp01((t - a) / tin), w, h, 0);
          style = L.b; wrap = L.bWrap ?? wrap; over = L.over; z = L.bOnTop === false ? 0 : 2;
        } else if (tout > 0 && t >= cuts[i + 1] - tout / 2) {
          const L = look(next!.in!, clamp01((t - (cuts[i + 1] - tout / 2)) / tout), w, h, s.len);
          style = L.a; wrap = L.aWrap ?? wrap; z = L.bOnTop === false ? 2 : 1;
        }
        return (
          <React.Fragment key={i}>
            <Sequence from={f0} durationInFrames={f1 - f0} name={s.name ?? `shot ${i + 1}`} layout="none">
              <TimeShift.Provider value={cuts[i] - a}>
                <AbsoluteFill style={{ ...style, zIndex: z }}>{wrap(s.node)}</AbsoluteFill>
              </TimeShift.Provider>
            </Sequence>
            {over && <AbsoluteFill style={{ zIndex: 3, pointerEvents: "none" }}>{over}</AbsoluteFill>}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

/** ショットの合計の長さ（秒） */
export const shotsLen = (shots: ShotDef[]) => shots.reduce((a, s) => a + s.len, 0);
