/**
 * 空気・質感（ずっと敷いておく層）。主役の邪魔をしない薄さが基本。
 *   舞い物 Floaters（火の粉／塵／ぼけ玉／雪／花びら／蛍）、霧 Fog、差し込む光 GodRays、光漏れ LightLeak、
 *   フィルムの粒子 Grain、周辺減光 Vignette、シネスコの黒帯 Letterbox、走査線 Scanlines、網点 Halftone
 * 縦長（ショート）では周辺減光を横に長い楕円で薄く（docs/lessons/trailer.md）。どの部品も画面の大きさに合わせる。
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { key, noise1, prog, rand, useSize, useT } from "../core";

type FloatKind = "embers" | "dust" | "bokeh" | "snow" | "petals" | "fireflies";
const FLOAT: Record<FloatKind, { n: number; size: [number, number]; speed: [number, number]; dir: 1 | -1; sway: number; color: string; blend: React.CSSProperties["mixBlendMode"]; note: string }> = {
  embers: { n: 60, size: [3, 8], speed: [18, 60], dir: -1, sway: 30, color: "255,180,80", blend: "screen", note: "火の粉が立ちのぼる。戦い・熱・ファンタジー" },
  dust: { n: 60, size: [1.5, 4], speed: [4, 14], dir: -1, sway: 40, color: "255,246,230", blend: "screen", note: "光の中の埃。静か・古い部屋・回想" },
  bokeh: { n: 18, size: [40, 140], speed: [6, 18], dir: -1, sway: 60, color: "255,220,170", blend: "screen", note: "大きなぼけ玉。夜景・やさしい・夢" },
  snow: { n: 110, size: [3, 8], speed: [30, 80], dir: 1, sway: 50, color: "255,255,255", blend: "normal", note: "雪。冬・静寂・別れ" },
  petals: { n: 34, size: [10, 18], speed: [40, 90], dir: 1, sway: 90, color: "255,190,210", blend: "normal", note: "花びらが舞う。春・出会い・和" },
  fireflies: { n: 36, size: [4, 8], speed: [3, 10], dir: -1, sway: 70, color: "190,255,140", blend: "screen", note: "蛍。夏の夜・幻想・ひそやか" },
};
export const FLOAT_KINDS = Object.entries(FLOAT).map(([k, v]) => ({ key: k as FloatKind, note: v.note }));

/** 舞い物。kind で種類、n で数、color で色（"r,g,b"）、opacity で全体の濃さ */
export const Floaters: React.FC<{ kind?: FloatKind; n?: number; color?: string; opacity?: number; seed?: number; speed?: number }> = ({ kind = "embers", n, color, opacity = 1, seed = 1, speed = 1 }) => {
  const t = useT();
  const { w, h } = useSize();
  const d = FLOAT[kind];
  const N = n ?? d.n, col = color ?? d.color;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: d.blend, opacity }}>
      {Array.from({ length: N }, (_, i) => {
        const r = (k: number) => rand(i * k + seed * 17.3);
        const sp = (d.speed[0] + r(3.3) * (d.speed[1] - d.speed[0])) * speed;
        const sz = d.size[0] + r(5.1) * (d.size[1] - d.size[0]);
        const span = h + 200;
        const tt = ((t * sp + r(7.7) * span) % span) / span;
        const y = d.dir < 0 ? h + 80 - tt * span : -80 + tt * span;
        const x = r(1.9) * w + noise1(t * 0.3 + i, seed) * d.sway;
        const life = Math.sin(tt * Math.PI);
        if (kind === "petals") {
          const rot = t * (60 + r(2.2) * 120) + i * 40;
          const flip = Math.cos(t * (1.5 + r(4.4) * 2) + i);
          return <div key={i} style={{ position: "absolute", left: x, top: y, width: sz, height: sz * 0.7, borderRadius: "80% 0 80% 0", background: `rgba(${col},0.9)`, opacity: 0.85 * Math.min(1, life * 3), transform: `rotate(${rot}deg) scaleX(${flip})`, boxShadow: `inset -2px -2px 4px rgba(200,90,120,0.5)` }} />;
        }
        if (kind === "bokeh") {
          const op = life * (0.12 + 0.18 * r(9.2));
          return <div key={i} style={{ position: "absolute", left: x - sz / 2, top: y - sz / 2, width: sz, height: sz, borderRadius: "50%", opacity: op, background: `radial-gradient(circle, rgba(${col},0.55) 0%, rgba(${col},0.35) 55%, rgba(${col},0.6) 68%, rgba(${col},0) 72%)`, filter: "blur(2px)" }} />;
        }
        const flick = kind === "fireflies" ? 0.4 + 0.6 * Math.max(0, Math.sin(t * (1.5 + r(6.6) * 2) + i * 2)) : kind === "embers" ? 0.7 + 0.3 * Math.sin(t * 9 + i) : 1;
        const op = Math.min(1, life * 1.6) * (0.55 + 0.45 * r(9.2)) * flick;
        const near = sz > d.size[1] * 0.8;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: sz, height: sz, borderRadius: "50%", opacity: op,
          background: `radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(${col},0.9) 40%, rgba(${col},0) 75%)`, boxShadow: kind === "snow" ? undefined : `0 0 ${sz * 3}px rgba(${col},0.8)`, filter: near ? "blur(1.5px)" : undefined }} />;
      })}
    </AbsoluteFill>
  );
};

