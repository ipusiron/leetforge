import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './load.js';

// 1行に詰め込んだ（minify した）ファイルを見つける。行数の下限も見る
const FILES = [
  { path: 'js/leet-core.js', maxLine: 160, minLines: 200 },
  { path: 'script.js', maxLine: 160, minLines: 400 },
  { path: 'style.css', maxLine: 240, minLines: 700 },
  { path: 'index.html', maxLine: 300, minLines: 280 },
  { path: 'test/core.test.js', maxLine: 170, minLines: 150 },
  { path: 'test/html.test.js', maxLine: 200, minLines: 30 },
];

for (const f of FILES) {
  test(`${f.path} が1行に詰め込まれていない`, () => {
    const lines = read(f.path).split('\n').map((l) => l.replace(/\r$/, ''));
    const longest = lines.reduce((a, b) => (a.length > b.length ? a : b), '');
    assert.ok(longest.length <= f.maxLine, `最長 ${longest.length} 文字: ${longest.slice(0, 80)}…`);
    assert.ok(lines.length >= f.minLines, `${lines.length} 行しかない`);
  });
}

test('計算部は DOM・保存領域・乱数を使わない。画面のスクリプトは計算部で変換する', () => {
  const core = read('js/leet-core.js');
  for (const token of ['document', 'window', 'localStorage', 'navigator', 'Math.random', 'crypto.']) {
    assert.equal(core.includes(token), false, `計算部に ${token} がある`);
  }
  const script = read('script.js');
  for (const fn of ['Core.convert(', 'Core.applyPreset(', 'Core.parseImport(', 'Core.normalizeMapping(', 'Core.initialMapping(', 'Core.parseSeed(']) {
    assert.ok(script.includes(fn), `script.js が ${fn} を使っていない`);
  }
  assert.doesNotMatch(script, /Math\.random/);
  assert.doesNotMatch(script, /innerHTML|outerHTML|document\.write|eval\(/);
  assert.doesNotMatch(script, /style\.display/);
  assert.doesNotMatch(script, /setAttribute\('style'/);
});

test('CSS: 未定義の変数・無限のアニメーション・td のバッジ規則がなく、動きを減らす設定に従う', () => {
  const css = read('style.css');
  assert.equal(css.includes('--accent-secondary'), false);
  assert.doesNotMatch(css, /infinite/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\[hidden\]\{display:none !important\}/);
  assert.equal(css.includes('.word-key'), false);
  assert.equal(css.includes('.char-highlight'), false);
});

test('改行コードは LF（リポジトリーの既定）', () => {
  for (const f of ['js/leet-core.js', 'script.js', 'index.html', 'style.css', 'test/core.test.js', 'test/format.test.js', 'package.json']) {
    assert.equal(read(f).includes('\r'), false, `${f} に CR がある`);
  }
});
