# motion-kit 部品カタログ

Claude が第一稿を考えるときに眺める引き出し（書き方・指定の細かいところ）。**必ずここから選ぶ物ではない**：使えそうなら使い、その動画にもっと合う表現があればそっちで作る。案件で新しい表現ができたら、ここと見本（`src/gallery/`）に足して演出カタログも作り直す（下の「増やし方」）。
依頼主が見て選ぶ・迷ったときに眺めるのは、動画で並べた**演出カタログ**（レビューツールの `/catalog`）のほう。依頼主に文章で部品を選んでもらう段階は挟まない（構成メモ → 第一稿 → 見て直接指示。2026-10-04）。
部品はすべて「親の Sequence の頭からの秒」で動く（拍で書くなら `beatGrid(bpm, 最初の拍の秒).vb(n)`）。横長・縦長どちらでも画面の大きさに合わせる。

## 文字：Kinetic（`src/kit/text/Kinetic.tsx`）
```tsx
<Kinetic text="_TRPG風の_|*本格*[0.4]*RPG*" at={0.2} until={2.4} size={220} enter="slam" exit="blur" ghost />
```
書き方：`*差し色*` `^2つ目の差し色^` `_小さく_` `#大きく#` `~縁取りだけ~` `!震える!` `|`改行 `[0.4]`時間差 `{漢字|かんじ}`ルビ `──`1本の線 `\*`記号そのまま
（半角の `! # * ^ _ ~ |` は記号として読むので、文字として出すときは `\` を前に。全角の「！」はそのまま出る）

### 入り方（enter）— 同じものを続けない
| 名前 | 動き | 合う場面 |
|---|---|---|
| rise / drop | 下から／上から（マスク） | 説明・標準。交互に使うと単調にならない |
| track / trackSlow | 字間が詰まりながらぼけから | 静かな一言・締めのコピー・冒頭のため |
| slam | 大きく出て叩きつけ（尾つき）＋ghost で赤青の残像 | ここぞだけ |
| stamp | 傾いてハンコのように | 強い断定・判定・「大失敗」 |
| type | 1文字ずつ打つ | 入力・セリフ・AIの返答 |
| fade | 1文字ずつぼけからふわっと | 叙情・余韻・やさしい語り |
| float | 1文字ずつ少し下から浮かぶ | 穏やか・前向き |
| pop / wave | 弾んで出る／跳ねて着地 | かわいい・リアクション・ゆるい |
| zoomOut / zoomIn | 手前から引いて止まる／遠くから来る | タイトル・宣言／登場・予感 |
| wipe | やわらかく拭き出す | 説明の見出し |
| light | 光の帯がなぞって現れる | 神秘・ロゴ・きらめき |
| bar | 色の帯が走り抜けて文字が残る | シャープな見出し・章立て |
| split | 左右交互から寄る | 対比・テンポのいい連打 |
| flip | 奥から起き上がる | めくる・切り替わる |
| skew | 斜めに滑り込む | スピード・勢い |
| scramble | でたらめな字が回って決まる | AI・解析・ハッキング |
| flicker | 蛍光灯のように明滅して点く | ネオン・不穏・夜 |
| weight | 細い線から太く育つ（太さ自由な書体のみ） | モダン・テック |
| outline | 縁取りが先に描かれて中が満ちる | 設計図・予告・余韻 |
| melt | インクがにじんで形になる | 怪奇・和・記憶 |

### 消え方（exit）
blur（既定：ぼけて字間が開く）／cut（拍で切り替え）／fade／sink・riseOut（マスクで沈む・抜ける）／through（カメラに飛んでくる）／shrink／scatter（ばらけて漂う）／fall（重力で落ちる）／wipe／glitch／light（白く飛ぶ）／untype（後ろから1文字ずつ消える）

### 出ている間（hold）
drift（既定：ゆっくり寄る 3.5%）／none／float（1文字ずつかすかに上下）／breathe／sway

### そのほかの指定
`x y align textAlign`（置き場所と行のそろえ方は別々に）・`maxW`（幅に収める）・`font latin weight`（書体は `fonts.ts`）・`color a1 a2`・`shade`（後ろの暗がり。黒い帯の代わり）・`stroke glow`・`vertical`（縦書き）・`underline`・`unit`（`[n]` の単位。拍なら1拍の秒）・`dur stagger exitDur`

## 書体（`src/kit/fonts.ts`）
本格・シリアス `mincho`（しっぽり明朝B1）`zenOld` `notoSerif`／繊細 `hina`／筆・和・怪奇 `yuji`／古書 `antique`／装飾 `kaisei`／解説 `gothic`（太さ自由）`zenKaku`／やさしい `maru` `kiwi`／ポップ `mplusRounded` `mochiy`／ここぞの太字 `dela`／荒い `reggae`／遊び `rocknroll`／手書き `klee`／ドット `dot`
英字：ファンタジー `cinzel`／上品 `cormorant`／雑誌 `playfair`／細長い見出し `bebas` `anton` `oswald`／`montserrat`／SF `orbitron`／端末 `techMono`
部品の中で `useGlyphs` が使う文字だけ読み込むので、書体を増やしても重くならない（書き出しにはネットが要る）

## 解説動画のテロップ（`src/kit/text/Telop.tsx`）
| 部品 | 見た目 | 使いどころ |
|---|---|---|
| Telop look="band" | 黒い帯に白い文字 | 解説の標準（飾りは足さない） |
| Telop look="bubble" | 立ち絵の吹き出し（しっぽは縦中央・不透明） | 依頼主がしゃべるテロップ |
| Telop look="variety" | 太い縁取り＋色の影 | くだけたリアクション（「しかもつないでるの、これだけ！！」） |
| Telop look="lower" | 左下の名前・肩書きの札 | 人物・作品の紹介 |
| Telop look="note" | 隅の小さな補足 | ※注釈・出典 |
| Counter | 数字が回って決まる | 価格・人数・ダメージ・順位 |
| Chip | 小さな札 | 「提供：〇〇」「PR」（PR案件は必ず） |
`*語*` で差し色、`|` で改行。

## 一瞬の効果（`src/kit/fx/impact.tsx`）
| 部品 | 何をする | 組み合わせ |
|---|---|---|
| Flash | 一瞬白む（色も可） | 叩きつけ・切り替わりの拍 |
| Shake / useShake | 画面が揺れる（power px） | 強 14〜22、中 8〜12 |
| FocusLines | 集中線 | どどーん。続けて2回まで |
| SpeedLines | 漫画の流線（横・縦） | 疾走・突進・時間が飛ぶ |
| Burst | 後ろから光が広がる | 叩きつけの後ろ |
| Sparks | 火花が散って落ちる | 集中線のかわりのここぞ |
| Shockwave | 輪が広がる | 中くらいの叩きつけ・着地・発動 |
| Flare | 光の筋（横長フレア＋十字） | 決定・登場・ロゴ |
| Confetti | 紙吹雪 | 祝い・達成 |
| RedPulse | 周りが赤く脈打つ | 危険・ダメージ |
| Fade | 暗転・白み（全体の一番上に） | 最後の暗転・場面の区切り |

## 空気・質感（`src/kit/fx/atmos.tsx`）
Floaters（kind：embers 火の粉／dust 塵／bokeh ぼけ玉／snow 雪／petals 花びら／fireflies 蛍）・Fog（low で足元だけ）・GodRays（差し込む光）・LightLeak（光漏れ）・Grain・Vignette（縦長は横長の楕円で薄く）・Letterbox（シネスコの黒帯）・Scanlines・Halftone

## 加工（`src/kit/fx/filters.tsx`）— 子要素を包む
Glitch（色ズレ＋裂ける帯、短く）・ChromaticAberration（周辺の薄い色ズレ）・Static（砂嵐）・Duotone（2色化）・Grade（rich／warm／cold／tealOrange／noir／faded／horror／neon）

## 背景・人物（`src/kit/bg/scene.tsx`）
| 部品 | 何をする | 約束 |
|---|---|---|
| KenBurns | 画像・動画をさりげなく寄る／流す | 1ショットで寄り引き4%・横70pxまで、1秒に1.2%・20pxまで（ゲーム紹介動画 の上限が入っている） |
| Parallax | 層を奥行きで分けてカメラを動かす（2.5D） | 遠景 0.2〜0.4・主役 1・手前 1.3〜1.6 |
| Figure | 立ち絵：色つきの影・逆光のふち・弾んで入る・呼吸 | 2人並べるなら顔の大きさと色調をそろえる。頭を切ったままにしない |
| Aurora | 素材なしの色のにじみ | 締め・タイトル |
| Spotlight | 闇に上からの照明（ちらついて点く） | 素材なしの舞台・登場 |
| Tiles | 画面を並べる（2x2〜壁、tilt で斜めの壁） | 重要でない機能はまとめて／ためは画面いっぱいの壁 |

## つなぎ（`src/kit/trans/Shots.tsx`）
```tsx
<Shots shots={[{ len: 2.4, node: <A /> }, { len: 1.6, node: <B />, in: { type: "whip", dir: "left" } }]} />
```
基本は cut。fade・dipBlack（章の区切り）／dipWhite（回想・ため→どどーん）／flash（拍の頭）／wipe・diag（説明・シャープ）／iris（x・y を中心に）・square（四角く開く）／blinds／slide・whip（連打・移動）／zoom（突入）／cube（画面の切り替え）／glitch（デジタル）／ink（和・怪奇）／shutter（カメラ）／doors（開幕）／lightLeak（懐かしさ）
つなぎは切り替わりの瞬間をまたいで前後半分ずつ重なる。拍に合わせた切り替わりの位置は変わらない。ショットの中の 0 秒＝切り替わりの瞬間（`useT` が合わせる。ショットの中で自分で Sequence を入れ子にするときは `Seq` を使う）

## 音（`src/kit/audio/sound.tsx`、`audio/*.py`）
- `<Bgm parts=[...] duck=[...] />`：曲を区間ごとにつなぐ（フェード）＋ナレーションの間だけ下げる
- `<SeTrack items=[...] />`、`hit("slam" | "boom" | "swish" | "pass" | "build" | "shine" | "glitch" | "verdict", 秒)`：よく使う重ね方
- 合成SE 50種：`python audio/synth_se.py --list`（打・風・ため・UI・デジタル・きらめき・空気）。拍に合わせて長さを変える：`--dur 2.4 --name riser_6beat`
- 曲の地図：`python audio/song_map.py <曲> --png 地図.png`（BPM・拍の位相・区切り・ため・最後の一打・飛ばせる4小節）
- 手持ちの音の一覧：`SOUND_LIBRARY.md`（`python audio/se_catalog.py`）
- 規約・音量：`../docs/research/sound-sources.md`

## 場面ごとの組み合わせ（出発点。題材に合わせて変える）
| 場面 | 文字 | 効果・空気 | つなぎ | 音 |
|---|---|---|---|---|
| 解説・PR（ナレーションあり） | Telop bubble／band、キーワードだけ Kinetic rise | 控えめ。どどーんだけ Flash＋FocusLines＋大きい Figure | cut・slide | Bgm 0.1＋duck、SE 0.2〜0.3 |
| ゲームのトレーラー | rise／drop を左右に振る、ここぞは slam＋ghost | Floaters embers、締めは Sparks＋Burst | whip（連打）・zoom（突入）・dipWhite（ため→落ち） | 曲は下げない。riser→boom、文字に whoosh_short |
| 怪奇・ミステリー | fade／melt／縦書き、明朝・筆 | Fog＋Spotlight＋Dust、Grade horror、たまに Glitch | dipBlack・ink・glitch | drone_dark・hum・ring・tension、braam・stinger |
| ポップ・リアクション | pop／wave／stamp、maru・mochiy・dela | Halftone、Figure の色つき影、Confetti | slide・iris | pop・blip・chime_ok・buzz_ng |
| デジタル・AI | scramble／type／flicker、dot・orbitron | Scanlines、Glitch、ChromaticAberration | glitch・blinds | glitch・zap・static_burst・blip |
| 締め・ロゴ | zoomOut／light／trackSlow | Aurora、Flare、Burst | dipWhite→Fade | 曲の最後の一打に sub_long／boom、shimmer_up |

## 今回足したもの（それまでの案件になかった）
- 入り方：drop・stamp・float・pop・wave・zoomOut・zoomIn・wipe・light・bar・flip・skew・scramble・flicker・weight・outline・melt（それまでは rise・track・slam・type と、書籍のトレーラーの Kine の一部）
- 消え方：sink・riseOut・through・shrink・scatter・fall・wipe・glitch・light・untype（それまでは blur・cut）
- 書き方：2つ目の差し色・大きく・縁取りだけ・ルビ・縦書きの線
- 効果：Shockwave・Flare・SpeedLines・Confetti・Fade、空気：bokeh・snow・petals・fireflies・LightLeak・Letterbox・Scanlines、加工：ChromaticAberration・Duotone の汎用化・Grade 8種
- つなぎ 18種（それまでは案件ごとに cut・fade・白み・ノイズを手書き）
- 背景：Parallax（2.5D）・Figure（色つきの影・逆光）・Aurora・Tiles の汎用化
- テロップ：variety・lower・note・Counter・Chip
- 音：合成SE 50種（それまで案件ごとに十数種）・曲の地図・手持ちの音の一覧・音の見える化

## 微妙に違うけど、あるとよい組（同じに見えて役割が違う）
- rise と drop：同じマスクでも方向が逆。連打で交互にすると「同じ派手演出のくり返し」にならない
- track と trackSlow：締めのコピーは遅いほうが品よく見えた（ゲーム紹介動画）
- slam と stamp：slam は真正面の宣言、stamp は傾いた判定。ダイスの結果・大失敗は stamp
- zoomOut と zoomIn：引いて止まる＝宣言、寄ってくる＝予感
- wipe と light：同じ拭き出しでも、light は光の帯つき（神秘・ロゴ向け）
- Burst と Flare：Burst は面の光、Flare は線の光。白い文字には背景が暗い所で
- Flash と Fade：Flash は一瞬、Fade は区切り
- whip と slide：whip はぶれる速い移動（勢い）、slide は落ち着いた押し出し（並べて見せる）
- fade と dipBlack：fade は場面の移り、dipBlack は章の区切り
- Floaters dust と embers：静か・古い vs 戦い・熱
- sub と sub_long、riser と riser_tonal：同じ役割で重さ・品が違う

## 増やし方（案件で新しい表現ができたら）
1. 案件の中で作った部品を、画面の大きさ（`useSize`）・秒（`useT`）で動く形にして `src/kit/` の合う所に入れる。作品固有の絵や文言は引数に出す
2. `src/gallery/` の合う見本に1件足す（名前と「使いどころ」の一言。どの案件で生まれたかも note に）
3. `node tools/catalog.mjs` で演出カタログを作り直す（依頼主もそこで見られる）
4. このファイルの該当の表に1行足す。依頼主に「良かった」と言われた・「いらない」と言われた、も使いどころに書く
- 似た部品が増えたら、違いが分かるように「微妙に違うけど、あるとよい組」に書くか、まとめる
- 増やすのはハンドオーバーのときでよい（作業中は動画に集中）

## 仕組み・直すとき
- 書き出しの確かめ方：`node tools/sheet.mjs --id=<コンポジション> --from=秒 --to=秒 --n=8`（動きをコマ送りの1枚に）。見本なら `--each=0.3,0.6,1.2`（区切りごとの頭からの秒）
- 案件で使う：`node motion-kit/tools/install.mjs <案件>/video [--se impact,sub,...]` で `src/kit/` にコピー（案件ごとに版を固定）。案件の中で直してよい。共通に戻したい改良は motion-kit にも入れて見本で確かめる
- 乱数は `rand(n)`（決まった値）。`Math.random` は並列書き出しでちらつくので使わない
