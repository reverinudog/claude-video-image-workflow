import React from "react";
import { CalculateMetadataFunction, Composition, registerRoot } from "remotion";
import { LyricLayer, LyricMV } from "./Main";
import { SONG } from "./song";
import { outputSize, planOnly } from "./jizura/load";

// 長さ・サイズ・fps は song.ts の設定と JIZURA の構成から自動で決まる
const meta: CalculateMetadataFunction<Record<string, unknown>> = async () => {
  const plan = await planOnly(SONG.project, SONG.audio);
  const fps = SONG.project.fps ?? 30;
  const [width, height] = outputSize(SONG.project);
  return { durationInFrames: Math.max(1, Math.ceil(plan.duration * fps)), fps, width, height };
};

const base = { durationInFrames: 300, fps: 30, width: 1920, height: 1080, calculateMetadata: meta, defaultProps: {} };

const Root: React.FC = () =>
  React.createElement(React.Fragment, null,
    React.createElement(Composition, { id: "LyricMV", component: LyricMV, ...base }),
    React.createElement(Composition, { id: "LyricLayer", component: LyricLayer, ...base }),
  );

registerRoot(Root);
