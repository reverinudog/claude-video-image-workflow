/**
 * 文字の書き方（Kinetic の text）
 *   *金色*        … 1つ目の差し色（既定は金のグラデーション。a1 で変える）
 *   ^赤^          … 2つ目の差し色（a2）
 *   _小さく_      … 助詞・語尾など（既定 0.5 倍。smallScale で変える）
 *   #大きく#      … キーワードをさらに大きく（既定 1.3 倍。bigScale）
 *   ~ふち~        … 縁取りだけ（中は透明）
 *   !震える!      … 小刻みに震える（不穏・怒り・バグ）
 *   |             … 改行（縦書きなら次の列）
 *   [0.8]         … ここから先の文字は Kinetic の at から 0.8×unit 秒あとに出る（unit の既定は1秒。拍で書くなら unit=1拍の秒）
 *   {本格|ほんかく} … ルビ（かたまりで動く）
 *   ──            … 続く─・—はすき間のない1本の線になる（docs/lessons/trailer.md「──は1本の線で」）
 *   \*            … 記号をそのまま出す
 */
export type Ch = {
  c: string;
  ruby?: string;
  a1: boolean;
  a2: boolean;
  small: boolean;
  big: boolean;
  outline: boolean;
  shake: boolean;
  dt: number;
  i: number; // 文字の通し番号（線・ルビも1つと数える）
  latin: boolean;
  dash?: number; // ─ の長さ（文字数）
};

const LATIN = /[A-Za-z0-9!?&.:'%+\-/@#$=,()"]/;

export const parse = (text: string): Ch[][] => {
  const lines: Ch[][] = [[]];
  let a1 = false, a2 = false, small = false, big = false, outline = false, shake = false, dt = 0, i = 0;
  const push = (c: string, ruby?: string) => {
    const line = lines[lines.length - 1];
    const last = line[line.length - 1];
    if ((c === "─" || c === "—") && last?.dash) { last.dash++; return; }
    line.push({ c, ruby, a1, a2, small, big, outline, shake, dt, i: i++, latin: c.length === 1 && LATIN.test(c), dash: c === "─" || c === "—" ? 1 : undefined });
  };
  for (let k = 0; k < text.length; k++) {
    const c = text[k];
    if (c === "\\" && k + 1 < text.length) { push(text[++k]); continue; }
    if (c === "*") { a1 = !a1; continue; }
    if (c === "^") { a2 = !a2; continue; }
    if (c === "_") { small = !small; continue; }
    if (c === "#") { big = !big; continue; }
    if (c === "~") { outline = !outline; continue; }
    if (c === "!") { shake = !shake; continue; }
    if (c === "|") { lines.push([]); continue; }
    if (c === "[") { const e = text.indexOf("]", k); if (e > k) { dt = Number(text.slice(k + 1, e)) || 0; k = e; continue; } }
    if (c === "{") {
      const e = text.indexOf("}", k), bar = text.indexOf("|", k);
      if (e > k && bar > k && bar < e) { push(text.slice(k + 1, bar), text.slice(bar + 1, e)); k = e; continue; }
    }
    push(c);
  }
  return lines;
};

/** 見た目の幅の見積もり（em）。和文1、英数0.62、小さい字は倍率をかける */
export const estimateWidth = (line: Ch[], smallScale: number, bigScale: number, spacing: number) =>
  line.reduce((a, ch) => {
    const k = ch.small ? smallScale : ch.big ? bigScale : 1;
    const w = ch.dash ? ch.dash : ch.c.length * (ch.latin ? 0.62 : 1);
    return a + (w + spacing) * k;
  }, 0);

/** 文字だけを並べた文字列（書体の読み込み用） */
export const plainText = (lines: Ch[][]) => lines.map((l) => l.map((c) => c.c + (c.ruby ?? "")).join("")).join("");
