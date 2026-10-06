# claude-video-image-workflow

Claude Code に「構成作家 兼 映像ディレクター」をやってもらい、**動画（完成 mp4）と静止画（告知ポスター・サムネ）を作る**ための作業フォルダ一式です。
人は「見て、気になる所にメモを付けて、送る」だけ。直すのは Claude、という流れを、実際の制作で使いながら育てたものです。

- 動画は [Remotion](https://www.remotion.dev/)（React で動画を書く仕組み）で組み、**あとから指示で直せる形**（データを書き換えれば直る形）で残します
- 静止画は Python（Pillow・numpy・scipy）だけで合成します
- 直しの依頼は、同梱の**レビューツール**（ブラウザで開くページ）から Claude に届きます

> 実際の案件の素材・完成物・依頼主の情報は入っていません。入っているのは、道具と手順と、つまずいた所の記録（教訓）だけです。

## 流れ

```
動画：  話し合い → 構成メモ（1行ずつの流れ）→ 台本 → 録音 → 文字起こし → 採用テイク → 無音詰め → 音量
        → Remotion で組む → 書き出し → レビューツールでメモ → Claude が直す →（くり返し）
静止画：素材を読む → 決めること（大きさ・主役・色・入れる文字）→ 第一稿 → 画像レビューでメモ → Claude が直す →（くり返し）
```

手順の正本は [docs/workflow.md](docs/workflow.md) です。

## 入っているもの

| フォルダ | 中身 |
|---|---|
| [review-tool/](review-tool/) | レビューツール（依存なしの Node.js サーバーとページ）。**動画レビュー**（止めた場面に時刻つきメモ）・**画像レビュー**（画像の上をなぞってメモ）・**構成メモ**（1行ずつ添削）・**演出カタログ**。メモは「Claude に送る」で届き、進み具合と返事が画面に戻ります |
| [templates/video/](templates/video/) | 動画のひな形（Remotion の最小構成）。`src/timeline.ts` に場面・テロップ・効果音を並べるだけ |
| [templates/narration/](templates/narration/) | ナレーション処理（文字起こし → 採用テイクをつなぐ → 無音を詰める → 音量をそろえる → 時間の付け替え） |
| [templates/still/](templates/still/) | 静止画のひな形（告知ポスター 3000×4000 と配信サムネ 1920×1080）。素材が無くても仮の絵で動きます |
| [templates/poster-html/](templates/poster-html/) | 印刷用ポスターを HTML で組んで Chrome headless で等倍書き出しするときの道具 |
| [motion-kit/](motion-kit/) | 動画の部品箱（文字の入り方・消え方、効果、背景、つなぎ、テロップ、合成の効果音、曲の拍を測る道具）。使わなければいけない物ではなく、引き出し |
| [lyric-motion/](lyric-motion/) | リリックMV の基盤。[JIZURA](https://github.com/852wa/JIZURA) のエンジンを Remotion から呼べるようにしたもの |
| [docs/](docs/) | 手順書（`workflow.md`）、教訓（`lessons/`：実際に起きて原因と対処がわかった落とし穴）、調査メモ（`research/`） |
| [CLAUDE.md](CLAUDE.md) | Claude Code が最初に読む「このフォルダの約束」。**自分用に書き換えて使います** |
| [.claude/skills/handover/](.claude/skills/handover/) | 「ハンドオーバー」と言うと、状態の記録・教訓の整理・コミットまでやって締めくくるスキル |

## 必要なもの

- [Claude Code](https://claude.com/claude-code)
- Node.js 18 以上（レビューツールはこれだけで動きます。`npm install` も不要）
- 動画を作るなら：`templates/video` などで `npm install`（Remotion 一式）、ffmpeg
- ナレーションを処理するなら：Python 3.10 以上、`pip install faster-whisper numpy`（GPU があると速い）
- 静止画を作るなら：`pip install pillow numpy scipy`

Windows で作って使っています（`.bat` は Windows 用）。サーバーとスクリプト自体は macOS・Linux でも動く作りですが、試していません。

## はじめかた

1. このリポジトリを自分の作業フォルダとして置く（clone するか、テンプレートとして使う）
2. [CLAUDE.md](CLAUDE.md) の「依頼主」「好み」を自分のことに書き換える
3. レビューツールを起動する

   ```bash
   node review-tool/server.mjs
   ```

   `http://localhost:5178` を開きます（Windows は `review-tool/レビューツールを開く.bat` でも可）
4. このフォルダで Claude Code を開き、作りたいものを伝える。Claude は CLAUDE.md と docs/workflow.md に沿って進めます
   - 動画：案件フォルダ（例 `250101_製品紹介/`）を作り、`templates/video` と `templates/narration` をコピーして始めます
   - 静止画：案件フォルダを作り、`templates/still/build.py` をコピーして始めます

     ```bash
     python templates/still/build.py all v1
     ```

5. 書き出されたら、レビューツールで見てメモを付け、「送る」。Claude 側は `node review-tool/listen.mjs` を常駐させておくと、送った瞬間に届きます

レビューツールの詳しい使い方は [review-tool/README.md](review-tool/README.md) にあります。

## 素材について

背景・立ち絵・曲・効果音・フォントは**同梱していません**。自分の素材を、使ってよい条件を確かめたうえで置いてください。
効果音や曲の配布元ごとの条件を調べたメモは [docs/research/sound-sources.md](docs/research/sound-sources.md) にあります（調べた時点の内容です。使う前に各配布元の最新の規約を確かめてください）。

## ライセンスとクレジット

このリポジトリは [MIT License](LICENSE) です。

- **JIZURA**（`lyric-motion/jizura/`）：852話（hakoniwa）さん作のリリックモーション生成エンジンを取り込んでいます。MIT License、Copyright (c) 2026 hakoniwa。<https://github.com/852wa/JIZURA>
  本家のコードに2か所だけ手を入れています（スタイルの追加と、場面つなぎを切る指定の追加）。取り込んだ版・変更の中身・同梱されている第三者の表記は `lyric-motion/jizura/` の `UPSTREAM.md`・`LICENSE`・`THIRD_PARTY_NOTICES.md` にあります
- そのほかの表記は [CREDITS.md](CREDITS.md) にまとめています

**Remotion について**：Remotion は同梱していません（`npm install` で入ります）。Remotion には独自のライセンスがあり、個人や小さな組織は無料で使えますが、一定の規模以上の会社は有料のライセンスが必要です。使う前に <https://www.remotion.dev/license> を確かめてください。
