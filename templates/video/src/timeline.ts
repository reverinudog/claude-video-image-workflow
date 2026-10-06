// 編集データの本体。動画の中身はここだけを書き換える（Main.tsx は読むだけ）。時間はすべて「秒」。
// ファイルは public/ に置き、名前で指す（例：public/clips/a.mp4 → "clips/a.mp4"）。

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** ナレーション（1本につないだもの。templates/narration で作る）。無ければ null */
export const NARRATION = null as string | null; // "narration.wav"

/** BGM。volume 0.1 が「元の音量から -20dB」。曲が主役の動画なら 1 に近づける */
export const BGM = null as { src: string; volume: number } | null; // { src: "bgm/main.mp3", volume: 0.1 }

/** 場面：背景に出すもの。src が無ければ color の単色。zoom は「さりげなく」（1.0→1.06 くらいまで）。from は動画素材の何秒目から使うか */
export type Scene = { t: [number, number]; src?: string; kind?: "image" | "video"; color?: string; zoom?: [number, number]; from?: number };
export const SCENES: Scene[] = [
  { t: [0, 4], color: "#10131a" },
  { t: [4, 9], color: "#1a1016", zoom: [1, 1.05] },
  { t: [9, 14], color: "#0f1a14" },
];

/** テロップ：正式な文言で。1つ＝ナレーションの1区間（音量をそろえる level.py もこの区切りを読む） */
export const CAPTIONS: { t: [number, number]; text: string }[] = [
  { t: [0.4, 3.6], text: "ここにテロップが出ます" },
  { t: [4.3, 8.6], text: "場面とテロップは timeline.ts に並べるだけ" },
  { t: [9.3, 13.2], text: "直すときも、このファイルの数字と文字を変える" },
];

/** ここぞの大文字（画面いっぱい）。同じ派手な演出をくり返さない */
export const IMPACTS: { at: number; dur: number; text: string }[] = [
  { at: 9.3, dur: 1.6, text: "ここぞ！" },
];

/** 効果音。volume は 0.2〜0.32（-10dB 前後）が目安 */
export const SE: { at: number; src: string; volume?: number }[] = [
  // { at: 9.3, src: "se/hit.mp3", volume: 0.3 },
];

/** 本編の最後を暗転する秒数と、そのあとにつなぐエンディング動画（無ければ null） */
export const FADE = 1.0;
export const ENDING = null as { src: string; dur: number } | null; // { src: "ending.mp4", dur: 6 }

export const MAIN_SEC = Math.max(...SCENES.map((s) => s.t[1]));
export const TOTAL_SEC = MAIN_SEC + (ENDING?.dur ?? 0);
