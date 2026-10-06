# 制作ワークフロー（正本）

新しい案件は `templates/` のひな形（`video/`＝Remotion の最小構成、`narration/`＝ナレーション処理、`still/`＝静止画）を案件フォルダへコピーして始める。スクリプト内の入力パスは案件ごとに書き換える。

## 0. 話し合い → 構成メモ（動画を作る前に必ず）
- まず依頼主とグリルミー（1問ずつ質問して認識合わせ）で「ざっくりこんな流れ」を話し合う。狙い・誰に何を感じてほしいか・見せたい場面・流れを合わせてから構成メモに進む
- 素材や動画がまだ無い段階で、全体の流れを**ざっくり1行ずつ**書いて依頼主に添削してもらう。秒数・素材・演出は書かない（情報が多いと見にくい）
- ファイル：`<案件>/plan/<名前>_vN.plan.json` = `{title, intro(1〜2行), items:[{id, text, kind?:"head", comments:[]}]}`。kind="head" は区切りの見出し
- 確認したいことは、その行の comments に `{id, by:"claude", text}` で置く
- 渡し方：`http://localhost:5178/plan`（スマホ：`https://<PC名>.<tailnet>.ts.net:8447/plan`）。レビューメモ画面のヘッダーからも行ける
- 依頼主ができること：題名・ねらいも含めて書き換え・Enterで行を足す・ドラッグで並べ替え（スマホも同じ）・行ごとのコメント・「変更を表示」で元の文と見比べ・元に戻す・「Claudeに送る」。画面から新しい構成メモ（案件フォルダごと）も作れる
- 返ってきたら：`claude.mjs show <id>` → JSONを読む（書き換えた行は edited=true・元は base、足した行は base=null、消した行は removed、並べ替えは origOrder と比べる。題名・ねらいを変えたときだけ baseTitle／baseIntro が付く）→ コメントに `reply` → 同じファイルを直して更新（ページは自動で読み直す。依頼主が書いている途中なら上書きせずに知らせる）→ OKが出たら台本・timeline に落とす
- 直した内容を「新しい元」にするときは、各行の `base` を今の `text` にし、`removed`・`origOrder`・`baseTitle`・`baseIntro`・`sentSig` を消す（残すと次も「変えた行」の印が付いたまま）
- 保存のたびに1つ前が `plan/.history/` に残る（最新30件、Git管理外）

## 1. 台本
- `台本_vN.md` に書く。依頼主の声当て前提。ブロック（B01, B02…）単位で、ブロック間は録音で2秒あける
- 冒頭で「それぞれ何者か」をさらっと説明してから比較・疑問に入る（視聴者が共感できる順番）

## 2. 録音 → 文字起こし
- 依頼主が1ファイルで録音（言い直しも残してある。使える部分はカットで活かす）
- `work/transcribe.py`：faster-whisper large-v3 / CUDA / `word_timestamps=True`。`initial_prompt` に製品名を入れる
- 出力を読んで、どのテイクを使うか決める（言い直しは基本的に後のテイクが本命）

## 3. 採用テイク → 無音詰め
- `work/cut_narration.py`：EDL（ブロック, 開始, 終了）を並べる
- `work/tighten.py`：無音を詰めて `narration_final.wav` と `narration_map.json`（出力秒→元秒）を出す
- **確認**：出力を再度文字起こしして、語尾まで入っているか・言い直しの断片が混ざっていないかを見る

## 4. 音量
- `ffmpeg -af loudnorm=I=-16:TP=-1.5` → `work/narration_prelevel.wav`
- `python work/level.py` → `video/public/narration.wav`（テロップ区間ごとのLUFSを中央値へ寄せる。テロップの時間が決まってから実行）

