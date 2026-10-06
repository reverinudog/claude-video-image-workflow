/**
 * 解説・語りの動画で使うテロップ類
 *   Telop   … 文字を読ませる帯。look：band（黒い帯・既定）／bubble（立ち絵の吹き出し）／variety（太い縁取りのバラエティ風）／lower（名前・肩書きの札）／note（画面の隅の小さな補足）
 *   Counter … 数字が回って決まる（価格・人数・ダメージ・順位）
 *   Chip    … 小さな札（「提供：〇〇」「PR」正式な製品名など）
 * 約束（依頼主の好み）：テロップは正式な文言・表記は正式な製品名。飾り（白い罫線・縁の光・小さな英字・点滅）は足さない
 */
import React from "react";
import { ease, key, prog, useSize, useT } from "../core";
import { fam, type FontKey, useGlyphs } from "../fonts";

export type TelopLook = "band" | "bubble" | "variety" | "lower" | "note";
export const TELOP_LOOKS: Record<TelopLook, string> = {
  band: "黒い帯に白い文字（解説の標準。書籍のトレーラーで飾りを外して落ち着いた形）",
  bubble: "立ち絵の吹き出し（しっぽは縦中央・不透明。docs/lessons/remotion.md）",
  variety: "太い縁取り＋色。リアクション・ツッコミ（くだけた口調の所だけ）",
  lower: "左下の名前・肩書きの札（人物・作品の紹介）",
  note: "画面の隅の小さな補足（※注釈・出典）",
};

/** 強調：「」でくくった語や *語* を差し色にする */
const parts = (text: string, accent: string) => {
  const out: React.ReactNode[] = [];
  let on = false, buf = "", k = 0;
  for (const c of text) {
    if (c === "*") { if (buf) out.push(<span key={k++} style={on ? { color: accent } : undefined}>{buf}</span>); buf = ""; on = !on; continue; }
    buf += c;
  }
  if (buf) out.push(<span key={k++} style={on ? { color: accent } : undefined}>{buf}</span>);
  return out;
};

