/**
 * motion-kit の見本ギャラリー。npm run studio で一覧、書き出しは
 *   ./node_modules/.bin/remotion render src/index.ts GalleryAll out/motion-kit_gallery_v1.mp4 --concurrency=4
 * 見た目のカタログ（HTML）は node tools/catalog.mjs（名札なしで書き出して部品ごとに切る）
 */
import React from "react";
import { Composition, registerRoot } from "remotion";
import { Reel, reelLen, type Item } from "./gallery/common";
import { enterItems, exitItems, fontItems, markupItems } from "./gallery/text";
import { atmosItems, bgItems, filterItems, impactItems, telopItems, transItems } from "./gallery/fx";
import { Showcase, SHOWCASE_LEN } from "./gallery/showcase";
import { seItems } from "./gallery/se";

const FPS = 30;
/** 見本のかたまり：コンポジション名 → [カタログの分類, 部品を作る関数] */
const reels: Record<string, [string, () => Item[]]> = {
  GalleryEnter: ["文字の入り方", enterItems],
  GalleryExit: ["文字の消え方", exitItems],
  GalleryMarkup: ["文字の書き方", markupItems],
  GalleryFonts: ["書体", fontItems],
  GalleryImpact: ["一瞬の効果", impactItems],
  GalleryAtmos: ["空気・質感", atmosItems],
  GalleryFilter: ["加工・色", filterItems],
  GalleryBg: ["背景・人物", bgItems],
  GalleryTelop: ["テロップ", telopItems],
  GalleryTrans: ["つなぎ", transItems],
  GallerySe: ["効果音", seItems],
};
// 映像の見本ぜんぶ（SE の見本は別：GallerySe）
const ALL: [string, Item[]][] = Object.entries(reels).filter(([k]) => k !== "GallerySe").map(([, [g, f]]) => [g, f()]);

type Meta = { start: number; len: number; name: string; note: string; group: string };
const indexOf = (groups: [string, Item[]][]): Meta[] => {
  let acc = 0;
  return groups.flatMap(([group, items]) => items.map((it) => {
    const s = acc, len = Math.round(it.len * FPS) / FPS;
    acc += len;
    return { start: +s.toFixed(3), len, name: it.name, note: it.note ?? "", group };
  }));
};

const reelComp = (id: string, groups: [string, Item[]][]) => {
  const items = groups.flatMap(([, it]) => it);
  // index：区切りの頭の秒・長さ・名前（tools/sheet.mjs --each と tools/catalog.mjs が使う）。noLabel：名札を出さない（カタログ用）
  return React.createElement(Composition, { key: id, id, component: ({ noLabel }: { noLabel?: boolean }) => React.createElement(Reel, { items, fps: FPS, noLabel }),
    durationInFrames: reelLen(items, FPS), fps: FPS, width: 1920, height: 1080, defaultProps: { index: indexOf(groups), noLabel: false } });
};

const Root: React.FC = () => {
  const comps = Object.entries(reels).map(([id, [g, make]]) => reelComp(id, [[g, make()]]));
  comps.push(reelComp("GalleryAll", ALL));
  comps.push(React.createElement(Composition, { key: "Showcase", id: "Showcase", component: Showcase, durationInFrames: Math.round(SHOWCASE_LEN * FPS), fps: FPS, width: 1920, height: 1080 }));
  return React.createElement(React.Fragment, null, ...comps);
};

registerRoot(Root);
