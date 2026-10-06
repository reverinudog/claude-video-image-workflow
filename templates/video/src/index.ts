import React from "react";
import { Composition, registerRoot } from "remotion";
import { Main } from "./Main";
import { FPS, HEIGHT, TOTAL_SEC, WIDTH } from "./timeline";

const Root: React.FC = () =>
  React.createElement(Composition, { id: "Main", component: Main, durationInFrames: Math.ceil(TOTAL_SEC * FPS), fps: FPS, width: WIDTH, height: HEIGHT });

registerRoot(Root);
