/**
 * 一瞬の効果（叩きつけ・どどーん・判定の瞬間）。どれも at（秒）から始まり、自分で消える。
 * 同じ派手演出をくり返さない（集中線を2回使ったら3回目は火花や光の広がりに。docs/lessons/trailer.md）。
 * 組み合わせの目安：
 *   叩きつけ（強）… Flash 0.6〜1 ＋ useShake 14〜22 ＋ FocusLines（または Sparks／Burst）＋ SE impact＋sub
 *   叩きつけ（中）… Flash 0.3 ＋ Shockwave ＋ SE impact
 *   判定・決定    … Flare（光の筋）＋ Burst 小さめ ＋ SE kira
 *   祝い          … Confetti ＋ Burst ＋ SE ファンファーレ系
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { ease, key, prog, rand, rands, useSize, useT } from "../core";

/** 白み（一瞬画面が光る） */
export const Flash: React.FC<{ at: number; power?: number; color?: string; dur?: number }> = ({ at, power = 0.7, color = "#fff8e8", dur = 0.2 }) => {
  const t = useT();
  const op = key(t - at, [0, 0.033, dur], [0, power, 0]);
  return op > 0.001 ? <AbsoluteFill style={{ background: color, opacity: op, pointerEvents: "none" }} /> : null;
};

/**
 * 暗転・白み（at から dur 秒で color へ）。最後のフェードは画面の一番上に置いて全体にかける
 * （シーンごとにかけると立ち絵やテロップだけ残る。docs/lessons/remotion.md）。reverse で color から明ける
 */
export const Fade: React.FC<{ at: number; dur?: number; color?: string; reverse?: boolean }> = ({ at, dur = 1, color = "#000", reverse }) => {
  const t = useT();
  const p = prog(t, at, at + dur, ease.inOut);
  const op = reverse ? 1 - p : p;
  return op > 0.001 ? <AbsoluteFill style={{ background: color, opacity: op, pointerEvents: "none" }} /> : null;
};