/** 流れる霧（大きなノイズをゆっくり横に流す）。周期は固定長（縦画面で模様が飛ばないように。docs/lessons/remotion.md） */
export const Fog: React.FC<{ opacity?: number; tint?: string; seed?: number; speed?: number; scale?: number; low?: boolean }> = ({ opacity = 0.3, tint = "#d8d2c6", seed = 3, speed = 18, scale = 0.0022, low = false }) => {
  const t = useT();
  const { w, h } = useSize();
  const PERIOD = 1152;
  const off = -((t * speed) % PERIOD);
  const id = `fog${seed}`;
  // 色は tint、濃さはノイズの明るさ（明るい所ほど濃い霧）
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(tint.slice(i, i + 2), 16) / 255);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, WebkitMaskImage: low ? "linear-gradient(180deg, transparent 35%, #000 85%)" : undefined }}>
      <svg width={w + PERIOD} height={h} style={{ position: "absolute", left: off, top: 0 }}>
        <filter id={id} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency={`${scale} ${scale * 2.2}`} numOctaves={3} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="matrix" values={`0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  1.3 0 0 0 -0.5`} />
        </filter>
        <rect width={w + PERIOD} height={h} filter={`url(#${id})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** 上から差し込む光の筋。x＝光源の横位置、angle＝傾き。ゆっくり明滅する。神秘・教会・朝 */
export const GodRays: React.FC<{ x?: number; angle?: number; n?: number; color?: string; opacity?: number; spread?: number }> = ({ x, angle = 12, n = 7, color = "255,236,200", opacity = 0.5, spread = 0.5 }) => {
  const t = useT();
  const { w, h } = useSize();
  const cx = x ?? w * 0.3;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity, overflow: "hidden" }}>
      {Array.from({ length: n }, (_, i) => {
        const a = angle + (i - (n - 1) / 2) * 6 * spread + noise1(t * 0.2 + i * 3, 4) * 2;
        const wd = 60 + rand(i * 3.1) * 160;
        const op = 0.25 + 0.35 * (0.5 + 0.5 * noise1(t * 0.35 + i * 1.7, 9));
        return (
          // 切り抜いてからぼかす（同じ要素に clip-path と blur をかけると縁が鋭く残る。docs/lessons/remotion.md）
          <div key={i} style={{ position: "absolute", left: cx - wd / 2, top: -h * 0.1, width: wd, height: h * 1.5, transform: `rotate(${a}deg)`, transformOrigin: "50% 0%", filter: `blur(${18 + wd * 0.12}px)`, opacity: op }}>
            <div style={{ width: "100%", height: "100%", clipPath: "polygon(35% 0, 65% 0, 100% 100%, 0 100%)", background: `linear-gradient(180deg, rgba(${color},0.9), rgba(${color},0.15) 70%, transparent)` }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * 光漏れ（フィルムのライトリーク）。暖かい光のかたまりが画面の端からゆっくり流れる。
 * at〜until の間だけ出す。切り替えの瞬間に一瞬だけ強く入れるとつなぎにもなる（trans の lightLeak）。懐かしさ・青春・回想
 */
export const LightLeak: React.FC<{ at?: number; until?: number; colors?: [string, string]; power?: number; seed?: number }> = ({ at = 0, until = 9999, colors = ["255,140,60", "255,210,120"], power = 0.8, seed = 2 }) => {
  const t = useT();
  if (t < at || t >= until) return null;
  const op = key(t, [at, at + 0.4, until - 0.4, until], [0, 1, 1, 0]) * power;
  const l = t - at;
  const x1 = -20 + (l * 9 + seed * 13) % 140, y1 = 30 + noise1(l * 0.3, seed) * 30;
  const x2 = 110 - (l * 6 + seed * 29) % 140, y2 = 70 + noise1(l * 0.25, seed + 5) * 25;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: op,
      background: `radial-gradient(ellipse 40% 70% at ${x1}% ${y1}%, rgba(${colors[0]},0.75), transparent 70%), radial-gradient(ellipse 35% 50% at ${x2}% ${y2}%, rgba(${colors[1]},0.55), transparent 70%)` }} />
  );
};

/** フィルムの粒子（2コマごとに模様が変わる）。opacity 0.05〜0.1 */
export const Grain: React.FC<{ opacity?: number; blend?: React.CSSProperties["mixBlendMode"] }> = ({ opacity = 0.07, blend = "overlay" }) => {
  const t = useT();
  const { w, h } = useSize();
  const s = Math.floor(t * 15) % 9;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={w} height={h} style={{ position: "absolute", opacity, mixBlendMode: blend }}>
        <filter id={`grain${s}`}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={s} /></filter>
        <rect width={w} height={h} filter={`url(#grain${s})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** 周辺減光。縦長は横に長い楕円で薄く（横長と同じ形だと縦に暗くなって不評） */
export const Vignette: React.FC<{ power?: number }> = ({ power = 0.38 }) => {
  const { tall } = useSize();
  return <AbsoluteFill style={{ pointerEvents: "none", background: tall ? `radial-gradient(ellipse 130% 58% at 50% 50%, transparent 62%, rgba(0,0,0,${power * 0.75}))` : `radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0,0,0,${power}))` }} />;
};

/** シネスコの黒帯（2.39:1）。at から 0.5秒で閉じ、until で開く。映画っぽい間・回想・重大な場面 */
export const Letterbox: React.FC<{ at?: number; until?: number; ratio?: number; color?: string }> = ({ at = 0, until = 9999, ratio = 2.39, color = "#000" }) => {
  const t = useT();
  const { w, h } = useSize();
  const bar = Math.max(0, (h - w / ratio) / 2);
  const p = key(t, [at, at + 0.5, until - 0.5, until], [0, 1, 1, 0]);
  if (p <= 0) return null;
  const b = bar * p;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: b, background: color }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: b, background: color }} />
    </AbsoluteFill>
  );
};

