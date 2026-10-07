import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './load.js';

const css = read('style.css');

// style.css の :root（ダーク）、[data-theme="light"]、OS がライトのときの :root:not([data-theme="dark"]) から CSS 変数の色を読む
function readVars(selector) {
  const block = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  assert.ok(block, `${selector} の定義が見つからない`);
  const vars = {};
  for (const m of block[1].matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) vars[m[1]] = m[2];
  return vars;
}

function toRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

// WCAG 2.2 の相対輝度とコントラスト比
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// 半透明の面を下地に重ねる
const mix = (fg, bg, a) => fg.map((v, i) => v * a + bg[i] * (1 - a));

const dark = readVars(':root');
const light = { ...dark, ...readVars('\\[data-theme="light"\\]') };
const osLight = readVars(':root:not\\(\\[data-theme="dark"\\]\\)');

// 本文の背景は body のグラデーション（両端の色を style.css の記述から取る）
const DARK_BODY = ['#0b0d10', '#0e1217'];
const LIGHT_BODY = ['#f8fafc', '#f1f5f9'];

test('OS がライトのときの変数は [data-theme="light"] と同じ値（3か所の定義がずれない）', () => {
  for (const [k, v] of Object.entries(osLight)) assert.equal(light[k], v, `--${k}`);
  assert.deepEqual(Object.keys(osLight).sort(), Object.keys(readVars('\\[data-theme="light"\\]')).sort());
});

test('body のグラデーションの端の色が style.css にそのまま書かれている', () => {
  assert.ok(css.includes(`linear-gradient(180deg,${DARK_BODY[0]} 0%, ${DARK_BODY[1]} 100%)`), 'ダークの body');
  assert.ok(css.includes(`linear-gradient(180deg, ${LIGHT_BODY[0]} 0%, ${LIGHT_BODY[1]} 100%)`), 'ライトの body');
});

// 画面で実際に重なる組（文字 → 背景）。背景は変数名か、body のグラデーションの端（'body'）
const PAIRS = [
  ['text', 'card'], ['text', 'input-bg'], ['text', 'code-bg'], ['text', 'body'],
  ['muted', 'card'], ['muted', 'input-bg'], ['muted', 'body'],
  ['accent-text', 'card'], ['accent-text', 'input-bg'], ['accent-text', 'code-bg'], ['accent-text', 'body'],
  ['error-text', 'card'], ['error-text', 'input-bg'],
  ['link', 'body'], ['link', 'card'],
];

for (const [name, vars, body] of [['ダーク', dark, DARK_BODY], ['ライト', light, LIGHT_BODY]]) {
  test(`${name}の文字と背景が 4.5:1 以上`, () => {
    for (const [fg, bg] of PAIRS) {
      assert.ok(vars[fg], `--${fg} がない`);
      const bgs = bg === 'body' ? body : [vars[bg]];
      for (const b of bgs) {
        assert.ok(b, `--${bg} がない`);
        const r = ratio(toRgb(vars[fg]), toRgb(b));
        assert.ok(r >= 4.5, `${name}: --${fg} on ${bg === 'body' ? b : '--' + bg} = ${r.toFixed(2)}:1`);
      }
    }
  });

  test(`${name}の色つきの面の上の文字も 4.5:1 以上（アクセント・単語のバッジ・比較ビューの区間）`, () => {
    const white = [255, 255, 255];
    assert.ok(ratio(white, toRgb(vars.accent)) >= 4.5, '白 on --accent');
    assert.ok(ratio(white, toRgb('#7c3aed')) >= 4.5, '白 on #7c3aed（選択中のタブのグラデーションの端）');
    for (const g of ['#34d399', '#22c55e']) assert.ok(ratio(toRgb('#0b0d10'), toRgb(g)) >= 4.5, `#0b0d10 on ${g}（単語のバッジ）`);
    const segFrom = mix(toRgb(vars.accent), toRgb(vars['code-bg']), 0.18);
    assert.ok(ratio(toRgb(vars.text), segFrom) >= 4.5, '--text on 変換前の区間');
    const badgeChar = toRgb(vars['input-bg']);
    assert.ok(ratio(toRgb(vars.text), badgeChar) >= 4.5, '--text on 文字のバッジ');
  });
}

test('ライトのボタン（白文字）の下地と、無効な候補の取り消し線の色', () => {
  for (const b of ['#475569', '#334155']) assert.ok(ratio([255, 255, 255], toRgb(b)) >= 4.5, `白 on ${b}`);
  assert.ok(css.includes('.alt-item.disabled .alt-value {\n  color: var(--muted);\n  text-decoration: line-through;\n}'), '無効な候補は opacity でなく取り消し線');
  assert.equal(css.includes('opacity: 0.6'), false);
});

test('アクセントをそのまま文字色に使う規則が残っていない（--accent-text を使う）', () => {
  for (const sel of ['.timeline-year', '.rule-item .arrow', '.rule-item .leet', '.diff-arrow']) {
    const block = css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
    assert.ok(block, sel);
    assert.match(block[1], /color:\s*var\(--accent-text\)/, sel);
  }
});
