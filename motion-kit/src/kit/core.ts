/**
 * motion-kit の土台：時間・進み具合・イージング・乱数・画面の大きさ。
 * 部品はすべて「親の Sequence の頭からの秒」で動く（at / until は秒）。拍で書きたいときは beatGrid() の vb() で秒にする。
 */
import React, { createContext, useContext } from "react";
import { Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

export type Pt = [number, number];

/**
 * 時間のずらし（秒）。Shots（つなぎ）は前後のショットを少し重ねて描くので、ショットの中の 0 秒を「切り替わりの瞬間」に合わせるためにずらす。
 * Shots の中で自分で Sequence を入れ子にするときは、kit の Seq を使う（ずらしを 0 に戻す）
 */
export const TimeShift = createContext(0);

/** 親の Sequence の頭からの秒（Shots の中では切り替わりの瞬間から） */
export const useT = () => {
  const fr = useCurrentFrame();
  const { fps } = useVideoConfig();
  return fr / fps - useContext(TimeShift);
};

/** 秒で書く Sequence（from・dur は秒）。中の部品の 0 秒はこの頭 */
export const Seq: React.FC<{ from: number; dur?: number; name?: string; children: React.ReactNode }> = ({ from, dur, name, children }) => {
  const { fps } = useVideoConfig();
  return React.createElement(Sequence, { from: Math.round(from * fps), durationInFrames: dur ? Math.max(1, Math.round(dur * fps)) : undefined, name, layout: "none" },
    React.createElement(TimeShift.Provider, { value: 0 }, children));
};

/** 出力の大きさ（横長 1920x1080／縦長 1080x1920 どちらでも部品が合わせる） */
export const useSize = () => {
  const { width: w, height: h, fps } = useVideoConfig();
  return { w, h, fps, tall: h > w, min: Math.min(w, h) };
};

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** イージング。expo は「速く出て、ゆっくり止まる」上品な動き（文字の入りの基本） */
export const ease = {
  linear: (x: number) => x,
  expo: Easing.bezier(0.16, 1, 0.3, 1),
  quart: Easing.bezier(0.25, 1, 0.5, 1),
  cubic: Easing.out(Easing.cubic),
  quad: Easing.out(Easing.quad),
  inQuad: Easing.in(Easing.quad),
  inCubic: Easing.in(Easing.cubic),
  inOut: Easing.inOut(Easing.cubic),
  sine: Easing.inOut(Easing.sin),
  back: Easing.out(Easing.back(1.7)),
  backSoft: Easing.out(Easing.back(1.1)),
} as const;
export type EaseName = keyof typeof ease;

/** t が a→b の間で 0→1（はみ出しは止める）。e でイージング */
export const prog = (t: number, a: number, b: number, e: (x: number) => number = ease.linear) =>
  b <= a ? (t >= a ? 1 : 0) : e(clamp01((t - a) / (b - a)));

/** キーフレーム：key([0,0.2,1],[0,1,0]) のように秒と値を並べる（はみ出しは止める） */
export const key = (t: number, ts: number[], vs: number[], e?: (x: number) => number) =>
  interpolate(t, ts, vs, { ...CL, easing: e });

/** 決まった乱数（同じ n なら同じ値。Math.random は並列書き出しでちらつくので使わない） */
export const rand = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
/** -1〜1 */
export const rands = (n: number) => rand(n) * 2 - 1;
/** 文字列から種を作る */
export const seedOf = (s: string | number) => {
  if (typeof s === "number") return s;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296 * 1000;
};

/** なめらかな1次元ノイズ（-1〜1）。揺れ・漂いに */
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return rands(i + seed * 31.7) * (1 - u) + rands(i + 1 + seed * 31.7) * u;
};

/**
 * 曲の拍の格子。offset＝曲の最初の拍の秒（動画の秒で）、bpm。
 * vb(n) は n 拍目の秒、bar(n) は n 小節目の頭の秒、pulse(t) は拍の頭で1→減衰（呼吸・明滅を拍に合わせる）
 */
export const beatGrid = (bpm: number, offset = 0, beatsPerBar = 4) => {
  const beat = 60 / bpm;
  return {
    beat,
    barLen: beat * beatsPerBar,
    vb: (n: number) => offset + n * beat,
    bar: (n: number) => offset + n * beat * beatsPerBar,
    beatAt: (t: number) => (t - offset) / beat,
    pulse: (t: number, decay = 6) => {
      const b = (t - offset) / beat;
      if (b < 0) return 0;
      return Math.exp(-(b - Math.floor(b)) * beat * decay);
    },
  };
};

/** CSS の transform をつなぐ（0 や 1 の項は省く） */
export const tf = (o: { x?: number; y?: number; s?: number; sx?: number; sy?: number; r?: number; rx?: number; ry?: number; skx?: number; z?: number; unit?: string }) => {
  const u = o.unit ?? "px";
  const p: string[] = [];
  if (o.x || o.y) p.push(`translate(${o.x ?? 0}${u}, ${o.y ?? 0}${u})`);
  if (o.z) p.push(`translateZ(${o.z}px)`);
  if (o.rx) p.push(`rotateX(${o.rx}deg)`);
  if (o.ry) p.push(`rotateY(${o.ry}deg)`);
  if (o.r) p.push(`rotate(${o.r}deg)`);
  if (o.skx) p.push(`skewX(${o.skx}deg)`);
  if (o.s !== undefined && o.s !== 1) p.push(`scale(${o.s})`);
  if ((o.sx !== undefined && o.sx !== 1) || (o.sy !== undefined && o.sy !== 1)) p.push(`scale(${o.sx ?? 1}, ${o.sy ?? 1})`);
  return p.join(" ") || "none";
};
