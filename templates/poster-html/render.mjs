// ポスターHTMLを Chrome(headless) で PNG に書き出す。
// 使い方: node tools/render.mjs <出力png> [scale=1] [query=""]   （環境変数 POSTER=text.html で別のHTML）
//   scale=0.25 でプレビュー（1034x1459）、1 で本番（4135x5837）
// 日本語パスは bash から直接渡すと化けるので、Node の spawn（引数配列）で渡す。
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.resolve(decodeURIComponent(here), '..');

const [out, scaleArg = '1', extra = ''] = process.argv.slice(2);
if (!out) { console.error('usage: node tools/render.mjs <out.png> [scale] [extraQuery]'); process.exit(1); }
const scale = parseFloat(scaleArg);
const W = Math.round(4135 * scale), H = Math.round(5837 * scale);

const html = path.join(root, 'poster', process.env.POSTER || 'index.html');  // POSTER=text.html で文字だけ版
const url = pathToFileURL(html).href + '?s=' + scale + (extra ? '&' + extra : '');
const outAbs = path.resolve(root, out);
fs.mkdirSync(path.dirname(outAbs), { recursive: true });

const args = [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  '--force-device-scale-factor=1',
  `--user-data-dir=${path.join(process.env.TEMP || root, 'poster-chrome-profile')}`,  // 普段のChromeと切り離す（プロファイル共有で止まったことがある）
  '--no-first-run', '--no-default-browser-check',
  '--allow-file-access-from-files',
  `--window-size=${W},${H}`,
  '--virtual-time-budget=20000',
  '--run-all-compositor-stages-before-draw',
  `--screenshot=${outAbs}`,
  url,
];
const t0 = Date.now();
const r = spawnSync(CHROME, args, { encoding: 'utf8', timeout: 180000 });
const log = ((r.stdout || '') + (r.stderr || '')).split('\n').filter(l => !/external_registry_loader/.test(l) && l.trim()).join('\n');
console.log(log);
console.log(`rendered ${outAbs} (${W}x${H}) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
