/**
 * 中身にかける加工（子要素を包んで使う）。
 *   Glitch（色ズレ＋横に裂ける帯＋ガタつき）、ChromaticAberration（常に薄い色ズレ）、Static（砂嵐）、
 *   Duotone（2色化）、Grade（色調のプリセット）、Mono（白黒）
 * Glitch・ChromaticAberration は中身を3回描くので重い。短い区間だけに使う。
 */
import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { key, rand, rands, useSize, useT } from "../core";

/** 色ズレ＋横に裂ける帯。at から dur 秒、power（0〜1）の強さ */
export const Glitch: React.FC<{ at: number; dur?: number; power?: number; seed?: number; children: React.ReactNode }> = ({ at, dur = 0.25, power = 1, seed = 1, children }) => {
  const t = useT();
  const { h } = useSize();
  const l = t - at;
  const on = l >= 0 && l <= dur;
  const q = Math.floor(l * 30) + seed * 17;
  const k = on ? power * key(l, [0, dur * 0.2, dur], [1, 1, 0.2]) : 0;
  const dx = rands(q * 1.3) * 26 * k;
  // 横に裂ける帯：3〜5本
  const bands = on ? Array.from({ length: 3 + Math.floor(rand(q * 2.2) * 3) }, (_, i) => {
    const y0 = rand(q * 3.1 + i * 7) * h, bh = 8 + rand(q * 4.7 + i) * 90;
    return { y0, bh, sx: rands(q * 5.3 + i * 3) * 120 * k };
  }) : [];
  // 赤の版と青緑の版を黒の上で screen で重ねる＝ずれが0なら元の絵と同じ。止まっている間は元の絵だけ
  return (
    <AbsoluteFill style={{ background: on ? "#000" : undefined, isolation: "isolate" }}>
      <AbsoluteFill style={{ transform: on ? `translateX(${-14 * k + dx}px)` : undefined, filter: on ? "url(#kit-red)" : undefined }}>{children}</AbsoluteFill>
      {on && <AbsoluteFill style={{ mixBlendMode: "screen", transform: `translateX(${14 * k + dx}px)`, filter: "url(#kit-cyan)" }}>{children}</AbsoluteFill>}
      {bands.map((b, i) => (
        <AbsoluteFill key={i} style={{ clipPath: `inset(${b.y0}px 0 ${Math.max(0, h - b.y0 - b.bh)}px 0)`, transform: `translateX(${b.sx}px)`, background: "#000" }}>{children}</AbsoluteFill>
      ))}
      <ColorDefs />
    </AbsoluteFill>
  );
};

/** 赤・青緑だけを取り出すフィルター（Glitch・ChromaticAberration が使う） */
const ColorDefs: React.FC = () => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <filter id="kit-red"><feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" /></filter>
    <filter id="kit-cyan"><feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" /></filter>
  </svg>
);

/** 常に薄い色ズレ（レンズの色収差）。px＝ずれ幅。周辺だけにしたいなら edge */
export const ChromaticAberration: React.FC<{ px?: number; edge?: boolean; children: React.ReactNode }> = ({ px = 3, edge = true, children }) => {
  const mask = edge ? "radial-gradient(ellipse at 50% 50%, transparent 45%, #000 85%)" : undefined;
  return (
    <AbsoluteFill>
      <AbsoluteFill>{children}</AbsoluteFill>
      <AbsoluteFill style={{ WebkitMaskImage: mask, background: "#000", isolation: "isolate" }}>
        <AbsoluteFill style={{ transform: `translateX(${-px}px)`, filter: "url(#kit-red)" }}>{children}</AbsoluteFill>
        <AbsoluteFill style={{ mixBlendMode: "screen", transform: `translateX(${px}px)`, filter: "url(#kit-cyan)" }}>{children}</AbsoluteFill>
      </AbsoluteFill>
      <ColorDefs />
    </AbsoluteFill>
  );
};

