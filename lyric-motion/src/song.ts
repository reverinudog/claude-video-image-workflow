/**
 * ===== リリックMVの編集データ（ここを書き換えれば動画が変わる） =====
 *
 * 歌詞の書き方（JIZURAと同じ）
 *   1行 = 1フレーズ
 *   夜明けの色を/覚えてる   … / でカットの切れ目
 *   *透明*                  … 強調（大きく・派手な演出が選ばれやすい）
 *   行末の !                … フラッシュと揺れ
 *   歌詞|注釈               … 小さな注釈文字
 *   [01:23.45]歌詞          … その行の開始時刻を指定（LRC形式）
 *
 * 曲を使うとき：public/ に置いて audio にファイル名。BPMと拍を自動検出してカットを拍に合わせる
 * 見た目を変える：style（下の一覧）・seed（数字を変えるだけで別の構成）・fx（動きの強さなど）
 */
import type { JizuraProject } from "./jizura/load";

export const SONG: {
  audio: string | null; // public/ 内の曲ファイル。null なら歌詞の長さから自動でタイミングを決める
  project: JizuraProject;
  /** 文字の下に敷くもの（null なら JIZURA のスタイルの背景をそのまま使う） */
  background: null | { src: string; type: "image" | "video"; dim?: number };
  /** 立ち絵を重ねる（public/stand/<pose>.png を自分で置く）（null で無し） */
  avatar: null | { pose: string; side: "left" | "right"; size?: number };
} = {
  audio: null,
  project: {
    title: "ダイスは転がる",
    artist: "Sample",
    lyrics: `[ti:ダイスは転がる]
今夜も/卓を囲んで
転がる/運命のダイス
*クリティカル*を信じてる!
正気度なんて/あとで考えよう
ねえ、/この物語の/結末は
*君が決める*!`,
    style: "noir",
    seed: 20260924,
    aspect: "16:9",
    res: 1080,
    fps: 30,
    keyBg: "off",
    extra: true,
    wa: false,
    fx: { motion: 0.75, glitch: 0.5, chroma: 0.7, decor: 0.55, density: 0.55, texture: 0.6, koma: 12 },
  },
  background: null,
  avatar: null, // 例：{ pose: "wave", side: "right", size: 520 }（public/stand/wave.png を置く）
};
