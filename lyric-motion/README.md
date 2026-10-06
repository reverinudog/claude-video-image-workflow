# lyric-motion — JIZURA × Remotion のリリックMV制作基盤

[JIZURA 字面](https://github.com/852wa/JIZURA)（歌詞から文字PVを自動で組み立てるエンジン、MIT）を Remotion の中で直接動かす。
JIZURAの「おまかせで組んでくれる強さ」と、Remotionの「データで直せる・実写や立ち絵と合成できる・レビューツールで詰められる」を両取りする。

## 状態
- 実案件を始めるときは、このフォルダを案件フォルダにコピーするか、song.ts を書き換えて版番号付きで書き出す

## 使い方
```bash
npm install          # 初回だけ
npm run studio       # プレビュー（src/song.ts を保存すると即反映）
npm run check -- 2 5 8          # 指定秒の静止画 → out/check/
./node_modules/.bin/remotion render src/index.ts LyricMV out/<名前>_v1.mp4 --concurrency=4
```
書き出しは速い（16秒のデモで約30秒）。書き出したらレビューツール（`../review-tool`）で見る。

## 何を変えればいいか（src/song.ts）
| 項目 | 内容 |
|---|---|
| `project.lyrics` | 歌詞。`/` でカット、`*強調*`、行末 `!` でフラッシュ、`[mm:ss.xx]` で開始時刻指定 |
| `project.style` | 配色・書体のセット（noir / crimson / caution / magenta / paper / hud / mint / specimen / transit / blueprint / rouge / mono …） |
| `project.seed` | 数字を変えるだけで別の構成になる。気に入った数字を控えておく |
| `project.fx` | motion（動きの強さ）/ glitch / chroma（色ズレ）/ decor（装飾の量）/ density（カットの細かさ）/ texture / koma（12=2コマ打ち、8=3コマ打ち、0=フル） |
| `project.extra` / `wa` | 追加分の演出・和風の演出を候補に入れるか |
| `project.overrides` | 行ごとの固定（JIZURAブラウザ版で作った設定と同じ形式） |
| `audio` | public/ に置いた曲。BPMと拍を自動検出して、カットを拍に合わせる |
| `background` | 文字の下に敷く画像・動画（指定すると JIZURA は透過で重なる） |
| `avatar` | 立ち絵（`public/stand/<ポーズ名>.png` を自分で置く。同梱していない） |

コンポジション
- `LyricMV` … 完成版（背景＋文字＋立ち絵＋曲）
- `LyricLayer` … 文字だけ・透過（他の動画に重ねる素材用）。透過で書き出すなら `--codec=prores --prores-profile=4444 --pixel-format=yuva444p10le` で .mov に

JIZURAのブラウザ版（https://852wa.github.io/JIZURA/ ）で「おまかせ」を回して気に入った案を探し、そのスタイル・シード・fx をここに書き写す、という使い方もできる。

## JIZURAを改造する
- エンジンのソースは `jizura/src/*.js`（本家からコピーしたもの）。**ここを直接編集してよい**
- `npm run studio / check / render` の前に `build-engine.mjs` が自動で1ファイルにまとめる（`src/jizura/engine.generated.js`、手で触らない）
- 演出の部品を足す方法は `jizura/docs/EXPRESSION_PACKS.md`（本家のガイド）
- こちらで足したもの（本家のコードへの変更はこの2つだけ。`jizura/UPSTREAM.md` にも記録）：
  - スタイル「怪奇」（`kaiki`、`11p_styles.js`）：墨色の闇・象牙の明朝・赤と青の差し色。UI 系・ポップな演出は選ばれにくくしてある
  - 行ごとの固定で `trans: "off"`（`08_planner.js`）：行と行のあいだの場面つなぎを使わず、前の行の消え方とこの行の出方をそのまま見せる
- 雰囲気の決まった作品で使うときは、おまかせのままだとパズル・提灯・DANGER札などが混ざりやすい。`overrides` で行ごとに layout / enter / exit / cam / treat / decor を固定する
- `12_ui.js`（ブラウザ版の編集画面）は使わないので連結から外している

## node_modules
- `npm install` はこのフォルダで行う。ほかの案件や `motion-kit` と共用したいときは、そちらの `node_modules` をここへのジャンクション（リンク）にすると、1回の `npm install` で全部に効く
- `@remotion/*` の各パッケージは remotion 本体と同じ版にそろえる（版がずれると動かない）

## 本家の更新を取り込む
- 取り込み元のバージョンと、こちらで加えた変更は `jizura/UPSTREAM.md`
- 更新：本家を `.upstream/JIZURA`（Git管理外）に clone して `git pull` → `jizura/src` と差分を比べて、必要な分だけ反映（自分の改造を上書きしないよう注意）→ UPSTREAM.md を更新

## しくみ（直すときのための要点）
- `src/jizura/load.ts`：song.ts の設定 → `J.plan()`（構成）→ `J.ensureFonts()`（使う書体だけ Google Fonts から）→ `new J.Renderer()`。同じ設定なら使い回す
- `src/jizura/JizuraLayer.tsx`：毎コマ `renderer.frame(ctx, plan, 秒, {scale, transparent})` で canvas に描く
- JIZURAは紙の質感や粒子の模様を `Math.random` で作る。Remotionは複数の画面で並列にコマを描くので、そのままだと画面ごとに模様が違ってちらつく → 描画器を作るときと描くときに乱数を固定シードに差し替えている（`withSeededRandom`）
- 動画の長さ・解像度・fps は `index.ts` の calculateMetadata が JIZURA の構成から自動で決める

## ライセンス
JIZURA は MIT License（`jizura/LICENSE`、同梱の第三者ライセンスは `jizura/THIRD_PARTY_NOTICES.md`）。出力した動画の権利は作った人に帰属。使う歌詞・曲の権利はそれぞれの権利者のもの。
