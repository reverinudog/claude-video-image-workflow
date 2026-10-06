/** 見本ギャラリーの共通部品：区切りごとの名札と背景 */
import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useVideoConfig } from "remotion";
import { fam, useGlyphs } from "../kit/fonts";

/** 見本の背景（暗い紺のにじみ。文字の見え方を判断しやすい中間の暗さ） */
export const DemoBg: React.FC<{ img?: string; dim?: number }> = ({ img, dim = 0.55 }) => (
  <AbsoluteFill style={{ background: "radial-gradient(ellipse 80% 70% at 50% 45%, #1d2235 0%, #0b0e18 60%, #05060a 100%)" }}>
    {img && (
      <>
        <Img src={staticFile(img)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <AbsoluteFill style={{ background: `rgba(5,6,10,${dim})` }} />
      </>
    )}
  </AbsoluteFill>
);

/** 左下の名札：部品の名前と使いどころ */
export const Label: React.FC<{ name: string; note?: string; no?: number }> = ({ name, note, no }) => {
  const txt = `${no ?? ""}${name}${note ?? ""}`;
  useGlyphs("gothic", 700, txt);
  useGlyphs("gothic", 400, txt);
  const { height } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 48, top: height > 1200 ? 120 : 28, right: 48, fontFamily: fam("gothic"), color: "#e8e6df", textShadow: "0 2px 8px #000", zIndex: 10 }}>
      <div style={{ fontSize: 34, fontWeight: 700 }}>
        {no !== undefined && <span style={{ color: "#8b93a8", marginRight: 16 }}>{String(no).padStart(2, "0")}</span>}
        {name}
      </div>
      {note && <div style={{ fontSize: 24, fontWeight: 400, color: "#b9bccb", marginTop: 4 }}>{note}</div>}
    </div>
  );
};

/** 区切りを順に並べる（items の len 秒ずつ） */
export type Item = { name: string; note?: string; len: number; node: React.ReactNode; bg?: React.ReactNode };
export const Reel: React.FC<{ items: Item[]; fps: number; noLabel?: boolean }> = ({ items, fps, noLabel }) => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {items.map((it, i) => {
        const f0 = from;
        from += Math.round(it.len * fps);
        return (
          <Sequence key={i} from={f0} durationInFrames={Math.round(it.len * fps)} name={it.name}>
            {it.bg ?? <DemoBg />}
            {it.node}
            {!noLabel && <Label name={it.name} note={it.note} no={i + 1} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
export const reelLen = (items: Item[], fps: number) => items.reduce((a, it) => a + Math.round(it.len * fps), 0);
