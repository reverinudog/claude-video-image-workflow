/**
 * JIZURA エンジンを Remotion で使うための準備。
 * ・project（歌詞・スタイル・シード…）から構成（plan）を組み、フォントを読み込み、描画器を作る
 * ・同じ設定なら結果を使い回す（Remotion は1コマずつ呼ぶので毎回作らない）
 */
import { staticFile } from "remotion";
import J from "./engine.generated.js";

export type JizuraProject = {
  lyrics: string;
  title?: string;
  artist?: string;
  style?: string; // noir / crimson / caution / magenta / paper / hud / mint / specimen / transit / blueprint / rouge / mono …（J.STYLE_ORDER）
  mood?: string | null;
  seed?: number; // 変えると別の構成になる
  aspect?: "16:9" | "9:16" | "4:3" | "3:4" | "1:1" | "4:5" | "21:9";
  res?: number; // 短辺の画素数（720 / 1080 / 2160）
  fps?: number;
  keyBg?: "off" | "green" | "black"; // 合成用の背景
  extra?: boolean; // 追加分の演出も使う
  wa?: boolean; // 和風の演出も使う
  fx?: Record<string, unknown>; // motion / glitch / chroma / decor / density / texture / flash / koma / hud / bgSwitch
  timing?: Record<string, unknown>; // bpm / offset / snap / tail / lineTimes / lineScale
  overrides?: Record<string, unknown>; // 行ごとの固定（JIZURAブラウザ版と同じ形式）
  colors?: Record<string, unknown>;
  fonts?: Record<string, unknown>;
};

export type Loaded = { plan: any; renderer: any; W: number; H: number; duration: number };

const HUD_CHARS = "0123456789:./-_()【】・No.LYRICRECUNTITLEDXYlinebpminterlude—─／ ";

/** JIZURAの既定値に上書きして、完全な project を作る */
export const fullProject = (p: JizuraProject) => {
  const d = J.defaultProject();
  return {
    ...d,
    ...p,
    fx: { ...d.fx, ...(p.fx || {}) },
    timing: { ...d.timing, ...(p.timing || {}) },
    colors: { ...d.colors, ...(p.colors || {}) },
    overrides: { ...(p.overrides || {}) },
    fonts: { ...(p.fonts || {}) },
  };
};

/** 出力サイズ（JIZURAの書き出しと同じ計算） */
export const outputSize = (p: JizuraProject): [number, number] => J.outputSize(fullProject(p));

/** 描画器の模様（紙・粒子）は Math.random で作られる → 固定シードで作って、どのコマ・どの並列処理でも同じにする */
export const withSeededRandom = <T,>(seed: number, fn: () => T): T => {
  const orig = Math.random;
  let s = seed >>> 0;
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try { return fn(); } finally { Math.random = orig; }
};

const audioCache = new Map<string, Promise<any>>();
/** 曲を解析（BPM・拍・音量）。JIZURAの J.analyzeAudio にファイル風のものを渡す */
export const analyzeSong = (src: string) => {
  if (!audioCache.has(src)) {
    audioCache.set(src, (async () => {
      const res = await fetch(staticFile(src));
      if (!res.ok) throw new Error(`曲が読み込めません: public/${src}`);
      const buf = await res.arrayBuffer();
      return J.analyzeAudio({ name: src, arrayBuffer: async () => buf });
    })());
  }
  return audioCache.get(src)!;
};

/** 構成だけ（長さを決めるのに使う。フォントは読まない） */
export const planOnly = async (p: JizuraProject, song?: string | null) => {
  const audio = song ? await analyzeSong(song) : null;
  return J.plan(fullProject(p), audio);
};

const cache = new Map<string, Promise<Loaded>>();
/** 構成＋フォント＋描画器 */
export const loadJizura = (p: JizuraProject, song?: string | null): Promise<Loaded> => {
  const key = JSON.stringify([p, song ?? null]);
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      const project = fullProject(p);
      const audio = song ? await analyzeSong(song) : null;
      const plan = J.plan(project, audio);
      const text = project.lyrics + (project.title || "") + (project.artist || "") + HUD_CHARS;
      await J.ensureFonts(text, J.fontsOfPlan ? J.fontsOfPlan(plan) : null);
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const renderer = withSeededRandom(project.seed ?? 1, () => new J.Renderer());
      return { plan, renderer, W: plan.W, H: plan.H, duration: plan.duration };
    })());
  }
  return cache.get(key)!;
};

export { J };