export const Telop: React.FC<{
  text: string; at?: number; until?: number; look?: TelopLook;
  x?: number; y?: number; size?: number; font?: FontKey; accent?: string; color?: string;
  /** bubble のしっぽの向き（立ち絵のいる側） */
  tail?: "left" | "right"; maxW?: number;
}> = ({ text, at = 0, until, look = "band", x, y, size, font, accent = "#ffd34d", color, tail = "right", maxW }) => {
  const t = useT();
  const { w, h, tall } = useSize();
  const f: FontKey = font ?? (look === "variety" ? "dela" : "zenKaku");
  const wt = look === "variety" ? 400 : look === "note" ? 500 : 700;
  useGlyphs(f, wt, text.replace(/\*/g, ""));
  if (t < at || (until !== undefined && t >= until)) return null;
  const l = t - at;
  const outQ = until === undefined ? 0 : prog(t, until - 0.15, until, ease.inQuad);
  const inP = prog(l, 0, 0.28, ease.expo);
  const fs = size ?? (look === "note" ? 30 : look === "lower" ? 46 : tall ? 58 : 52);
  const lines = text.split("|");
  const base: React.CSSProperties = { position: "absolute", fontFamily: fam(f), fontWeight: wt, fontSize: fs, lineHeight: 1.35, whiteSpace: "pre", maxWidth: maxW };
  if (look === "band") {
    return (
      <div style={{ ...base, left: x ?? w / 2, top: y ?? h - (tall ? 520 : 150), transform: `translate(-50%, -50%) translateY(${(1 - inP) * 14}px)`, opacity: inP * (1 - outQ), background: "rgba(8,8,12,0.82)", color: color ?? "#f4f1ea", padding: `${fs * 0.28}px ${fs * 0.7}px`, textAlign: "center", filter: `blur(${(1 - inP) * 6}px)` }}>
        {lines.map((s, i) => <div key={i}>{parts(s, accent)}</div>)}
      </div>
    );
  }
  if (look === "bubble") {
    const side = tail === "right" ? 1 : -1;
    const bg = "#fffdf7", line = "#1d1d24";
    return (
      <div style={{ ...base, left: x ?? w / 2, top: y ?? h - 170, transform: `translate(-50%, -50%) scale(${key(l, [0, 0.12, 0.2], [0.8, 1.04, 1], ease.cubic)})`, opacity: prog(l, 0, 0.08) * (1 - outQ), color: color ?? line }}>
        <div style={{ position: "relative", background: bg, border: `4px solid ${line}`, borderRadius: fs * 0.7, padding: `${fs * 0.3}px ${fs * 0.75}px`, boxShadow: "0 6px 0 rgba(0,0,0,0.25)" }}>
          {lines.map((s, i) => <div key={i}>{parts(s, "#d6262b")}</div>)}
          {/* しっぽ：付け根は塗りだけ（枠線を隠す）、両辺だけ線。縦中央に置く */}
          <svg width={fs * 0.9} height={fs * 0.8} style={{ position: "absolute", top: "50%", [side > 0 ? "right" : "left"]: -fs * 0.8, transform: `translateY(-50%) scaleX(${side})` }} viewBox="0 0 36 32">
            <path d="M0 6 L34 16 L0 26 Z" fill={bg} />
            <path d="M0 6 L34 16 L0 26" fill="none" stroke={line} strokeWidth={4} strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    );
  }
  if (look === "variety") {
    const sc = key(l, [0, 0.1, 0.18], [1.35, 0.96, 1], ease.cubic);
    const c = color ?? "#ffffff";
    return (
      <div style={{ ...base, left: x ?? w / 2, top: y ?? h - 190, transform: `translate(-50%, -50%) scale(${sc}) rotate(${-2}deg)`, opacity: prog(l, 0, 0.05) * (1 - outQ), color: c, textAlign: "center",
        WebkitTextStroke: `${fs * 0.16}px #16161c`, paintOrder: "stroke fill", filter: `drop-shadow(0 ${fs * 0.08}px 0 ${accent})`, fontSize: fs * 1.25 }}>
        {lines.map((s, i) => <div key={i}>{parts(s, accent)}</div>)}
      </div>
    );
  }
  if (look === "lower") {
    const bar = prog(l, 0, 0.35, ease.expo), txt = prog(l, 0.12, 0.5, ease.expo);
    const [name, sub] = [lines[0], lines.slice(1).join(" ")];
    return (
      <div style={{ ...base, left: x ?? (tall ? 60 : 110), top: y ?? h - (tall ? 560 : 230), opacity: 1 - outQ, whiteSpace: "nowrap" }}>
        <div style={{ position: "absolute", left: -18, top: 6, width: 8, height: fs * 2.1, background: accent, transform: `scaleY(${bar})`, transformOrigin: "50% 0%" }} />
        <div style={{ overflow: "hidden" }}><div style={{ transform: `translateY(${(1 - txt) * 110}%)`, color: color ?? "#fff", textShadow: "0 3px 12px rgba(0,0,0,0.9)" }}>{parts(name, accent)}</div></div>
        {sub && <div style={{ overflow: "hidden" }}><div style={{ transform: `translateY(${(1 - prog(l, 0.2, 0.55, ease.expo)) * 110}%)`, fontSize: fs * 0.55, fontWeight: 500, color: "#d8d6cf", textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>{sub}</div></div>}
      </div>
    );
  }
  // note
  return (
    <div style={{ ...base, right: x === undefined ? 60 : undefined, left: x, top: y ?? 60, opacity: prog(l, 0, 0.3) * (1 - outQ), color: color ?? "#e9e7e0", textShadow: "0 2px 8px rgba(0,0,0,0.95)", fontSize: fs }}>
      {lines.map((s, i) => <div key={i}>{parts(s, accent)}</div>)}
    </div>
  );
};

/** 数字が回って決まる。from→to を dur 秒で（最後はゆっくり）。prefix・suffix に単位 */
export const Counter: React.FC<{ to: number; from?: number; at?: number; dur?: number; x?: number; y?: number; size?: number; font?: FontKey; color?: string; prefix?: string; suffix?: string; comma?: boolean; decimals?: number }> = ({ to, from = 0, at = 0, dur = 1.2, x, y, size = 160, font = "oswald", color = "#ffd27a", prefix = "", suffix = "", comma = true, decimals = 0 }) => {
  const t = useT();
  const { w, h } = useSize();
  useGlyphs(font, 700, `0123456789,.-${prefix}${suffix}`);
  if (t < at) return null;
  const p = prog(t, at, at + dur, ease.quart);
  const v = from + (to - from) * p;
  const s = v.toFixed(decimals);
  const txt = comma ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : s;
  const land = key(t - at - dur, [0, 0.08, 0.2], [1, 1.08, 1]);
  return (
    <div style={{ position: "absolute", left: x ?? w / 2, top: y ?? h / 2, transform: `translate(-50%, -50%) scale(${p >= 1 ? land : 1})`, fontFamily: fam(font), fontWeight: 700, fontSize: size, color, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.8))" }}>
      <span style={{ fontSize: "0.5em" }}>{prefix}</span>{txt}<span style={{ fontSize: "0.45em", marginLeft: "0.1em" }}>{suffix}</span>
    </div>
  );
};

/** 小さな札（提供・PR・機種名など） */
export const Chip: React.FC<{ text: string; at?: number; until?: number; x?: number; y?: number; color?: string; size?: number }> = ({ text, at = 0, until, x = 60, y = 50, color = "#e2b04e", size = 30 }) => {
  const t = useT();
  useGlyphs("zenKaku", 700, text);
  if (t < at || (until !== undefined && t >= until)) return null;
  const p = prog(t, at, at + 0.3, ease.expo);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translateX(${(1 - p) * -20}px)`, opacity: p * (until === undefined ? 1 : 1 - prog(t, until - 0.15, until)), fontFamily: fam("zenKaku"), fontWeight: 700, fontSize: size, color: "#111", background: color, padding: `${size * 0.18}px ${size * 0.55}px`, borderRadius: size * 0.2, whiteSpace: "nowrap" }}>{text}</div>
  );
};
