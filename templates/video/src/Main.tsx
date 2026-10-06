// timeline.ts を読んで動画にする。見た目を変えたいときだけここを触る
import React from "react";
import { AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BGM, CAPTIONS, ENDING, FADE, FPS, IMPACTS, MAIN_SEC, NARRATION, SCENES, SE, Scene } from "./timeline";

const useT = () => useCurrentFrame() / useVideoConfig().fps;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const FONT = "'Noto Sans JP','Yu Gothic UI','Hiragino Sans',sans-serif";

/** 場面の背景。カメラ（拡大）は控えめに。大きく・速く動かすと見ていて疲れる */
const SceneView: React.FC<{ s: Scene }> = ({ s }) => {
  const t = useT();
  const len = s.t[1] - s.t[0];
  const z = s.zoom ? interpolate(t, [0, len], s.zoom, { ...clamp, easing: Easing.inOut(Easing.quad) }) : 1;
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", transform: `scale(${z})` };
  return (
    <AbsoluteFill style={{ background: s.color ?? "#000", overflow: "hidden" }}>
      {s.src && (s.kind === "video" ? <OffthreadVideo src={staticFile(s.src)} startFrom={Math.round((s.from ?? 0) * FPS)} muted style={style} /> : <Img src={staticFile(s.src)} style={style} />)}
    </AbsoluteFill>
  );
};

/** テロップ：黒い帯と文字だけ（罫線・光・小さな英字・点滅などの飾りは足さない） */
const Caption: React.FC<{ text: string; len: number }> = ({ text, len }) => {
  const t = useT();
  const op = Math.min(interpolate(t, [0, 0.15], [0, 1], clamp), interpolate(t, [len - 0.12, len], [1, 0], clamp));
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 70, opacity: op }}>
      <div style={{ background: "rgba(0,0,0,0.78)", color: "#fff", fontSize: 54, fontWeight: 700, padding: "14px 36px", borderRadius: 10, maxWidth: "86%", lineHeight: 1.35, textAlign: "center", fontFamily: FONT }}>{text}</div>
    </AbsoluteFill>
  );
};

/** ここぞの大文字：大きく入って、少し行き過ぎて戻る */
const Impact: React.FC<{ text: string; len: number }> = ({ text, len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 11, stiffness: 180, mass: 0.6 } });
  const out = interpolate(frame / fps, [len - 0.2, len], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: out }}>
      <div style={{ fontSize: 260, fontWeight: 900, color: "#fff", transform: `scale(${interpolate(s, [0, 1], [1.6, 1])})`, textShadow: "0 0 40px rgba(0,0,0,0.9), 0 8px 0 rgba(0,0,0,0.6)", fontFamily: FONT }}>{text}</div>
    </AbsoluteFill>
  );
};

export const Main: React.FC = () => {
  const { fps } = useVideoConfig();
  const t = useT();
  const f = (sec: number) => Math.max(1, Math.round(sec * fps));
  const bgm = BGM;
  // 暗転は全体に1枚かぶせる（場面ごとにかけると、立ち絵やテロップだけ残る）
  const fade = interpolate(t, [MAIN_SEC - FADE, MAIN_SEC], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {SCENES.map((s, i) => <Sequence key={i} from={Math.round(s.t[0] * fps)} durationInFrames={f(s.t[1] - s.t[0])}><SceneView s={s} /></Sequence>)}
      {IMPACTS.map((m, i) => <Sequence key={i} from={Math.round(m.at * fps)} durationInFrames={f(m.dur)}><Impact text={m.text} len={m.dur} /></Sequence>)}
      {CAPTIONS.map((c, i) => <Sequence key={i} from={Math.round(c.t[0] * fps)} durationInFrames={f(c.t[1] - c.t[0])}><Caption text={c.text} len={c.t[1] - c.t[0]} /></Sequence>)}
      <AbsoluteFill style={{ background: "#000", opacity: fade }} />
      {ENDING && <Sequence from={Math.round(MAIN_SEC * fps)} durationInFrames={f(ENDING.dur)}><OffthreadVideo src={staticFile(ENDING.src)} style={{ width: "100%", height: "100%" }} /></Sequence>}
      {NARRATION && <Audio src={staticFile(NARRATION)} />}
      {bgm && <Audio src={staticFile(bgm.src)} volume={(fr) => bgm.volume * interpolate(fr / fps, [MAIN_SEC - FADE, MAIN_SEC], [1, 0], clamp)} />}
      {SE.map((e, i) => <Sequence key={i} from={Math.round(e.at * fps)}><Audio src={staticFile(e.src)} volume={e.volume ?? 0.25} /></Sequence>)}
    </AbsoluteFill>
  );
};
