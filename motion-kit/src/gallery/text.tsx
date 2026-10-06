/** 見本：文字の入り方・消え方・書き方・書体 */
import React from "react";
import { type FontKey } from "../kit/fonts";
import { ENTER_LIST, EXIT_LIST, Kinetic } from "../kit/text/Kinetic";
import type { Item } from "./common";

// 入り方ごとに似合う文言
const SAMPLE: Record<string, { text: string; font?: FontKey; size?: number; latin?: FontKey }> = {
  rise: { text: "_あなたがしたい_*行動*" },
  drop: { text: "_発言したい_*セリフ*" },
  track: { text: "ぜんぶ、" },
  trackSlow: { text: "好きな物語を生きる", size: 120 },
  slam: { text: "*AI*_が_操る！", size: 240 },
  stamp: { text: "^大失敗^", size: 230, font: "dela" },
  type: { text: "ゲームマスターは、", size: 130 },
  fade: { text: "_その扉の先に、_|答えがある。", size: 120 },
  float: { text: "まだ見ぬ*物語*へ", size: 140 },
  pop: { text: "しかも*これだけ*！！", font: "mochiy", size: 140 },
  wave: { text: "わいわい*セッション*", font: "maru", size: 130 },
  zoomOut: { text: "*本格RPG*", size: 240 },
  zoomIn: { text: "_そして──_|*幕が上がる*", size: 150 },
  wipe: { text: "*錬成*_で_装備を強化", size: 130 },
  light: { text: "*Sample Stories*", latin: "cinzel", size: 150 },
  bar: { text: "第一章　*目覚め*", size: 130, font: "zenKaku" },
  split: { text: "*光*_と_*影*", size: 220 },
  flip: { text: "運命が*めくれる*", size: 150 },
  skew: { text: "*BATTLE START*", latin: "anton", size: 180 },
  scramble: { text: "*AI*_が_解析中", font: "dot", size: 150 },
  flicker: { text: "^犯人^_は_誰だ", size: 170 },
  weight: { text: "*TRPG*_風_キャラシ", font: "gothic", size: 150 },
  outline: { text: "*新スキル*獲得", size: 160, font: "gothic" },
  melt: { text: "_記憶が_|*溶けていく*", size: 150 },
  none: { text: "そのまま" },
};

export const enterItems = (): Item[] =>
  ENTER_LIST.filter((e) => e.key !== "none").map(({ key, note }) => {
    const s = SAMPLE[key] ?? { text: "見本の文字" };
    return { name: `入り：${key}`, note, len: 2.4, node: <Kinetic text={s.text} at={0.15} until={2.2} enter={key} exit="blur" size={s.size ?? 150} font={s.font} latin={s.latin} y={500} ghost={key === "slam"} /> };
  });

export const exitItems = (): Item[] =>
  EXIT_LIST.map(({ key, note }) => ({ name: `消え：${key}`, note, len: 2.0, node: <Kinetic text="_この場面は、_|*ここで終わる*" at={0} until={1.6} enter="none" exit={key} size={150} y={500} /> }));

