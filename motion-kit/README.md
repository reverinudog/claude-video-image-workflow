# motion-kit — 動画の部品箱（文字のモーション・効果・つなぎ・背景・音）

実際の案件（製品紹介・ゲームや書籍のトレーラー・ゲーム紹介動画）で案件ごとに手書きしていた部品を、どの案件でも使える形にまとめた部品箱。
**使わなければいけない物ではなく、引き出し・発想のもと**。第一稿を考えるときに `CATALOG.md` と演出カタログを眺め、使えそうなら使い、その動画にもっと合う表現があればそっちで作る。

- 部品を動画で一覧する「演出カタログ」は、レビューツールの `/catalog`。動画は自分の環境で `node motion-kit/tools/catalog.mjs` を実行して作る（見本の背景・曲は同梱していない。`public/demo/` に自分の画像と曲を置く）
- 効果音（`audio/synth_se.py`）は合成で作る。波形とスペクトログラムで確かめたもので、耳での追い込みはこれから
- `node_modules` は同梱していない。`npm install`（Remotion 一式）が必要

## 見本
ふだんは演出カタログ（`/catalog`）で見る。1本の動画として見たいときは書き出す（mp4 は記録しない）
| コンポジション | 中身 | 書き出し |
|---|---|---|
| `GalleryAll` | 部品ぜんぶ。左上に番号と名前・使いどころ（4分43秒） | 下の「使い方」の最後の行 |
| `Showcase` | 部品だけで組んだ約21秒のトレーラー（曲の拍に合わせて、導入→叩きつけ→連打→2.5D→ため→締め）。曲は `public/demo/hero.mp3` | `remotion render src/index.ts Showcase out/motion-kit_showcase_vN.mp4` |
| `GallerySe` | 合成した効果音 50種を1つずつ鳴らす | `remotion render src/index.ts GallerySe out/motion-kit_se_vN.mp4` |

見本は `public/demo/` の素材（背景の画像・動画、立ち絵、曲）を参照する。同梱していないので、`src/gallery/` が指しているファイル名で自分の素材を置く（無いものは差し替える）。

## 使い方
```bash
npm run studio                                    # 見本を Remotion Studio で見る（GalleryEnter・GalleryTrans・Showcase …）
node tools/sheet.mjs --id=GalleryEnter --each=0.3,0.6,1.2 --only=0-5   # 動きをコマ送りの1枚に（確かめ用）
node tools/sheet.mjs --id=Main --from=10 --to=12 --n=8 --entry=../<案件>/video/src/index.ts   # 案件の動画にも使える
node tools/install.mjs ../<案件>/video --se impact,sub,whoosh_short,riser_4s   # 案件に部品とSEをコピー
python audio/synth_se.py                          # 合成SE を public/se/ に作る（--list で一覧）
python audio/song_map.py <曲.mp3> --png 地図.png  # 曲の地図
python audio/se_catalog.py                        # 手持ちの音の一覧（SOUND_LIBRARY.md）を作る
python audio/se_sheet.py <フォルダ> 一覧.png      # 効果音の波形とスペクトログラムを1枚に
./node_modules/.bin/remotion render src/index.ts GalleryAll out/motion-kit_gallery_vN.mp4 --concurrency=3 --offthreadvideo-cache-size-in-bytes=1500000000 --timeout=240000
```
案件の中では `import { Kinetic, Shots, Flash, KenBurns, Bgm, hit, beatGrid } from "./kit";`

## フォルダ
- `src/kit/` … 部品の本体（案件にコピーするのはここだけ。依存は remotion のみ）
  - `core.ts`（時間・イージング・乱数・拍の格子・Seq）／`fonts.ts`（書体）／`text/`（Kinetic・markup・Telop）／`fx/`（impact・atmos・filters）／`trans/Shots.tsx`／`bg/scene.tsx`／`audio/sound.tsx`
- `src/gallery/` … 見本（部品の使い方の実例にもなる）
- `audio/` … 効果音の合成・曲の解析・音の一覧（Python：numpy・scipy・librosa・Pillow）
- `tools/` … sheet.mjs（コマ送りの1枚）・install.mjs（案件へコピー）・catalog.mjs（演出カタログのデータと部品ごとの動画）
- `catalog/` … 演出カタログのデータ（`data.json`、記録する）と部品ごとの動画・静止画（`clips/`、Git管理外）。ページ本体は `review-tool/public/catalog.*`
- `public/demo/` `public/lib/` `public/se/*.wav` は Git 管理外（素材・音）。`public/se/se_catalog.json` は記録する（SE の見本が読む）
- `node_modules` は `../lyric-motion/node_modules` へのジャンクション（作り直すなら PowerShell の `New-Item -ItemType Junction`。docs/lessons/windows-env.md）

## 作るときに守ったこと（依頼主の好みと過去の教訓から）
- 文字の入り方は使い分ける・助詞は小さく・キーワードは大きく色を変える・「──」は1本の線（ゲーム紹介動画 v1→v2）
- 背景のカメラは量と速さに上限（KenBurns に入れてある）
- テロップに飾りを足さない（band は黒い帯と文字だけ）
- 縦長の周辺減光は横長の楕円で薄く・霧は固定の周期で流す・ぼかした光は切り抜いてからぼかす・金のグラデーション文字の影は drop-shadow（docs/lessons/remotion.md）
- 乱数は決まった値（並列書き出しでちらつかない）
- 合成SE はスマホのスピーカー（モノ）で鳴らしても崩れないよう、左右をずらして広げる処理は使わない

## まだやっていないこと・次の候補
- 縦長（ショート）向けの見本（部品は画面の大きさに合わせるが、見本は横長だけ）
- `@remotion/motion-blur`・`@remotion/noise` などは lyric-motion の node_modules に入れた（4.0.528 に固定）が、kit ではまだ使っていない（モーションブラーは重いので必要な所だけ試す）
- JIZURA（lyric-motion）の演出 700種以上（layout 140・enter 100・exit 86・decor 115 など）は名前の一覧だけ `JIZURA_INDEX.md` に出した（入り方は Kinetic に近いものを → で示した）。見た目の対応表はまだ。雰囲気が決まった作品では JIZURA のおまかせは「激しい・チープ」と言われがちなので、kit の Kinetic を先に使う