/** 周りが赤く脈打つ（危険・ダメージ） */
export const RedPulse: React.FC<{ at: number; power?: number; color?: string }> = ({ at, power = 0.55, color = "200,20,20" }) => {
  const t = useT();
  const op = key(t - at, [0, 0.033, 0.13, 0.4], [0, power, power * 0.55, 0]);
  return op > 0.001 ? <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(${color},0.9))`, opacity: op }} /> : null;
};

/**
 * 画面の揺れ。返り値の transform を揺らしたい要素に付ける：
 *   const sh = useShake([{ at: 1.2, power: 18 }]);  <AbsoluteFill style={{ transform: sh }}>…
 * power は px（強い叩きつけで 14〜22。ゲーム紹介動画 v3「激しすぎ」→ この値の6割で落ち着いた）
 */
export const useShake = (events: { at: number; power?: number; dur?: number }[]) => {
  const t = useT();
  let x = 0, y = 0, r = 0;
  for (const e of events) {
    const d = e.dur ?? 0.33, l = t - e.at;
    if (l < 0 || l > d) continue;
    const a = (e.power ?? 16) * 0.6 * (1 - l / d);
    const q = Math.floor(l * 30);
    x += rands(q * 3.1 + e.at) * a;
    y += rands(q * 7.7 + e.at) * a;
    r += rands(q * 1.9 + e.at) * a * 0.02;
  }
  return x || y ? `translate(${x}px, ${y}px) rotate(${r}deg) scale(1.02)` : "none";
};
export const Shake: React.FC<{ events: { at: number; power?: number; dur?: number }[]; children: React.ReactNode }> = ({ events, children }) => (
  <AbsoluteFill style={{ transform: useShake(events) }}>{children}</AbsoluteFill>
);

/** 集中線（中心を空けて外から刺さる線。2コマごとに描き直してちらちら） */
export const FocusLines: React.FC<{ at: number; until: number; cx?: number; cy?: number; color?: string; n?: number; inner?: number; opacity?: number }> = ({ at, until, cx, cy, color = "rgba(255,240,210,0.85)", n = 90, inner = 420, opacity = 0.85 }) => {
  const t = useT();
  const { w, h, tall } = useSize();
  if (t < at || t >= until) return null;
  const mx = cx ?? w / 2, my = cy ?? h / 2;
  const kx = tall ? 0.62 : 1, ky = tall ? 1 : 0.62;
  const q = Math.floor(t * 15);
  const op = key(t, [at, at + 0.07, until - 0.13, until], [0, opacity, opacity, 0]);
  const R = Math.hypot(w, h);
  return (
    <AbsoluteFill style={{ opacity: op, pointerEvents: "none" }}>
      <svg width={w} height={h}>
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + rand(i + q * 0.37) * 0.05;
          const r0 = inner + rand(i * 3 + q) * inner * 0.6;
          const wd = 3 + rand(i * 7 + q) * 9;
          const x0 = mx + Math.cos(a) * r0 * kx, y0 = my + Math.sin(a) * r0 * ky;
          return <polygon key={i} points={`${x0},${y0} ${mx + Math.cos(a + wd / R) * R},${my + Math.sin(a + wd / R) * R} ${mx + Math.cos(a - wd / R) * R},${my + Math.sin(a - wd / R) * R}`} fill={color} />;
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** 流線（漫画のスピード線。横 or 縦に流れる）。疾走・突進・時間が飛ぶ */
export const SpeedLines: React.FC<{ at: number; until: number; dir?: "left" | "right" | "up" | "down"; color?: string; n?: number; opacity?: number }> = ({ at, until, dir = "left", color = "255,255,255", n = 60, opacity = 0.7 }) => {
  const t = useT();
  const { w, h } = useSize();
  if (t < at || t >= until) return null;
  const horiz = dir === "left" || dir === "right";
  const sgn = dir === "left" || dir === "up" ? -1 : 1;
  const L = horiz ? w : h, S = horiz ? h : w;
  const op = key(t, [at, at + 0.07, until - 0.1, until], [0, opacity, opacity, 0]);
  return (
    <AbsoluteFill style={{ opacity: op, pointerEvents: "none" }}>
      {Array.from({ length: n }, (_, i) => {
        const len = L * (0.15 + rand(i * 2.3) * 0.45);
        const sp = L * (2.5 + rand(i * 4.1) * 3); // px/秒
        const pos = ((t - at) * sp + rand(i * 9.7) * (L + len)) % (L + len) - len;
        const along = sgn > 0 ? pos : L - pos - len;
        const across = rand(i * 1.7) * S;
        const th = 1 + rand(i * 5.9) * 3.5;
        const a = 0.25 + rand(i * 7.3) * 0.6;
        const grad = `linear-gradient(${horiz ? 90 : 180}deg, rgba(${color},0), rgba(${color},${a}) ${sgn > 0 ? 85 : 15}%, rgba(${color},0))`;
        return <div key={i} style={{ position: "absolute", left: horiz ? along : across, top: horiz ? across : along, width: horiz ? len : th, height: horiz ? th : len, background: grad, borderRadius: th }} />;
      })}
    </AbsoluteFill>
  );
};

/** 光の広がり：叩きつけた文字の後ろから光が広がって消える（約0.5秒） */
export const Burst: React.FC<{ at: number; x?: number; y?: number; power?: number; color?: [string, string, string] }> = ({ at, x, y, power = 1, color = ["255,236,180", "240,180,80", "200,120,40"] }) => {
  const t = useT();
  const { w, h, tall } = useSize();
  const l = t - at;
  if (l < 0 || l > 0.55) return null;
  const p = prog(l, 0, 0.53, ease.cubic);
  const op = key(l, [0, 0.07, 0.53], [0, 0.9, 0]) * power;
  const rx = (18 + 70 * p) * (tall ? 1.5 : 1), ry = (10 + 30 * p) * (tall ? 0.6 : 1);
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", opacity: op, pointerEvents: "none",
      background: `radial-gradient(ellipse ${rx}% ${ry}% at ${((x ?? w / 2) / w) * 100}% ${((y ?? h / 2) / h) * 100}%, rgba(${color[0]},0.95) 0%, rgba(${color[1]},0.55) 30%, rgba(${color[2]},0.15) 60%, transparent 80%)` }} />
  );
};

/** 火花：x0〜x1・y のあたりから金と白の火花が飛び散り、重力で落ちて消える（約0.8秒） */
export const Sparks: React.FC<{ at: number; x0: number; x1: number; y: number; n?: number; colors?: [string, string]; spread?: number }> = ({ at, x0, x1, y, n = 90, colors = ["#fff6dc", "#ffc35a"], spread = 1.7 }) => {
  const t = useT();
  const { w, h } = useSize();
  const lf = (t - at) * 30;
  if (lf < 0 || lf > 30) return null;
  const segs: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const delay = Math.floor(rand(i * 9.1 + at) * 4);
    const tt = (lf - delay) / 30;
    const life = 0.35 + rand(i * 3.7 + at) * 0.45;
    if (tt < 0 || tt > life) continue;
    const sx = x0 + rand(i * 1.3 + at) * (x1 - x0), sy = y + rands(i * 2.9 + at) * 45;
    const ang = -Math.PI / 2 + rands(i * 5.3 + at) * Math.PI * spread / 2;
    const sp = 900 + rand(i * 7.1 + at) * 1600, g = 2200;
    const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
    const px = sx + vx * tt, py = sy + vy * tt + 0.5 * g * tt * tt;
    const fade = 1 - tt / life;
    segs.push(<line key={i} x1={px} y1={py} x2={px - vx * 0.045} y2={py - (vy + g * tt) * 0.045} stroke={rand(i * 11.3 + at) > 0.5 ? colors[0] : colors[1]} strokeWidth={2.5 + 4 * fade} strokeLinecap="round" opacity={Math.min(1, fade * 1.4)} />);
  }
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", filter: "drop-shadow(0 0 6px rgba(255,180,70,0.9))", pointerEvents: "none" }}>
      <svg width={w} height={h}>{segs}</svg>
    </AbsoluteFill>
  );
};

/** 衝撃波：細い輪が広がって消える（＋ふちのやわらかい光）。中くらいの叩きつけ・着地・魔法 */
export const Shockwave: React.FC<{ at: number; x?: number; y?: number; color?: string; size?: number; dur?: number; width?: number }> = ({ at, x, y, color = "255,244,220", size = 900, dur = 0.55, width = 10 }) => {
  const t = useT();
  const { w, h } = useSize();
  const l = t - at;
  if (l < 0 || l > dur) return null;
  const p = prog(l, 0, dur, ease.expo);
  const r = 40 + p * size;
  const op = 1 - prog(l, dur * 0.25, dur, ease.quad);
  const lw = width * (1 - p * 0.7);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      <div style={{ position: "absolute", left: (x ?? w / 2) - r, top: (y ?? h / 2) - r * 0.62, width: r * 2, height: r * 1.24, borderRadius: "50%", border: `${lw}px solid rgba(${color},${op})`, boxShadow: `0 0 ${30 * op}px rgba(${color},${op * 0.7}), inset 0 0 ${40 * op}px rgba(${color},${op * 0.4})` }} />
    </AbsoluteFill>
  );
};

/** 光の筋（アナモルフィックの横長フレア）：一点がきらっと光って横に伸びる。決定・登場・ロゴ */
export const Flare: React.FC<{ at: number; x?: number; y?: number; color?: string; len?: number; dur?: number; power?: number }> = ({ at, x, y, color = "180,220,255", len = 1400, dur = 0.7, power = 1 }) => {
  const t = useT();
  const { w, h } = useSize();
  const l = t - at;
  if (l < 0 || l > dur) return null;
  const grow = prog(l, 0, dur * 0.35, ease.expo);
  const op = key(l, [0, dur * 0.12, dur], [0, 1, 0]) * power;
  const cx = x ?? w / 2, cy = y ?? h / 2;
  const L = len * (0.3 + 0.7 * grow);
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen", opacity: op }}>
      <div style={{ position: "absolute", left: cx - L / 2, top: cy - 3, width: L, height: 6, borderRadius: 6, background: `linear-gradient(90deg, transparent, rgba(${color},0.9) 40%, #fff 50%, rgba(${color},0.9) 60%, transparent)`, filter: "blur(1.5px)" }} />
      <div style={{ position: "absolute", left: cx - L * 0.3, top: cy - 18, width: L * 0.6, height: 36, borderRadius: "50%", background: `radial-gradient(closest-side, rgba(${color},0.45), transparent)`, filter: "blur(4px)" }} />
      <div style={{ position: "absolute", left: cx - 70, top: cy - 70, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(closest-side, rgba(255,255,255,0.95), rgba(255,255,255,0.25) 35%, transparent)" }} />
      {/* 十字のきらめき */}
      <div style={{ position: "absolute", left: cx - 2, top: cy - 110 * grow, width: 4, height: 220 * grow, background: "linear-gradient(180deg, transparent, #fff, transparent)" }} />
    </AbsoluteFill>
  );
};

/** 紙吹雪：上から降りながらひらひら回る。祝い・達成・当選 */
export const Confetti: React.FC<{ at: number; dur?: number; n?: number; colors?: string[] }> = ({ at, dur = 3, n = 120, colors = ["#e2b04e", "#f7f2e6", "#e3342f", "#3bb8ff", "#7be07b", "#ff7bd0"] }) => {
  const t = useT();
  const { w, h } = useSize();
  const l = t - at;
  if (l < 0 || l > dur + 1) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: n }, (_, i) => {
        const d0 = rand(i * 1.1) * 0.5;
        const tt = l - d0;
        if (tt < 0) return null;
        const x0 = rand(i * 2.3) * w, vy = 260 + rand(i * 3.7) * 380;
        const yy = -40 + tt * vy + (i % 3 === 0 ? -tt * 120 : 0);
        if (yy > h + 40) return null;
        const xx = x0 + Math.sin(tt * (2 + rand(i * 5.1) * 3) + i) * 40;
        const flip = Math.cos(tt * (6 + rand(i * 7.9) * 6) + i);
        const op = Math.min(1, (dur + 1 - l) / 0.6);
        return <div key={i} style={{ position: "absolute", left: xx, top: yy, width: 14, height: 22, background: colors[i % colors.length], opacity: op, transform: `rotate(${tt * 200 * rands(i * 4.4) + i * 37}deg) scaleY(${flip})`, borderRadius: 2 }} />;
      })}
    </AbsoluteFill>
  );
};
