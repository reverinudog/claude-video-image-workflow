# 教訓：Windows環境・コマンド

## ffmpeg の場所
`C:\Program Files\ImageMagick-7.1.1-Q16-HDRI\ffmpeg.exe`（ImageMagick同梱）。ffprobe は無いので、長さなどは `ffmpeg -i` の出力から読む。

## bat は英数字＋CRLFで書く
UTF-8の日本語コメント＋LF改行の bat は、cmd が行を読み違えて起動しなかった。

## 日本語を含む引数は bash から直接渡さない
- bash から `cmd //c "日本語.bat"` は文字化けして失敗する → `powershell -NoProfile -Command "Start-Process (Get-ChildItem '<dir>\*.bat').FullName"`
- git bash の curl で日本語入りJSONを送ると化ける → `node -e 'fetch(...)'` で送る
- heredoc で Python を流すと日本語や `\n` の扱いがずれて置換が一致しない → スクラッチパッドに .py を（Write で）書き、`PYTHONUTF8=1 python <file>` で実行。特にバックスラッシュを含む置換（`\n`・`\u`・正規表現）は必ずファイルで：heredoc で書いた `"\\u0000"` が本物の NUL 文字になって JS が壊れ、正規表現の `\\` も1つ消え、日本語入りの Python 文字列が `\u` の読み違いで構文エラーになった。バックスラッシュは `chr(92)` で組み立てるか、Edit ツールで直す

## node_modules のジャンクションは PowerShell で作る
新しい案件の `video/node_modules` を共通の `lyric-motion/node_modules` へのジャンクションにするとき、bash から `cmd //c mklink /J ...` は「スイッチが無効」で失敗した → `powershell -NoProfile -Command "New-Item -ItemType Junction -Path node_modules -Target '<共通のnode_modules>'"`

## Node の fs.cpSync は日本語のパスで落ちる
`fs.cpSync(元, 先, { recursive: true })` が、日本語を含むパスで例外も出さずに node ごと終了した（終了コード 127、Node 24、2026-10-04）。フォルダのコピーは `readdirSync` ＋ `copyFileSync` で1つずつ（`motion-kit/tools/install.mjs`）。

## remotion は node_modules から直接呼ぶ
`npx remotion render` が環境のフックの影響で失敗したことがある → `./node_modules/.bin/remotion render …`

## フォルダの削除・移動
- `rm -rf <フォルダ>` は権限設定で止められる（ユーザーが明示的に頼んでも止まった）。回り込まずに、ユーザーにエクスプローラーでの削除か `/permissions` での許可をお願いする。ファイルを特定した `rm -f` は通る
- シェルの作業ディレクトリがそのフォルダの中にあると、Windowsがロックして `mv` が "Device or resource busy" で失敗する。一時的なもの（clone など）は最初から最終的な置き場所に作る

## 書き出しが「memory allocation failed」「ERR_INSUFFICIENT_RESOURCES」で落ちる
物理メモリが空いていても、コミット済みメモリ（確保の予約）が上限近くだと落ちる。`Get-Counter '\Memory\Committed Bytes','\Memory\Commit Limit'` で確かめる。常駐している別のプロセス（セッションごとに増えていくもの）が予約を食っていないか確かめ、不要なものを止めてから書き出し直す。

## Windows PowerShell 5 で動かす .ps1 に日本語を書くなら BOM 付き UTF-8
BOM なしだと文字化けして構文エラーになる。Write ツールで書いたあと `python -c "...open(p,'w',encoding='utf-8-sig')..."` で保存し直す。

## `rm -rf` は設定で禁止されている
フォルダを空にしたいときは `rm -f フォルダ/*.png` のように中身だけ消す。