/** 砂嵐（テレビのノイズ）。at から dur 秒。opacity と重ね方 */
export const Static: React.FC<{ at?: number; dur?: number; opacity?: number; blend?: React.CSSProperties["mixBlendMode"] }> = ({ at = 0, dur = 9999, opacity = 0.6, blend = "screen" }) => {
  const t = useT();
  const { w, h } = useSize();
  const l = t - at;
  if (l < 0 || l > dur) return null;
  const s = Math.floor(t * 30) % 13;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: blend, opacity }}>
      <svg width={w} height={h}>
        <filter id={`static${s}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.75 0.35" numOctaves={1} seed={s} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={w} height={h} filter={`url(#static${s})`} />
      </svg>
    </AbsoluteFill>
  );
};

const hex = (c: string) => {
  const m = c.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255);
};
let duoN = 0;
/** 2色化（暗い所 dark・明るい所 light）。シナリオのトレーラーの「赤黒」、ポスター風、回想 */
export const Duotone: React.FC<{ dark?: string; light?: string; contrast?: number; children: React.ReactNode }> = ({ dark = "#120406", light = "#ff3355", contrast = 1.1, children }) => {
  const id = useMemo(() => `kduo${duoN++}`, []);
  const [d, l] = [hex(dark), hex(light)];
  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id={id} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0" />
          <feComponentTransfer>
            <feFuncR type="table" tableValues={`${d[0]} ${l[0]}`} />
            <feFuncG type="table" tableValues={`${d[1]} ${l[1]}`} />
            <feFuncB type="table" tableValues={`${d[2]} ${l[2]}`} />
          </feComponentTransfer>
        </filter>
      </svg>
      <AbsoluteFill style={{ filter: `url(#${id}) contrast(${contrast})` }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * 色調のプリセット（CSS filter と色の重ね）。素材の色を作品の空気に寄せる。
 * 強くかけすぎない。ゲーム画面など「本物の色」を見せたい所は rich 程度まで
 */
export const GRADES = {
  rich: { filter: "contrast(1.08) saturate(1.15)", overlay: undefined, note: "少し濃く（ゲーム紹介動画 の背景で採用）" },
  warm: { filter: "contrast(1.05) saturate(1.1) sepia(0.12)", overlay: "rgba(255,150,60,0.08)", note: "暖かい・夕方・懐かしい" },
  cold: { filter: "contrast(1.08) saturate(0.85) hue-rotate(-8deg)", overlay: "rgba(40,90,160,0.12)", note: "冷たい・夜・不安" },
  tealOrange: { filter: "contrast(1.12) saturate(1.1)", overlay: "linear-gradient(180deg, rgba(0,90,110,0.14), rgba(255,140,60,0.08))", note: "映画っぽい（影が青緑・肌が橙）" },
  noir: { filter: "grayscale(1) contrast(1.35) brightness(0.9)", overlay: undefined, note: "白黒の強いコントラスト。回想・ノワール" },
  faded: { filter: "contrast(0.88) saturate(0.75) brightness(1.05)", overlay: "rgba(240,230,210,0.08)", note: "色あせ。思い出・夢" },
  horror: { filter: "contrast(1.2) saturate(0.6) brightness(0.85)", overlay: "rgba(60,0,10,0.15)", note: "くすんだ赤黒。怪奇・ホラー" },
  neon: { filter: "contrast(1.15) saturate(1.5)", overlay: "linear-gradient(135deg, rgba(255,0,150,0.10), rgba(0,200,255,0.10))", note: "ネオン・サイバー" },
} as const;
export type GradeName = keyof typeof GRADES;
export const Grade: React.FC<{ name: GradeName; children: React.ReactNode }> = ({ name, children }) => {
  const g = GRADES[name];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: g.filter }}>{children}</AbsoluteFill>
      {g.overlay && <AbsoluteFill style={{ background: g.overlay, mixBlendMode: "soft-light", pointerEvents: "none" }} />}
    </AbsoluteFill>
  );
};
