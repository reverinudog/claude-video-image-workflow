/**
 * 背景・画面づくり
 *   KenBurns … 1枚絵・動画をさりげなく寄る／流す（量と速さに上限つき）
 *   Parallax … 層（背景・中景・立ち絵・手前）を奥行きで分けてカメラを動かす（2.5D）
 *   Figure   … 立ち絵：色つきの影・逆光のふち・着地の弾み・呼吸
 *   Aurora   … 素材なしで描くゆっくり動く色のにじみ（締め・タイトルの背景）
 *   Spotlight… 闇に上から当たる照明（素材なしの舞台）
 *   Tiles    … 画面を並べる（2x2〜壁）。手前から順に灯る
 */
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";
import { ease, key, noise1, prog, rand, useSize, useT, type Pt } from "../core";

const src = (s: string) => (s.startsWith("http") || s.startsWith("/") || s.includes(":") ? s : staticFile(s));
const isVideo = (s: string) => /\.(mp4|webm|mov)$/i.test(s);

/**
 * カメラの動きの上限（ゲーム紹介動画 v3「背景の動きが激しすぎる。見てて疲れる」・v4「短いショットでぐわんぐわん」）：
 * 1ショットで寄り引き4%・横移動70pxまで、かつ1秒に1.2%・20pxまで、一定の速さ
 */
export const CAM_LIMIT = { zoom: 0.04, pan: 70, zoomPerSec: 0.012, panPerSec: 20 };

export type KenBurnsProps = {
  /** public/ からの相対パス（画像か動画） */
  file: string;
  /** ショットの長さ（秒）。上限の計算に使う */
  len: number;
  /** 素材の大きさ（既定 1920x1080） */
  srcW?: number;
  srcH?: number;
  /** 寄りの倍率 [始め, 終わり]。上限でおさえられる */
  zoom?: [number, number];
  /** 素材の中で画面の中央に来る点 [始め, 終わり]（素材の座標） */
  center?: Pt | [Pt, Pt];
  /** 暗さ（0〜1） */
  dim?: number;
  /** 動画の開始秒・速さ */
  from?: number;
  rate?: number;
  /** 上限を外す（使うときは理由をコメントに） */
  unlimited?: boolean;
  filter?: string;
};
export const KenBurns: React.FC<KenBurnsProps> = ({ file, len, srcW = 1920, srcH = 1080, zoom = [1.04, 1.08], center, dim = 0.3, from = 0, rate = 1, unlimited, filter = "contrast(1.08) saturate(1.15)" }) => {
  const t = useT();
  const { w, h, fps } = useSize();
  const p = prog(t, 0, Math.max(0.01, len));
  const L = unlimited ? { zoom: 9, pan: 9e9, zoomPerSec: 9, panPerSec: 9e9 } : CAM_LIMIT;
  const zmax = Math.min(L.zoom, L.zoomPerSec * len) * zoom[0];
  const dz = Math.max(-zmax, Math.min(zmax, zoom[1] - zoom[0]));
  const cover = Math.max(w / srcW, h / srcH);
  const z = Math.max(zoom[0] + dz * p, 1) * cover;
  const c = center ?? [srcW / 2, srcH / 2];
  const [c0, c1raw] = (Array.isArray(c[0]) ? c : [c, c]) as [Pt, Pt];
  const d = Math.hypot(c1raw[0] - c0[0], c1raw[1] - c0[1]);
  const pmax = Math.min(L.pan, L.panPerSec * len);
  const k = d > pmax ? pmax / d : 1;
  let cx = c0[0] + (c1raw[0] - c0[0]) * k * p, cy = c0[1] + (c1raw[1] - c0[1]) * k * p;
  const hw = w / 2 / z, hh = h / 2 / z;
  cx = Math.min(srcW - hw, Math.max(hw, cx));
  cy = Math.min(srcH - hh, Math.max(hh, cy));
  const media = isVideo(file) ? <OffthreadVideo src={src(file)} startFrom={Math.round(from * fps)} playbackRate={rate} muted style={{ width: srcW, height: srcH }} /> : <Img src={src(file)} style={{ width: srcW, height: srcH, objectFit: "cover" }} />;
  return (
    <AbsoluteFill style={{ overflow: "hidden", filter }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: srcW, height: srcH, transform: `translate(${w / 2 - cx * z}px, ${h / 2 - cy * z}px) scale(${z})`, transformOrigin: "0 0" }}>{media}</div>
      {dim > 0 && <AbsoluteFill style={{ background: `rgba(5,6,10,${dim})` }} />}
    </AbsoluteFill>
  );
};

export type ParallaxLayer = {
  /** 画像・動画（public/ から）か、自分で描いた部品 */
  file?: string;
  node?: React.ReactNode;
  /** 奥行き：0＝無限遠（動かない）、1＝主役の面、1より大きい＝手前（大きく動く） */
  depth: number;
  /** 層の置き方（px・倍率）。省くと画面いっぱい */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  blur?: number;
  opacity?: number;
  style?: React.CSSProperties;
};
/**
 * 層を奥行きで分けて、カメラを動かす（2.5D）。cam は [始め, 終わり] の { x, y, zoom }（主役の面での px・倍率）。
 * 手前ほど大きく動く・遠いほど小さく動く。1枚絵全体の拡大を「視差」と呼ばない（visual-design.md）
 */
