/** 見本：合成した効果音（motion-kit/public/se、audio/synth_se.py）を1つずつ鳴らす。名前・分類・説明と、鳴っている間の目印 */
import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { ease, key, prog, Seq, useT } from "../kit/core";
import { Kinetic } from "../kit/text/Kinetic";
import cat from "../../public/se/se_catalog.json";
import type { Item } from "./common";

type Entry = { note: string; cat: string; dur: number; rms_db: number };
const CAT = cat as Record<string, Entry>;

const Meter: React.FC<{ dur: number }> = ({ dur }) => {
  const t = useT() - 0.3;
  const p = prog(t, 0, dur);
  const pulse = key(t, [0, 0.05, 0.5], [0, 1, 0.25], ease.quad);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 360, right: 360, top: 760, height: 8, background: "rgba(255,255,255,0.12)", borderRadius: 4 }}>
        <div style={{ width: `${p * 100}%`, height: "100%", background: "#e2b04e", borderRadius: 4 }} />
      </div>
      <div style={{ position: "absolute", left: 960 - 60, top: 300 - 60, width: 120, height: 120, borderRadius: "50%", border: "4px solid rgba(226,176,78,0.9)", opacity: t >= 0 && t < dur + 0.2 ? 0.3 + 0.7 * pulse : 0.15, transform: `scale(${1 + 0.4 * pulse})` }} />
    </AbsoluteFill>
  );
};

export const seItems = (): Item[] =>
  Object.entries(CAT).map(([name, e]) => {
    const len = Math.min(4.5, Math.max(1.4, e.dur + 0.7));
    return {
      name: `SE：${name}（${e.cat}）`, note: `${e.note}　${e.dur.toFixed(2)}秒・平均 ${e.rms_db}dB`, len,
      node: (
        <>
          <Kinetic text={name} font="techMono" at={0} enter="none" hold="none" size={110} y={520} color="#f4f1ea" />
          <Meter dur={e.dur} />
          <Seq from={0.3}>
            <Audio src={staticFile(`se/${name}.wav`)} volume={0.3} />
          </Seq>
        </>
      ),
    };
  });