export const markupItems = (): Item[] => [
  { name: "書き方：差し色・小さく・大きく", note: "*金* ^赤^ _小_ #大# ── 助詞は小さく、キーワードは大きく色を変える", len: 3, node: <Kinetic text="_これが_*#本格#*_の_^RPG^だ" at={0.1} until={2.8} enter="rise" size={150} y={480} /> },
  { name: "書き方：縁取りだけ", note: "~ふち~ … 塗りのある字と縁だけの字を組む（スタイリッシュ）", len: 3, node: <Kinetic text="~SOLID~ *TEXT*" latin="anton" font="gothic" at={0.1} until={2.8} enter="track" size={220} y={480} /> },
  { name: "書き方：震える", note: "!震える! … 不穏・怒り・バグ。1語だけに", len: 3, node: <Kinetic text="それは!嘘!だ" at={0.1} until={2.8} enter="fade" size={170} y={480} /> },
  { name: "書き方：ルビ", note: "{漢字|かんじ} … かたまりで動く", len: 3, node: <Kinetic text="{犯人|はんにん}_の_*{運命|さだめ}*" at={0.1} until={2.8} enter="rise" size={150} y={500} /> },
  { name: "書き方：時間差 [n]", note: "[0.5] … ここから先を0.5秒（unit×n）遅らせる。拍に乗せる", len: 3, node: <Kinetic text="_TRPG風の_|*本格*[0.5]*RPG*" at={0.1} until={2.8} enter="slam" size={200} y={480} /> },
  { name: "書き方：線 ──", note: "続く─は1本の線（字間が空かない）", len: 3, node: <Kinetic text="ほかにも──" at={0.1} until={2.8} enter="track" size={170} y={480} /> },
  { name: "縦書き", note: "vertical … 怪奇・和・独白。列は右から左へ", len: 3.2, node: <Kinetic text="_この扉の先に、_|*答え*_がある。_" vertical at={0.1} until={3} enter="fade" size={110} x={960} y={520} /> },
  { name: "下線", note: "underline … 入りの終わりに線を引く（多用しない）", len: 3, node: <Kinetic text="*提供*：〇〇株式会社" font="zenKaku" at={0.1} until={2.8} enter="rise" size={110} y={480} underline="#e2b04e" /> },
  { name: "光彩・縁取り", note: "glow／stroke … 明るい背景の上・ネオン", len: 3, node: <Kinetic text="NEON NIGHT" font="orbitron" color="#fff" glow="rgba(255,60,200,0.9)" at={0.1} until={2.8} enter="flicker" size={170} y={480} /> },
  { name: "後ろの暗がり shade", note: "黒い帯の代わりに文字の後ろだけやわらかく暗く", len: 3, node: <Kinetic text="_運命は、_|*ダイス*が決める。" shade={0.8} align="left" x={240} at={0.1} until={2.8} enter="rise" size={130} y={480} /> },
];

const FONT_SAMPLES: [FontKey, string, FontKey?][] = [
  ["mincho", "本格・シリアス"], ["zenOld", "格調・時代"], ["notoSerif", "端正な明朝"], ["hina", "繊細・儚い"], ["yuji", "筆・和・怪奇"], ["antique", "古書・レトロ"], ["kaisei", "装飾・物語"],
  ["gothic", "解説・UI"], ["zenKaku", "見出し・すっきり"], ["maru", "やさしい"], ["mplusRounded", "ポップ・丸"], ["kiwi", "ゆるい"], ["mochiy", "元気・ポップ"], ["dela", "ここぞの太字"],
  ["reggae", "荒い・勢い"], ["rocknroll", "ロック・遊び"], ["klee", "手書き・メモ"], ["dot", "ドット・レトロゲーム"],
];
export const fontItems = (): Item[] => [
  { name: "書体（和文）1", note: "fonts.ts の FONTS。キー名で指定", len: 4, node: <>{FONT_SAMPLES.slice(0, 9).map(([k, n], i) => <Kinetic key={k} text={`${k}　${n}　あいう`} font={k} weight={700} size={50} align="left" x={120 + (i % 2) * 880} y={200 + Math.floor(i / 2) * 150} at={0.05 + i * 0.05} enter="fade" hold="none" />)}</> },
  { name: "書体（和文）2", note: "", len: 4, node: <>{FONT_SAMPLES.slice(9).map(([k, n], i) => <Kinetic key={k} text={`${k}　${n}　あいう`} font={k} weight={700} size={50} align="left" x={120 + (i % 2) * 880} y={200 + Math.floor(i / 2) * 150} at={0.05 + i * 0.05} enter="fade" hold="none" />)}</> },
  { name: "書体（英字）", note: "latin に指定すると英数字だけその書体になる", len: 4, node: <>{(["cinzel", "cormorant", "playfair", "bebas", "anton", "oswald", "montserrat", "orbitron", "techMono"] as FontKey[]).map((k, i) => <Kinetic key={k} text={`${k}  Sample Stories 2026`} font={k} weight={700} size={50} align="left" x={120 + (i % 2) * 880} y={200 + Math.floor(i / 2) * 150} at={0.05 + i * 0.05} enter="fade" hold="none" />)}</> },
];
