import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SONG } from "./song";
import { JizuraLayer } from "./jizura/JizuraLayer";

/** 立ち絵：ゆらゆら＋入場のスプリング（控えめ） */
const Avatar: React.FC<{ pose: string; side: "left" | "right"; size: number }> = ({ pose, side, size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inP = spring({ frame: frame - 6, fps, config: { damping: 14, stiffness: 120 } });
  const bob = Math.sin(frame / 14) * 6;
  return (
    <div
      style={{
        position: "absolute", bottom: -30, [side]: 30, width: size, height: size,
        transform: `translateY(${(1 - inP) * 300 + bob}px)`,
        filter: "drop-shadow(0 16px 30px #000a)",
      }}
    >
      <Img src={staticFile(`stand/${pose}.png`)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
    </div>
  );
};

export const LyricMV: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const bg = SONG.background;
  const composite = !!bg; // 背景を敷くときは JIZURA を透過で重ねる
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {bg && (
        <AbsoluteFill>
          {bg.type === "video"
            ? <OffthreadVideo src={staticFile(bg.src)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <Img src={staticFile(bg.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          <AbsoluteFill style={{ background: "#000", opacity: bg.dim ?? 0.45 }} />
        </AbsoluteFill>
      )}
      <JizuraLayer project={SONG.project} song={SONG.audio} transparent={composite} />
      {SONG.avatar && <Avatar pose={SONG.avatar.pose} side={SONG.avatar.side} size={SONG.avatar.size ?? 520} />}
      {SONG.audio && (
        <Audio
          src={staticFile(SONG.audio)}
          volume={(f) => interpolate(f, [durationInFrames - 20, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
        />
      )}
    </AbsoluteFill>
  );
};

/** 合成用：文字だけ（背景・立ち絵なし）。他の動画に重ねる素材を書き出すとき */
export const LyricLayer: React.FC = () => <JizuraLayer project={SONG.project} song={SONG.audio} transparent />;
