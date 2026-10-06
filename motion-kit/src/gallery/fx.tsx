/** 見本：効果・空気・加工・背景・テロップ・つなぎ */
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";
import { Burst, Confetti, Flare, Flash, FocusLines, RedPulse, Shockwave, Shake, Sparks, SpeedLines } from "../kit/fx/impact";
import { FLOAT_KINDS, Floaters, Fog, GodRays, Grain, Halftone, Letterbox, LightLeak, Scanlines, Vignette } from "../kit/fx/atmos";
import { ChromaticAberration, Duotone, Glitch, Grade, GRADES, type GradeName, Static } from "../kit/fx/filters";
import { Aurora, Figure, KenBurns, Parallax, Spotlight, Tiles } from "../kit/bg/scene";
import { Counter, Chip, Telop, TELOP_LOOKS, type TelopLook } from "../kit/text/Telop";
import { Kinetic } from "../kit/text/Kinetic";
import { Shots, TRANS_LIST, type ShotDef } from "../kit/trans/Shots";
import type { Item } from "./common";

// 見本の背景：ゲーム画面の上の方（台詞欄・UI が入らない所）を寄せて使う
const Key = ({ dim = 0.35 }: { dim?: number }) => <KenBurns file="demo/scene_35.jpg" len={3} zoom={[1.6, 1.64]} center={[960, 330]} dim={dim} />;
const Map = ({ dim = 0.35 }: { dim?: number }) => <KenBurns file="demo/scene_66.jpg" len={3} zoom={[1.6, 1.64]} center={[960, 330]} dim={dim} />;

/* ---------------- 一瞬の効果 ---------------- */
const Slam: React.FC<{ text: string; children?: React.ReactNode; shake?: number; size?: number }> = ({ text, children, shake = 18, size = 230 }) => (
  <Shake events={[{ at: 0.4, power: shake }]}>
    <Key />
    {children}
    <Kinetic text={text} at={0.4} until={2.4} enter="slam" size={size} ghost />
  </Shake>
);
export const impactItems = (): Item[] => [
  { name: "Flash＋Shake＋FocusLines", note: "どどーんの定番（集中線は続けて使わない）", len: 2.6, bg: <></>, node: <><Slam text="*AI*_が_操る！"><FocusLines at={0.4} until={2.2} /></Slam><Flash at={0.4} power={0.8} /></> },
  { name: "Sparks＋Burst", note: "集中線を使ったあとの別のここぞ（ゲーム紹介動画 の締め）", len: 2.6, bg: <></>, node: <><Slam text="*本格RPG*" shake={12}><Burst at={0.4} y={540} /><Sparks at={0.4} x0={560} x1={1360} y={540} n={150} /></Slam><Flash at={0.4} power={0.3} /></> },
  { name: "Shockwave", note: "輪が広がる。中くらいの叩きつけ・着地・発動", len: 2.4, bg: <></>, node: <><Slam text="発動" shake={8} size={200}><Shockwave at={0.4} /><Shockwave at={0.5} size={1300} width={4} /></Slam></> },
  { name: "Flare", note: "光の筋。決定・登場・ロゴ（白い文字の上の白い光は見えないので背景が暗い所で）", len: 2.4, bg: <Aurora />, node: <><Kinetic text="*Sample Stories*" latin="cinzel" font="cinzel" at={0.2} until={2.3} enter="zoomOut" size={130} /><Flare at={0.55} y={540} /></> },
  { name: "SpeedLines", note: "漫画の流線。疾走・突進・時間が飛ぶ", len: 2.4, bg: <Map dim={0.55} />, node: <><SpeedLines at={0.1} until={2.3} dir="left" /><Kinetic text="*全速力*_で_駆け抜けろ" at={0.2} until={2.3} enter="skew" size={150} /></> },
  { name: "RedPulse", note: "周りが赤く脈打つ。危険・ダメージ・警告", len: 2.2, bg: <Key dim={0.5} />, node: <><RedPulse at={0.3} /><RedPulse at={1.1} power={0.4} /><Kinetic text="^HP^ 残りわずか" at={0.3} until={2.1} enter="stamp" font="zenKaku" size={150} /></> },
  { name: "Confetti", note: "紙吹雪。祝い・達成・当選", len: 3.2, bg: <Aurora colors={["60,40,120", "160,60,120", "230,180,80"]} />, node: <><Confetti at={0.2} /><Burst at={0.3} /><Kinetic text="*祝*_・_100万再生" at={0.3} until={3} enter="pop" font="mochiy" size={140} /></> },
];