## 5. Remotionで組む（video/）
- **構成メモで合意したら、そのまま第一稿を組んで見せる**。演出は Claude が考える（依頼主に文章で部品を選んでもらう段階は挟まない。依頼主はビジュアルから理解するので、第一稿を見てから直接指示を出す）。迷っているときや「ほかの見せ方は？」のときは演出カタログ `http://localhost:5178/catalog`（スマホは `…:8447/catalog`）を案内する
- **motion-kit は引き出し（必須ではない）**：組む前に `motion-kit/CATALOG.md`・演出カタログを眺めて発想のもとにし、使えそうなら `node motion-kit/tools/install.mjs <案件>/video --se <使う合成SE>` で `src/kit/` にコピーして使う（案件ごとに版を固定。案件の中で直してよい）。その動画にもっと合う表現があるなら、kit にこだわらずそっちで作る
- **新しい表現ができたら motion-kit に還元する**：案件で作った表現・kit を直して良くなった所は、他の案件でも使える形にして `motion-kit/src/kit/` に入れ、見本（`src/gallery/`）に1件足して `node motion-kit/tools/catalog.mjs` で演出カタログに増やす。CATALOG.md にも1行（名前・使いどころ・どの案件で生まれたか）。案件固有の見た目（その作品の扉・ロゴなど）は無理に一般化しない
- 動きの確かめは `node motion-kit/tools/sheet.mjs --entry=src/index.ts --id=Main --from=秒 --to=秒 --n=8`（コマ送りの1枚）
- 曲を使うなら先に `python motion-kit/audio/song_map.py <曲> --png` で拍・区切り・ため・最後の一打の候補を出す。足りない効果音は `python motion-kit/audio/synth_se.py`（長さは `--dur` で拍に合わせる）→ それでも足りない実際の物の音は docs/research/sound-sources.md の候補から承認を取って落とす
- `src/timeline.ts` が編集データの本体（scenes / captions / avatar / overlays / impacts / se / BGM / ENDING）
- 撮影素材は向きを直したプロキシを `public/clips/` へ。映り込み（個人情報など）のモザイクは素材に焼き込む
- 確認：`node check.mjs 12 36.5 …` → `out/check/t_*.png`（秒指定で静止画）。ImageMagickで縦に並べて一度に見る
- 書き出し：`./node_modules/.bin/remotion render Main out/<名前>_vN.mp4 --concurrency=4`（4分で約10分。バックグラウンドで）
- 曲が主役の動画（トレーラーなど）は声＋曲でピークが0dBを超えやすい → 書き出しを `out/` 以外に置き、`ffmpeg -i 元.mp4 -c:v copy -af "alimiter=limit=0.89:level=false" -c:a aac -b:a 256k out/<名前>_vN.mp4` で仕上げる。区間ごとの音量は `-ss a -to b -af volumedetect` で測る（サビが前半より小さくならないように）
- 横長と縦長（ショート）の両方を作るとき：timeline.ts（流れ・曲・SE）は共有して、部品だけ縦用のファイル（例：`scenes_v.tsx`）に作り直し、`Main.tsx` の `Film({parts, w, h})` に渡して別コンポジション（例：`Short`）として登録する。音ハメがそのまま保てる。先に縦の配置案を構成メモで合意する。霧・塵・光のように画面の大きさで決まる部品は、共通部品に画面の大きさを渡して（`FrameSize`）縦でもそのまま使う手もある。部品が画面の大きさをコンテキストで受け取る形（`FrameCtx`）にして、縦用は寄る位置と文字の場所だけ別ファイル（`timeline_v.ts`）に書く手もある。横長の部品に手を入れたら、手を入れる前後の横長の静止画を比べて1ピクセルも変わっていないことを確かめる（`magick compare -metric AE 前.png 後.png null:` が 0）
- ナレーションを作り直して時間がずれたら：`python work/remap_timeline.py 旧map 新map src/timeline.ts`（mapは版番号付きで保存しておく）

## 5.5 サムネイル（1280x720）
- `src/Thumbnail.tsx`（Remotionの Still）。文言・立ち絵・背景・集中線の中心は冒頭の `THUMB` で変える
- 背景は元素材（`.mov`）から ffmpeg でフレームを抜いて `public/img/` へ（プロキシより高画質）
- 書き出し：`./node_modules/.bin/remotion still Thumbnail out/thumbnail.png`
- 文字は主役にかぶせない。空いている壁や床に置く

## 5.7 静止画（ポスター・配信サムネ）を1案件として作る
動画に付けるサムネ（5.5）ではなく、告知ポスターや配信サムネそのものが成果物のとき。ひな形：`templates/still/build.py`
1. **素材を読む**：シナリオ本文（`pdftotext -enc UTF-8 -layout`）と素材フォルダ。一覧は `magick montage` でコンタクトシートにして目で選ぶ。配布物（`素材/`）は小さいことが多いので、同じフォルダにある元データ（高解像度の原画・透過ロゴ）を先に探す
2. **決めること**：大きさ（X の縦長＝3:4 の 3000×4000、配信サムネ＝1920×1080）、主役、メインカラー、ネタバレの線引き（プレイヤー本人が見る前提。出してよい登場人物を依頼主に確かめる）、入れる文字（コピーは台本・導入文の言葉から。日時・出演）
3. **第一稿を作って見せる**：静止画は1回20秒ほどで出せるので、構成メモは挟まず絵で合わせる。`python tools/build.py all v1` → `out/<名前>_v1.jpg`
4. **画像レビューで直す**：レビューツールの「画像レビュー」（`http://localhost:5178/image`）を開いて渡す。依頼主が画像の上をなぞってメモ → 送る → 📨 `画像の依頼` が届く → `claude.mjs show <id>` → **全体図（番号の印つき）を Read で見る** → 直す → 各メモに `reply` → 新しい版番号で書き出す → `done <id> "まとめ" <新しい画像の相対パス>`
5. **採用されたら**：README に採用版と経緯。素材に二次配布禁止のものが入るなら `out/` を .gitignore に入れる（スクリプトと README だけ記録）
- 作り方は Python（PIL・numpy・scipy）だけで合成から文字まで。大きなぼかしは縮小してから掛ける（`blur()`）。Chrome headless は使わない（階調の段差・固まりの心配がない）
- `build.py` の部品：`duotone`（2色化）／`villain_layer`（敵を赤黒にして下を溶かす）／`grade_hero`（主役の逆光）／`embers`（火の粉）／`vertical_var`（縦組みで字の大小）／`distress`（欠け・かすれ）／`draw_row`（大きさの違う文字を1行に）／`ragged_frame`（ぼろぼろの外枠）／`finish`（ブルーム・周辺減光・粒子）。新しい案件ではこのファイルをコピーして `poster()`／`thumb()` を書き換える
- 版は必ず新しい番号で書き出す（比べたい別案は `v9b` のように枝番）。同じ名前で版番号が続いていれば、画像レビューの版ボタンと「前の版」（押している間だけ表示）で見比べられる

