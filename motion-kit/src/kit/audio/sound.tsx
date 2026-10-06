/**
 * 音の小道具（秒で書く）
 *   <Bgm parts=[...] duck=[...] />  曲をつなぎ直す（区間ごとのフェード）＋ナレーションの間だけ下げる
 *   <SeTrack items=[...] />          効果音を並べる
 *   hit(...)                         よく使う重ね方（叩きつけ＝impact＋sub など）をまとめて出す
 * 音量の目安（依頼主の好み）：BGM は元から -20dB（0.1）、SE は -10dB 前後（0.2〜0.32）。曲が主役のトレーラーは曲を下げない（仕上げにリミッター）
 * dB と倍率：-6dB=0.5、-10dB≈0.32、-14dB=0.2、-20dB=0.1
 */
import React from "react";
import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";

export const db = (d: number) => Math.pow(10, d / 20);

export type BgmPart = {
  /** public/ からのパス（例 "bgm/hero.mp3"） */
  file: string;
  /** 動画のこの秒から（from）この秒まで（to）鳴らす。offset＝曲の何秒目から使うか */
  from: number;
  to: number;
  offset?: number;
  vol?: number;
  fadeIn?: number;
  fadeOut?: number;
};
/** ダッキング：from〜to の間 BGM を amount 倍に（既定 0.4＝約 -8dB）。ramp 秒でなだらかに */
export type Duck = { from: number; to: number; amount?: number; ramp?: number };

const duckGain = (t: number, ducks: Duck[]) => {
  let g = 1;
  for (const d of ducks) {
    const r = d.ramp ?? 0.25, a = d.amount ?? 0.4;
    let k = 0;
    if (t >= d.from - r && t <= d.to + r) k = t < d.from ? (t - (d.from - r)) / r : t > d.to ? 1 - (t - d.to) / r : 1;
    g = Math.min(g, 1 - (1 - a) * Math.max(0, Math.min(1, k)));
  }
  return g;
};

export const Bgm: React.FC<{ parts: BgmPart[]; duck?: Duck[] }> = ({ parts, duck = [] }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {parts.map((m, i) => {
        const f0 = Math.round(m.from * fps), f1 = Math.round(m.to * fps);
        const fi = m.fadeIn ?? 0.01, fo = m.fadeOut ?? 0.05, len = m.to - m.from;
        return (
          <Sequence key={i} from={f0} durationInFrames={Math.max(1, f1 - f0)} name={`曲 ${i + 1}`} layout="none">
            <Audio src={staticFile(m.file)} startFrom={Math.round((m.offset ?? 0) * fps)}
              volume={(fr) => { const tt = fr / fps; return Math.max(0, (m.vol ?? 0.1) * Math.min(1, tt / fi, (len - tt) / fo) * duckGain(m.from + tt, duck)); }} />
          </Sequence>
        );
      })}
    </>
  );
};

export type SeItem = { file: string; at: number; vol?: number; rate?: number };
export const SeTrack: React.FC<{ items: SeItem[] }> = ({ items }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {items.map((x, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(x.at * fps))} name={`SE ${x.file}`} layout="none">
          <Audio src={staticFile(x.file)} volume={x.vol ?? 0.25} playbackRate={x.rate ?? 1} />
        </Sequence>
      ))}
    </>
  );
};

/**
 * よく使う重ね方（dir＝SE のフォルダ。合成SE は motion-kit/audio/synth_se.py で作る）。
 * 迫る音（riser・rush）が鳴っている所に打撃音を重ねると「ノイズ」に聞こえることがある（書籍のトレーラー）→ 迫る音は落ちの頭で鳴りきるように早めから
 */
export const hit = (kind: keyof typeof HITS, at: number, dir = "se", gain = 1): SeItem[] =>
  HITS[kind].map(([f, dt, v]) => ({ file: `${dir}/${f}`, at: at + dt, vol: v * gain }));
export const HITS = {
  /** ここぞの叩きつけ（どどーん） */
  slam: [["impact.wav", 0, 0.3], ["sub.wav", 0, 0.5]],
  /** いちばん強い一打（曲の頭・最後の一打に重ねる） */
  boom: [["boom.wav", 0, 0.32], ["sub_long.wav", 0, 0.55]],
  /** 文字がシュッと入る（入りの 0.2 秒前から鳴らすと間に合う） */
  swish: [["whoosh_short.wav", -0.15, 0.2]],
  /** 場面が切り替わる */
  pass: [["whoosh.wav", -0.25, 0.22]],
  /** ため（落ちの頭で鳴りきる。dur 4拍ぶんは riser_4s など長さ違いを選ぶ） */
  build: [["riser.wav", -2.6, 0.3]],
  /** 決定・きらん */
  shine: [["sparkle.wav", 0, 0.22]],
  /** デジタルの切り替え */
  glitch: [["glitch.wav", -0.05, 0.25]],
  /** 判定・ダイスの結果 */
  verdict: [["stinger.wav", 0, 0.28], ["sub.wav", 0, 0.3]],
} as const satisfies Record<string, ReadonlyArray<readonly [string, number, number]>>;
