# クレジット・第三者の表記

## 同梱しているもの

### JIZURA
- 場所：`lyric-motion/jizura/`（`src/`・`docs/EXPRESSION_PACKS.md`）
- 作者：852話（hakoniwa）さん
- 入手元：<https://github.com/852wa/JIZURA>
- ライセンス：MIT License — Copyright (c) 2026 hakoniwa（全文は `lyric-motion/jizura/LICENSE`）
- 取り込んだコミットと、こちらで加えた変更：`lyric-motion/jizura/UPSTREAM.md`（本家のコードに2か所だけ手を入れています：スタイル「怪奇」の追加と、行ごとの固定 `trans: "off"` の追加。それ以外は取り込んだときのまま）
- JIZURA が同梱・利用している第三者（mp4-muxer、実行時に読み込むフォントなど）の表記：`lyric-motion/jizura/THIRD_PARTY_NOTICES.md`

`lyric-motion/` のそれ以外（JIZURA のエンジンを Remotion から呼ぶための `build-engine.mjs`・`src/jizura/*` など）と、`motion-kit/JIZURA_INDEX.md`（JIZURA に登録されている名前の一覧）は、このリポジトリで書いたものです。

## 同梱していないもの（使うときに各自で入れるもの）

| もの | 使いどころ | ライセンス |
|---|---|---|
| [Remotion](https://www.remotion.dev/) | 動画の書き出し（`templates/video`・`motion-kit`・`lyric-motion`） | Remotion License（個人・小さな組織は無料、一定規模以上の会社は有料）。<https://www.remotion.dev/license> |
| React | Remotion が使う | MIT |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | 文字起こし（`templates/narration/transcribe.py`） | MIT（モデル large-v3 は OpenAI Whisper、MIT） |
| Pillow・numpy・scipy・librosa | 静止画の合成、音の解析・合成 | それぞれのライセンス（HPND・BSD・ISC など） |
| ffmpeg | 音声・動画の変換 | LGPL／GPL（ビルドによる） |
| フォント | 文字 | 同梱していません。ひな形は Zen Old Mincho（SIL OFL 1.1）があれば使い、無ければ OS のフォントで代用します。motion-kit は `@remotion/google-fonts` で Google Fonts を読み込みます |
| 効果音・曲・画像・立ち絵 | 素材 | 同梱していません。各配布元・作者の条件に従ってください |

## このリポジトリについて

Claude Code と一緒に作り、実際の制作で使いながら直してきたものです。案件の素材・完成物・依頼主の情報は含みません。