/* ---------------- 空気 ---------------- */
export const atmosItems = (): Item[] => [
  ...FLOAT_KINDS.map(({ key, note }) => ({ name: `舞い物：${key}`, note, len: 2.6, bg: <Key dim={0.55} />, node: <Floaters kind={key} /> })),
  { name: "Fog（霧）", note: "流れる霧。怪奇・朝・森（low で足元だけ）", len: 3, bg: <Spotlight />, node: <><Fog opacity={0.35} /><Fog opacity={0.45} low seed={7} speed={30} /><Figure file="demo/logo.png" x={960} y={1000} h={760} at={0} enter="none" dim={0.3} /><Fog opacity={0.3} low seed={11} speed={45} /></> },
  { name: "GodRays（差し込む光）", note: "上からの光の筋。神秘・教会・朝", len: 3, bg: <Map dim={0.6} />, node: <><GodRays x={600} /><Floaters kind="dust" /></> },
  { name: "LightLeak（光漏れ）", note: "暖かい光が流れる。懐かしさ・青春・回想", len: 3, bg: <Key dim={0.2} />, node: <LightLeak /> },
  { name: "Letterbox（シネスコの黒帯）", note: "映画っぽい間・重大な場面。入りと終わりで閉じて開く", len: 3, bg: <Key dim={0.15} />, node: <><Letterbox at={0.1} until={2.9} /><Kinetic text="_──そして、_|運命の夜が来る" at={0.6} until={2.8} enter="fade" size={90} /></> },
  { name: "Grain＋Vignette", note: "フィルムの粒子と周辺減光（全体に薄く敷く）", len: 2.4, bg: <Key dim={0} />, node: <><Grain opacity={0.12} /><Vignette power={0.5} /></> },
  { name: "Scanlines（走査線）", note: "ブラウン管・監視カメラ・配信画面", len: 2.4, bg: <Key dim={0.2} />, node: <Scanlines /> },
  { name: "Halftone（網点）", note: "漫画・ポップ・印刷物っぽさ", len: 2.4, bg: <Aurora colors={["200,40,80", "240,120,40", "255,220,80"]} />, node: <><Halftone /><Figure file="demo/happy.png" x={1300} y={1060} h={900} at={0.1} shadowColor="#ffcc33" /></> },
];

/* ---------------- 加工 ---------------- */
const clip = (f: string, from = 0) => <OffthreadVideo src={staticFile(f)} startFrom={from * 30} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
export const filterItems = (): Item[] => [
  { name: "Glitch", note: "色ズレ＋横に裂ける帯。デジタル・AI・不穏（短く）", len: 2.4, bg: <></>, node: <><Glitch at={0.5} dur={0.35}><Glitch at={1.5} dur={0.2} seed={4}><AbsoluteFill>{clip("demo/dice.mp4", 10)}</AbsoluteFill><Kinetic text="*SYSTEM* ERROR" font="orbitron" at={0} enter="none" size={140} /></Glitch></Glitch><Static at={0.5} dur={0.35} opacity={0.35} /></> },
  { name: "ChromaticAberration", note: "周辺だけの薄い色ズレ（レンズっぽさ）", len: 2.4, bg: <></>, node: <ChromaticAberration px={5}><Key dim={0.1} /></ChromaticAberration> },
  { name: "Duotone", note: "2色化。シナリオのトレーラーの赤黒・ポスター風・回想", len: 2.4, bg: <></>, node: <Duotone><Key dim={0} /></Duotone> },
  ...(Object.keys(GRADES) as GradeName[]).map((g) => ({ name: `Grade：${g}`, note: GRADES[g].note, len: 1.6, bg: <></>, node: <Grade name={g}><KenBurns file="demo/scene_58.jpg" len={1.6} zoom={[1.3, 1.32]} center={[960, 380]} dim={0} /></Grade> })),
];

