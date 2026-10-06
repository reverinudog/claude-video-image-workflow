import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { JizuraProject, Loaded, loadJizura, withSeededRandom } from "./load";

/**
 * JIZURA の文字PVを1枚のレイヤーとして描く。
 * ・transparent: true で背景なし（下に実写や立ち絵を置いて合成できる）
 * ・offset: このレイヤーの0秒を曲の何秒にするか（途中から使うとき）
 */
export const JizuraLayer: React.FC<{ project: JizuraProject; song?: string | null; transparent?: boolean; offset?: number; style?: React.CSSProperties }> = ({
  project, song = null, transparent = false, offset = 0, style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState<Loaded | null>(null);
  const [handle] = useState(() => delayRender("JIZURA の準備（構成・フォント）"));

  useEffect(() => {
    let alive = true;
    loadJizura(project, song)
      .then((l) => { if (alive) setReady(l); continueRender(handle); })
      .catch((e) => { console.error(e); continueRender(handle); throw e; });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(project), song]);

  useLayoutEffect(() => {
    const c = canvas.current;
    if (!c || !ready) return;
    const ctx = c.getContext("2d", { alpha: true })!;
    const t = frame / fps + offset;
    // 紙の質感などの模様は初回描画時に Math.random で作られるので、毎回同じ乱数で包む
    withSeededRandom(project.seed ?? 1, () => ready.renderer.frame(ctx, ready.plan, t, { scale: width / ready.W, transparent }));
  }, [frame, ready, fps, offset, transparent, width, project.seed]);

  return (
    <AbsoluteFill style={style}>
      <canvas ref={canvas} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
