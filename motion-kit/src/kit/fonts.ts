/**
 * 書体。Google Fonts から「使う書体だけ・使う文字だけ」読み込む（書き出し時はネットが要る）。
 * 部品の中で useGlyphs(key, weight, text) を呼ぶと、その文字が読み込まれるまでコマの書き出しを待つ。
 *
 * 書体を選ぶ目安（docs/research/motion-techniques.md も参照）
 *   本格・シリアス・ミステリー … mincho（しっぽり明朝B1）／zenOld（Zen Old Mincho）／notoSerif
 *   解説・UI・読みやすさ       … gothic（Noto Sans JP、太さ自由）／zenKaku
 *   ポップ・かわいい           … maru／mochiy／kiwi／mplusRounded
 *   ここぞの太い叩きつけ       … dela（Dela Gothic One）／reggae（荒い）／rocknroll
 *   和・筆・手書き             … yuji（筆の明朝）／klee（鉛筆）／hina（細い明朝）／antique／kaisei
 *   デジタル・AI・レトロ       … dot（DotGothic16）／orbitron／techMono
 *   英字（和文と組む）         … cinzel（ファンタジー・格調）／cormorant（上品）／playfair（雑誌）／bebas・anton・oswald（細長い見出し）／montserrat
 */
import { continueRender, delayRender } from "remotion";

type FontDef = { family: string; q: string; fallback: string };
const serif = "'Noto Serif JP', serif", sans = "'Noto Sans JP', sans-serif";

export const FONTS = {
  mincho: { family: "Shippori Mincho B1", q: "Shippori+Mincho+B1:wght@400;500;600;700;800", fallback: serif },
  zenOld: { family: "Zen Old Mincho", q: "Zen+Old+Mincho:wght@400;700;900", fallback: serif },
  notoSerif: { family: "Noto Serif JP", q: "Noto+Serif+JP:wght@200..900", fallback: "serif" },
  hina: { family: "Hina Mincho", q: "Hina+Mincho", fallback: serif },
  yuji: { family: "Yuji Syuku", q: "Yuji+Syuku", fallback: serif },
  antique: { family: "Zen Antique", q: "Zen+Antique", fallback: serif },
  kaisei: { family: "Kaisei Decol", q: "Kaisei+Decol:wght@400;500;700", fallback: serif },
  gothic: { family: "Noto Sans JP", q: "Noto+Sans+JP:wght@100..900", fallback: "sans-serif" },
  zenKaku: { family: "Zen Kaku Gothic New", q: "Zen+Kaku+Gothic+New:wght@300;400;500;700;900", fallback: sans },
  maru: { family: "Zen Maru Gothic", q: "Zen+Maru+Gothic:wght@300;400;500;700;900", fallback: sans },
  mplusRounded: { family: "M PLUS Rounded 1c", q: "M+PLUS+Rounded+1c:wght@400;700;800;900", fallback: sans },
  kiwi: { family: "Kiwi Maru", q: "Kiwi+Maru:wght@300;400;500", fallback: sans },
  mochiy: { family: "Mochiy Pop One", q: "Mochiy+Pop+One", fallback: sans },
  dela: { family: "Dela Gothic One", q: "Dela+Gothic+One", fallback: sans },
  reggae: { family: "Reggae One", q: "Reggae+One", fallback: sans },
  rocknroll: { family: "RocknRoll One", q: "RocknRoll+One", fallback: sans },
  klee: { family: "Klee One", q: "Klee+One:wght@400;600", fallback: sans },
  dot: { family: "DotGothic16", q: "DotGothic16", fallback: "monospace" },
  cinzel: { family: "Cinzel", q: "Cinzel:wght@400..900", fallback: "serif" },
  cormorant: { family: "Cormorant Garamond", q: "Cormorant+Garamond:wght@400;500;600;700", fallback: "serif" },
  playfair: { family: "Playfair Display", q: "Playfair+Display:wght@400..900", fallback: "serif" },
  bebas: { family: "Bebas Neue", q: "Bebas+Neue", fallback: "sans-serif" },
  anton: { family: "Anton", q: "Anton", fallback: "sans-serif" },
  oswald: { family: "Oswald", q: "Oswald:wght@200..700", fallback: "sans-serif" },
  montserrat: { family: "Montserrat", q: "Montserrat:wght@100..900", fallback: "sans-serif" },
  orbitron: { family: "Orbitron", q: "Orbitron:wght@400..900", fallback: "sans-serif" },
  techMono: { family: "Share Tech Mono", q: "Share+Tech+Mono", fallback: "monospace" },
} satisfies Record<string, FontDef>;
export type FontKey = keyof typeof FONTS;

/** CSS の font-family（読み込み前・失敗時の代わりつき） */
export const fam = (k: FontKey) => `'${FONTS[k].family}', ${FONTS[k].fallback}`;

const sheets = new Map<FontKey, Promise<void>>();
const loadSheet = (k: FontKey) => {
  if (typeof document === "undefined") return Promise.resolve();
  let p = sheets.get(k);
  if (!p) {
    p = new Promise<void>((res) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${FONTS[k].q}&display=block`;
      link.onload = () => res();
      link.onerror = () => res();
      document.head.appendChild(link);
    });
    sheets.set(k, p);
  }
  return p;
};

const done = new Set<string>();
const pending = new Map<string, Promise<void>>();

/** その書体・太さで text の文字を読み込む（Promise）。部品の外で先に読み込みたいときにも使える */
export const loadGlyphs = (k: FontKey, weight: number | string, text: string) => {
  const id = `${k}|${weight}|${text}`;
  if (done.has(id)) return Promise.resolve();
  let p = pending.get(id);
  if (!p) {
    p = loadSheet(k)
      .then(() => document.fonts.load(`${weight} 64px '${FONTS[k].family}'`, text || "あ"))
      .then(() => { done.add(id); })
      .catch(() => { done.add(id); });
    pending.set(id, p);
  }
  return p;
};

/** 部品の中で呼ぶ：文字が読み込まれるまで書き出しを待つ */
export const useGlyphs = (k: FontKey, weight: number | string, text: string) => {
  const id = `${k}|${weight}|${text}`;
  if (done.has(id) || typeof document === "undefined") return;
  if (pending.has(id)) {
    // 同じ文字を別の部品が読み込み中：待つだけ
    const h = delayRender(`書体 ${k}`);
    pending.get(id)!.then(() => continueRender(h));
    return;
  }
  const h = delayRender(`書体 ${k}`);
  loadGlyphs(k, weight, text).then(() => continueRender(h));
};