/* ---------------- 背景・人物 ---------------- */
export const bgItems = (): Item[] => [
  { name: "KenBurns（上限つき）", note: "寄り引き4%・横70pxまで、1秒に1.2%・20pxまで（「さりげなく」）", len: 3, bg: <></>, node: <KenBurns file="demo/scene_58.jpg" len={3} zoom={[1.3, 1.5]} center={[[700, 380], [1300, 380]]} dim={0.1} /> },
  { name: "Parallax（2.5D）", note: "層を奥行きで分けてカメラを動かす：遠景は少し、立ち絵は大きく動く", len: 3.4, bg: <></>, node: (
    <Parallax len={3.4} cam={[{ x: -60, zoom: 1.0 }, { x: 60, zoom: 1.05 }]} layers={[
      { file: "demo/map_bg.png", depth: 0.3, style: { filter: "brightness(0.6) blur(2px)" } },
      { node: <Fog opacity={0.35} />, depth: 0.6 },
      { file: "demo/surprise.png", depth: 1, x: 300, y: 260, w: 800, h: 800 },
      { file: "demo/logo.png", depth: 1.5, x: 1050, y: 300, w: 820, h: 820, style: { filter: "drop-shadow(12px 8px 0 rgba(16,227,70,0.5))" } },
    ]} />
  ) },
  { name: "Figure（立ち絵）", note: "色つきの影・逆光のふち・弾んで入る。2人並べるなら顔の大きさと色調をそろえる", len: 3, bg: <Aurora />, node: <><Figure file="demo/happy.png" x={620} y={1060} h={860} at={0.1} shadowColor="rgba(226,176,78,0.9)" /><Figure file="demo/surprise.png" x={1320} y={1060} h={860} at={0.4} enter="slide" rim="rgba(160,220,255,0.9)" backlight="rgba(120,200,255,1)" /></> },
  { name: "Aurora", note: "素材なしの色のにじみ（締め・タイトル）", len: 2.6, bg: <></>, node: <><Aurora /><Kinetic text="*即売会*_で_お会いしましょう" at={0.2} until={2.5} enter="trackSlow" size={110} /></> },
  { name: "Spotlight", note: "闇に上から照明（素材なしの舞台・登場）。on 秒でちらついて点く", len: 3, bg: <></>, node: <><Spotlight on={0.6} /><Figure file="demo/logo.png" x={960} y={1000} h={760} at={0.6} enter="fade" /></> },
  { name: "Tiles（画面を並べる）", note: "2x2 でまとめて見せる（重要でない機能はテンポよく）", len: 3, bg: <></>, node: <Tiles cols={2} step={0.25} tiles={[clip("demo/alchemy.mp4", 5), clip("demo/dice.mp4", 10), <Img src={staticFile("demo/scene_58.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />, <Img src={staticFile("demo/map_bg.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />]} /> },
  { name: "Tiles（斜めの壁）", note: "画面いっぱいの壁を倒して奥行き。手前から奥へ灯り、奥は暗く（ため）", len: 3, bg: <></>, node: <Tiles cols={5} rows={4} tilt len={3} tiles={[clip("demo/alchemy.mp4", 5), clip("demo/dice.mp4", 10), <Img src={staticFile("demo/scene_58.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />, clip("demo/dice.mp4", 3), <Img src={staticFile("demo/map_bg.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />, clip("demo/alchemy.mp4", 9)]} /> },
];

/* ---------------- テロップ ---------------- */
export const telopItems = (): Item[] => [
  ...(Object.keys(TELOP_LOOKS) as TelopLook[]).map((k) => ({ name: `Telop：${k}`, note: TELOP_LOOKS[k], len: 2.6, bg: <Key dim={0.25} />, node: (
    <>
      {k === "bubble" && <Figure file="demo/happy.png" x={1660} y={1080} h={520} at={0} enter="none" />}
      <Telop look={k} at={0.2} until={2.4} text={k === "lower" ? "山田 太郎|シナリオライター／配信者" : k === "note" ? "※ 価格は2026年10月時点" : k === "variety" ? "しかも*つないでるの、これだけ*！！" : "製品名 に*そのまま*つなげます"} x={k === "bubble" ? 1000 : undefined} tail="right" />
    </>
  ) })),
  { name: "Counter", note: "数字が回って決まる（価格・人数・ダメージ）", len: 2.6, bg: <Key dim={0.55} />, node: <Counter to={128000} at={0.2} prefix="¥" suffix="（税込）" /> },
  { name: "Chip", note: "小さな札（提供・PR・機種名）。PR案件は「提供：〇〇」を必ず", len: 2.4, bg: <Key dim={0.3} />, node: <><Chip text="提供：〇〇株式会社" at={0.2} /><Chip text="PR" at={0.4} x={1780} color="#f7f2e6" /></> },
];

/* ---------------- つなぎ ---------------- */
const A = () => <><KenBurns file="demo/scene_35.jpg" len={2} zoom={[1.6, 1.64]} center={[960, 330]} dim={0.25} /><Kinetic text="A" font="cinzel" at={-1} enter="none" size={260} shadow /></>;
const B = () => <><KenBurns file="demo/scene_66.jpg" len={2} zoom={[1.6, 1.64]} center={[960, 330]} dim={0.25} /><Kinetic text="B" font="cinzel" at={-1} enter="none" size={260} shadow /></>;
const TransDemo: React.FC<{ type: ShotDef["in"] }> = ({ type }) => <Shots shots={[{ len: 1.1, node: <A /> }, { len: 1.3, node: <B />, in: type }]} />;
export const transItems = (): Item[] => TRANS_LIST.filter((x) => x.key !== "cut").map(({ key, note }) => ({ name: `つなぎ：${key}`, note, len: 2.4, bg: <></>, node: <TransDemo type={{ type: key, dir: "left", x: 1300, y: 500 }} /> }));