## 6. レビューループ
- 書き出し後、レビューツールを開く（CLAUDE.md の「必ずやること」）
- 依頼主はツールでメモ → 「📨 Claudeに送る」。受信口（listen.mjs）が拾う
- 受信口がないときに届いた依頼は `review-tool/inbox/` に残る → `node review-tool/claude.mjs pending`
- メモの正本は `out/<動画>.review.json`（.md は自動生成）。スクショは `out/<動画>.review/`
- 静止画は「画像レビュー」（`/image`）。メモの正本は `out/<画像名>.imgreview.json`（.md は自動生成）、送るときに作る全体図は `out/<画像名>.imgreview/`。一覧に出るのは `out` フォルダ直下の png・jpg・webp（同じ名前の png と jpg は jpg だけ。`check*` フォルダと `compare_*` は出さない）

### スマホで見る（Tailscale）
- スマホ用URL：**https://<PC名>.<tailnet>.ts.net:8447/** （tailnet内の端末だけが開ける）
- 仕組み：`tailscale serve --bg --https=8447 http://127.0.0.1:5178`（再起動後も残る）。サーバーは 127.0.0.1 待ち受けのまま、ファイアウォールも触らない
- PC側でレビューツールのサーバー（5178）が起動していないと開けない → 書き出し後に bat で起動するのはこれまでどおり
- 書き出しを報告するときは、PCのURLと並べてスマホ用URLも書く
- 確認：`tailscale serve status` に `:8447 → 127.0.0.1:5178` があること。止めるなら `tailscale serve --https=8447 off`
- 画面は幅820px以下で縦1列（動画→シークバー→操作→メモ→Claudeに送る）。シークバーは指でなぞれる

## review-tool の構成（使い方・設定・連携の正本は `review-tool/README.md`）
- `server.mjs`（ポート5178、依存なし）／`lib.mjs`（共通処理・設定の読み込み）／`public/`（画面：`index.html`＋`review.js` がレビュー、`plan.html`＋`plan.js` が構成メモ、`catalog.html`＋`catalog.js`＋`catalog.css` が演出カタログ、`image.html`＋`image.js`＋`image.css` が画像レビュー、`common.js`・`app.css` が共通部品とデザイン）
- 演出カタログのデータは `motion-kit/catalog/data.json`（`/api/catalog`）、動画は `motion-kit/catalog/clips/`（Git管理外）。部品を足したり直したりしたら `node motion-kit/tools/catalog.mjs` で作り直す（見本を名札なしで書き出して部品ごとに切る。約10分。切り直しだけなら `--reuse`）
- `listen.mjs`（Claude側の受信口）／`claude.mjs`（show / progress / reply / done / pending）
- 依頼の種類は `kind`：なし＝動画、`plan`＝構成メモ、`image`＝画像。`claude.mjs` はどれも同じコマンドで扱える（`reply` の書き込み先だけ種類で変わる）
- 設定は `review-tool/config.json`（見本 `config.example.json`、Git管理外）。作業フォルダ共通の分類タグなどは画面の設定から `<作業フォルダ>/.reviewtool.json` に入る
- サーバーは起動中に自動再読込されない。server.mjs や lib.mjs を変えたら、5178番のプロセスを止めて bat で起動し直す（bat は起動済みならブラウザを開くだけ）。public/ の変更は画面の再読み込みだけでよい
- 画面をいじるときの約束：文字の大きさは `app.css` の `--fs-*` だけを使い、13px（`--fs-xs`）より小さくしない。文章にしなくていい状態・ヒントはアイコン＋ふきだし（`title`）で出す。アイコンだけのボタンは `common.js` の `iconBtn`（title と aria-label が付く）。仕上げに、見えている文字で computed font-size が 13px 未満のものが無いか JS で確かめる
- 画面をいじったら、試験用の作業フォルダ（動画とメモをスクラッチパッドへコピー）で `node review-tool/server.mjs --port 5179 --root <試験用> --inbox <試験用>` を立て、PC幅とスマホ幅の両方で確かめてから本番を再起動する（本番のメモを汚さない）