/** 走査線（ブラウン管）。ゆっくり流れる明るい帯つき。レトロ・監視カメラ・配信画面 */
export const Scanlines: React.FC<{ opacity?: number; gap?: number }> = ({ opacity = 0.25, gap = 4 }) => {
  const t = useT();
  const { h } = useSize();
  const band = ((t * 0.25) % 1) * (h + 300) - 150;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ opacity, background: `repeating-linear-gradient(180deg, rgba(0,0,0,0.6) 0px, rgba(0,0,0,0.6) 1px, transparent 1px, transparent ${gap}px)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: band, height: 150, background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.05), transparent)" }} />
    </AbsoluteFill>
  );
};

/** 網点（ハーフトーン）を重ねる。漫画・ポップ・印刷物っぽさ */
export const Halftone: React.FC<{ color?: string; size?: number; opacity?: number; fade?: "none" | "left" | "right" | "bottom" }> = ({ color = "rgba(255,255,255,0.35)", size = 18, opacity = 1, fade = "right" }) => {
  const mask = fade === "none" ? undefined : `linear-gradient(${fade === "left" ? 270 : fade === "right" ? 90 : 0}deg, transparent 20%, #000)`;
  return <AbsoluteFill style={{ pointerEvents: "none", opacity, backgroundImage: `radial-gradient(circle, ${color} 28%, transparent 30%)`, backgroundSize: `${size}px ${size}px`, WebkitMaskImage: mask }} />;
};

/** 時間の経過で 0→1（at から dur 秒）。部品を自分で組むときの小道具 */
export const useIn = (at: number, dur: number) => prog(useT(), at, at + dur);
