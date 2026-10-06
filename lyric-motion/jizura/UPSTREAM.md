# 取り込み元

- リポジトリ：https://github.com/852wa/JIZURA （MIT License、Copyright (c) 2026 hakoniwa）
- 取り込んだコミット：`1b48bea2d74e60f9b0ff2c247aa5919ba03a6551`（2026-09-24）
- 取り込んだもの：`src/`、`LICENSE`、`THIRD_PARTY_NOTICES.md`、`docs/EXPRESSION_PACKS.md`

## こちらで加えた変更
本家のコードに、次の2か所だけ手を入れています（それ以外のファイルは取り込んだときのまま）。本家の更新を取り込むときに上書きしないこと。

- `src/11p_styles.js`：スタイル「怪奇」（`kaiki`）を1つ追加（本家には無い）
- `src/08_planner.js`：行ごとの固定に `trans: "off"` を追加（場面つなぎを使わず、前の行の消え方とこの行の出方をそのまま見せる）。1行の変更

この2か所の変更は、このリポジトリのライセンス（MIT）で公開しています。不具合があれば本家ではなくこのリポジトリへ。
