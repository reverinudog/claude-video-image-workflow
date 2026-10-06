/**
 * 組み合わせの見本（約21秒）：kit の部品だけで、拍に合わせた短いトレーラーを組むとこうなる、という例。
 * 曲は 150BPM・最初の拍 0.085秒の曲を想定（public/demo/ に自分の曲を置き、motion-kit/audio/song_map.py で測った値に合わせる）。
 * 構成：曲なしの導入 → 曲の頭の一打で叩きつけ → 2拍ずつの連打（つなぎで流す）→ 2.5D の紹介 → 壁の「ため」→ 白く飛んで締め
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { beatGrid } from "../kit/core";
import { Kinetic } from "../kit/text/Kinetic";
import { Telop } from "../kit/text/Telop";
import { Burst, Fade, Flare, Shockwave, Shake, Sparks } from "../kit/fx/impact";
import { Floaters, Fog, Grain, Vignette } from "../kit/fx/atmos";
import { Aurora, Figure, KenBurns, Parallax, Spotlight, Tiles } from "../kit/bg/scene";
import { Shots, type ShotDef } from "../kit/trans/Shots";
import { Bgm, hit, SeTrack, type SeItem } from "../kit/audio/sound";

export const PRE = 2.0; // 曲が始まるまで
const g = beatGrid(150, PRE + 0.085);
const vb = g.vb, B = g.beat;
const len = (beats: number) => beats * B;
const SONG16 = 0.085 + 64 * 0.4; // 曲の16小節の頭（一番強い一打）
export const SHOWCASE_LEN = vb(44) + 1.2;

const clip = (f: string, from: number) => <OffthreadVideo src={staticFile(f)} startFrom={Math.round(from * 30)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
const Scene = ({ f, l, dim = 0.45, c = [960, 330] as [number, number] }: { f: string; l: number; dim?: number; c?: [number, number] }) => <KenBurns file={f} len={l} zoom={[1.6, 1.64]} center={c} dim={dim} />;

const shots: ShotDef[] = [
  // 導入（曲なし）：闇に照明・霧・小さな文字
  { len: PRE + 0.085, name: "導入", node: (
    <>
      <Spotlight on={0.5} />
      <Fog opacity={0.3} low />
      <Kinetic text="_ようこそ、_" at={0.6} until={PRE + 0.085} enter="fade" exit="cut" size={110} y={520} font="mincho" />
    </>
  ) },
  // 曲の頭の一打：叩きつけ（2小節）
  { len: len(8), name: "叩きつけ", in: { type: "flash" }, node: (
    <Shake events={[{ at: 0, power: 18 }]}>
      <Aurora colors={["30,60,40", "20,90,60", "16,227,70"]} />
      <Floaters kind="dust" />
      <Shockwave at={0} y={560} color="140,255,170" />
      <Kinetic text="*犯人*_の_" at={0} until={len(8)} enter="slam" size={250} y={430} ghost a1="linear-gradient(180deg,#d9ffe2,#10e346 60%,#0a7a2a)" />
      <Kinetic text="卓へ。" at={len(2)} until={len(8)} enter="stamp" size={200} y={700} />
    </Shake>
  ) },
  // 2拍ずつの連打：入り方を変え、左右に振る（同じ入り方を続けない）
  { len: len(2), name: "連打1", in: { type: "whip", dir: "left" }, node: <><Scene f="demo/scene_58.jpg" l={len(2)} /><Kinetic text="シナリオを*書く*" at={0} enter="rise" exit="cut" size={150} x={150} align="left" y={760} shade={0.6} /></> },
  { len: len(2), name: "連打2", in: { type: "whip", dir: "left" }, node: <><Scene f="demo/scene_66.jpg" l={len(2)} /><Kinetic text="物語を*動かす*" at={0} enter="drop" exit="cut" size={150} x={1770} align="right" y={760} shade={0.6} /></> },
  { len: len(2), name: "連打3", in: { type: "slide", dir: "up" }, node: <><AbsoluteFill>{clip("demo/dice.mp4", 11)}</AbsoluteFill><AbsoluteFill style={{ background: "rgba(5,6,10,0.35)" }} /><Kinetic text="ダイスに*祈る*" at={0} enter="split" exit="cut" size={170} y={520} /></> },
  { len: len(2), name: "連打4", in: { type: "glitch" }, node: <><Scene f="demo/scene_35.jpg" l={len(2)} dim={0.55} /><Kinetic text="^犯人^_を_暴く" at={0} enter="scramble" exit="cut" size={170} y={520} font="dot" /></> },
  // 2.5D の紹介：層を奥行きで分けてゆっくり横へ
  { len: len(8), name: "紹介", in: { type: "fade", dur: 0.3 }, node: (
    <>
      <Parallax len={len(8)} cam={[{ x: -50, zoom: 1.0 }, { x: 50, zoom: 1.04 }]} layers={[
        // 遠景：ゲーム画面の上の方だけ（台詞欄・UI を入れない）
        { node: <KenBurns file="demo/scene_66.jpg" len={len(8)} zoom={[1.7, 1.7]} center={[960, 320]} dim={0.5} filter="blur(3px)" />, depth: 0.25 },
        { node: <Floaters kind="embers" n={40} />, depth: 0.6 },
        { node: <Figure file="demo/logo.png" x={1250} y={1080} h={980} at={0.1} enter="slide" shadowColor="rgba(16,227,70,0.55)" />, depth: 1.0 },
      ]} />
      <Telop look="lower" at={0.5} until={len(8)} text="山田 太郎|シナリオライター／配信者" accent="#10e346" />
      <Kinetic text="_遊びの_|*仕掛け人*" at={len(1)} until={len(8)} enter="trackSlow" size={150} x={160} align="left" y={420} shade={0.7} />
    </>
  ) },
  // ため：画面の壁が灯って「ぜんぶ、」→ 白く飛ぶ
  { len: len(8), name: "ため", in: { type: "zoom" }, node: (
    <>
      <Tiles cols={5} rows={4} tilt len={len(8)} tiles={[clip("demo/alchemy.mp4", 5), clip("demo/dice.mp4", 10), <KenBurns file="demo/scene_58.jpg" len={4} dim={0} />, clip("demo/dice.mp4", 3), <KenBurns file="demo/scene_66.jpg" len={4} dim={0} />, clip("demo/alchemy.mp4", 9), <KenBurns file="demo/scene_35.jpg" len={4} dim={0} />]} />
      <Kinetic text="ぜんぶ、" at={len(2)} until={len(8)} enter="trackSlow" exit="light" size={230} />
    </>
  ) },
  // 締め：一番強い一打で叩きつけ（火花・光の広がり・光の筋）
  { len: len(12), name: "締め", in: { type: "dipWhite", dur: 0.5 }, node: (
    <Shake events={[{ at: 0, power: 14 }]}>
      <Aurora />
      <Floaters kind="bokeh" />
      <Burst at={0} y={500} />
      <Sparks at={0} x0={520} x1={1400} y={500} n={150} />
      <Kinetic text="*みんな*_と、_" at={0} until={len(12)} enter="zoomOut" size={230} y={460} ghost />
      <Kinetic text="遊ぼう。" at={len(2)} until={len(12)} enter="fade" size={120} y={700} />
      <Flare at={len(4)} x={960} y={600} len={1600} />
    </Shake>
  ) },
];

const se: SeItem[] = [
  { file: "se/drone_dark.wav", at: 0, vol: 0.25 },
  { file: "se/riser_2s.wav", at: PRE + 0.085 - 2.0, vol: 0.28 },
  ...hit("boom", vb(0)),
  { file: "se/impact.wav", at: vb(2), vol: 0.26 },
  ...[8, 10].flatMap((b) => hit("swish", vb(b))),
  { file: "se/hit_short.wav", at: vb(8), vol: 0.22 },
  { file: "se/hit_short.wav", at: vb(10), vol: 0.22 },
  { file: "se/whoosh.wav", at: vb(12) - 0.2, vol: 0.2 },
  { file: "se/hit_short.wav", at: vb(12), vol: 0.22 },
  ...hit("glitch", vb(14)),
  { file: "se/whoosh_long.wav", at: vb(16) - 0.3, vol: 0.18 },
  { file: "se/sparkle.wav", at: vb(17), vol: 0.2 },
  { file: "se/riser_4s.wav", at: vb(32) - 4.0, vol: 0.3 },
  ...hit("boom", vb(32)),
  { file: "se/shimmer_up.wav", at: vb(36), vol: 0.2 },
];

export const Showcase: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Shots shots={shots} />
    <Grain opacity={0.07} />
    <Vignette />
    <Bgm parts={[
      { file: "demo/hero.mp3", from: PRE, to: vb(32) + 0.03, offset: 0, vol: 0.75, fadeIn: 0.005, fadeOut: 0.06 },
      { file: "demo/hero.mp3", from: vb(32) - 0.03, to: SHOWCASE_LEN, offset: SONG16 - 0.03, vol: 0.75, fadeIn: 0.06, fadeOut: 1.4 },
    ]} />
    <SeTrack items={se} />
    <Fade at={SHOWCASE_LEN - 1.2} dur={1.1} />
  </AbsoluteFill>
);