export const Parallax: React.FC<{ layers: ParallaxLayer[]; len: number; cam?: [{ x?: number; y?: number; zoom?: number }, { x?: number; y?: number; zoom?: number }]; easing?: "linear" | "inOut" }> = ({ layers, len, cam = [{ x: -40, zoom: 1.0 }, { x: 40, zoom: 1.04 }], easing = "inOut" }) => {
  const t = useT();
  const { w, h } = useSize();
  const p = prog(t, 0, len, easing === "linear" ? ease.linear : ease.sine);
  const cx = (cam[0].x ?? 0) + ((cam[1].x ?? 0) - (cam[0].x ?? 0)) * p;
  const cy = (cam[0].y ?? 0) + ((cam[1].y ?? 0) - (cam[0].y ?? 0)) * p;
  const cz = (cam[0].zoom ?? 1) + ((cam[1].zoom ?? 1) - (cam[0].zoom ?? 1)) * p;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {layers.map((l, i) => {
        const d = l.depth;
        const s = 1 + (cz - 1) * d;
        const ox = -cx * d, oy = -cy * d;
        const lw = l.w ?? w * 1.12, lh = l.h ?? h * 1.12;
        const lx = l.x ?? (w - lw) / 2, ly = l.y ?? (h - lh) / 2;
        const content = l.node ?? (l.file ? (isVideo(l.file) ? <OffthreadVideo src={src(l.file)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Img src={src(l.file)} style={{ width: "100%", height: "100%", objectFit: l.w ? "contain" : "cover" }} />) : null);
        return (
          <div key={i} style={{ position: "absolute", left: lx, top: ly, width: lw, height: lh, transform: `translate(${ox}px, ${oy}px) scale(${s})`, transformOrigin: `${w / 2 - lx}px ${h / 2 - ly}px`, filter: l.blur ? `blur(${l.blur}px)` : undefined, opacity: l.opacity, ...l.style }}>{content}</div>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * 立ち絵。色つきの影（shadowColor）・逆光のふち（rim）・入りの弾み（at）・呼吸（breathe）。
 * 2人以上並べるときは顔の大きさと色調をそろえる（CLAUDE.md）。頭を切ったままにしない
 */
export const Figure: React.FC<{
  file: string; x: number; y: number; h: number;
  /** 入る秒。入り方 */
  at?: number; enter?: "pop" | "slide" | "fade" | "rise" | "none"; from?: "left" | "right";
  shadowColor?: string; shadowOffset?: [number, number];
  rim?: string; backlight?: string;
  breathe?: boolean; flip?: boolean; dim?: number;
  /** 拍で軽く弾む（beatGrid の pulse を渡す） */
  bounce?: number;
}> = ({ file, x, y, h: fh, at = 0, enter = "pop", from = "right", shadowColor, shadowOffset = [18, 10], rim, backlight, breathe = true, flip, dim = 0, bounce = 0 }) => {
  const t = useT();
  const l = t - at;
  if (l < 0) return null;
  let tx = 0, ty = 0, s = 1, op = 1;
  if (enter === "pop") { s = key(l, [0, 0.18, 0.3], [0.85, 1.04, 1], ease.cubic); op = prog(l, 0, 0.1); ty = key(l, [0, 0.18], [40, 0], ease.cubic); }
  if (enter === "slide") { tx = (from === "right" ? 1 : -1) * (1 - prog(l, 0, 0.45, ease.expo)) * 300; op = prog(l, 0, 0.2); }
  if (enter === "fade") op = prog(l, 0, 0.5, ease.cubic);
  if (enter === "rise") { ty = (1 - prog(l, 0, 0.6, ease.expo)) * 120; op = prog(l, 0, 0.3); }
  if (breathe) s *= 1 + 0.006 * Math.sin(l * 2.2);
  ty -= bounce * 14;
  const filt = [shadowColor ? `drop-shadow(${shadowOffset[0]}px ${shadowOffset[1]}px 0 ${shadowColor})` : "", rim ? `drop-shadow(0 0 2px ${rim}) drop-shadow(0 0 10px ${rim})` : "", dim ? `brightness(${1 - dim})` : ""].filter(Boolean).join(" ");
  return (
    <div style={{ position: "absolute", left: x, top: y, height: fh, transform: `translate(-50%, -100%) translate(${tx}px, ${ty}px) scale(${s})${flip ? " scaleX(-1)" : ""}`, transformOrigin: "50% 100%", opacity: op }}>
      {backlight && <Img src={src(file)} style={{ position: "absolute", inset: 0, height: fh, filter: `brightness(0) invert(1) blur(24px) drop-shadow(0 0 30px ${backlight})`, opacity: 0.55, mixBlendMode: "screen", transform: "scale(1.04)" }} />}
      <Img src={src(file)} style={{ position: "relative", height: fh, filter: filt || undefined }} />
    </div>
  );
};

/** 素材なしで描く、ゆっくり動く色のにじみ（締め・タイトル・章の背景） */
export const Aurora: React.FC<{ colors?: [string, string, string]; base?: string; speed?: number }> = ({ colors = ["40,60,140", "120,40,120", "226,176,78"], base = "#05060a", speed = 1 }) => {
  const t = useT() * speed;
  const b = (i: number) => ({ x: 50 + noise1(t * 0.15 + i * 10, i) * 35, y: 50 + noise1(t * 0.12 + i * 20, i + 3) * 30 });
  const [p0, p1, p2] = [b(0), b(1), b(2)];
  return (
    <AbsoluteFill style={{ background: base }}>
      <AbsoluteFill style={{ filter: "blur(40px)", background: `radial-gradient(ellipse 55% 50% at ${p0.x}% ${p0.y}%, rgba(${colors[0]},0.55), transparent 70%), radial-gradient(ellipse 45% 45% at ${p1.x}% ${p1.y}%, rgba(${colors[1]},0.45), transparent 70%), radial-gradient(ellipse 35% 30% at ${p2.x}% ${p2.y}%, rgba(${colors[2]},0.3), transparent 70%)` }} />
    </AbsoluteFill>
  );
};

/** 闇に上から当たる照明（床の光だまりつき）。素材なしの舞台・登場・尋問 */
export const Spotlight: React.FC<{ x?: number; color?: string; on?: number; floor?: number; width?: number }> = ({ x, color = "255,240,220", on = 0, floor, width = 520 }) => {
  const t = useT();
  const { w, h } = useSize();
  const cx = x ?? w / 2, fy = floor ?? h * 0.86;
  const op = on > 0 ? prog(t, 0, on, ease.cubic) * (t < on ? (rand(Math.floor(t * 20)) > 0.4 ? 1 : 0.3) : 1) : 1;
  return (
    <AbsoluteFill style={{ background: "#040406", opacity: 1 }}>
      <div style={{ position: "absolute", left: cx - width, top: -40, width: width * 2, height: fy + 60, opacity: op, filter: "blur(30px)" }}>
        <div style={{ width: "100%", height: "100%", clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)", background: `linear-gradient(180deg, rgba(${color},0.55), rgba(${color},0.12))` }} />
      </div>
      <div style={{ position: "absolute", left: cx - width * 1.1, top: fy - 70, width: width * 2.2, height: 140, borderRadius: "50%", opacity: op, background: `radial-gradient(closest-side, rgba(${color},0.45), transparent)`, filter: "blur(8px)" }} />
    </AbsoluteFill>
  );
};

/**
 * 画面を並べる。tiles は各マスの中身（動画・画像・部品）。手前（左上）から順に灯る。
 * tilt で斜めに倒した壁にもできる（ゲーム紹介動画「ぜんぶ、」の 5x4 の壁：奥ほど暗く、全体はゆっくり引く）
 */
export const Tiles: React.FC<{ tiles: React.ReactNode[]; cols: number; rows?: number; gap?: number; step?: number; tilt?: boolean; len?: number }> = ({ tiles, cols, rows, gap = 24, step = 0.08, tilt = false, len = 3 }) => {
  const t = useT();
  const { w, h } = useSize();
  const R = rows ?? Math.ceil(tiles.length / cols);
  const n = cols * R;
  const tw = tilt ? 560 : (w * 0.86 - gap * (cols - 1)) / cols;
  const th = tilt ? 315 : Math.min((h * 0.8 - gap * (R - 1)) / R, tw * 9 / 16);
  const ww = cols * tw + (cols - 1) * gap, wh = R * th + (R - 1) * gap;
  const z = tilt ? key(t, [0, len], [1.18, 1.0], ease.quad) : key(t, [0, len], [1.03, 1.0]);
  return (
    <AbsoluteFill style={{ background: "#05060a", perspective: 1500, perspectiveOrigin: "50% 45%" }}>
      <div style={{ position: "absolute", left: (w - ww) / 2, top: (h - wh) / 2, width: ww, height: wh, transform: `scale(${z})${tilt ? " rotateY(-22deg) rotateX(9deg) rotateZ(-3deg)" : ""}`, transformStyle: "preserve-3d" }}>
        {Array.from({ length: n }, (_, i) => {
          const c = i % cols, r = Math.floor(i / cols);
          const t0 = tilt ? (c / cols) * 1 + rand(i * 3.3) * 0.27 : i * step;
          const p = prog(t, t0, t0 + 0.27, ease.cubic);
          return (
            <div key={i} style={{ position: "absolute", left: c * (tw + gap), top: r * (th + gap), width: tw, height: th, overflow: "hidden", borderRadius: 6, opacity: p, transform: tilt ? `translateZ(${(1 - p) * 120}px)` : `scale(${0.92 + 0.08 * p})`, boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
              {tiles[i % tiles.length]}
            </div>
          );
        })}
      </div>
      {tilt && <AbsoluteFill style={{ background: "linear-gradient(95deg, rgba(5,6,10,0.05) 0%, rgba(5,6,10,0.25) 45%, rgba(5,6,10,0.8) 100%)" }} />}
    </AbsoluteFill>
  );
};

