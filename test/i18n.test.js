import test from 'node:test';
import assert from 'node:assert/strict';
import { read, load, core } from './load.js';

const { MESSAGES, t, setLanguage, getLanguage } = load('js/messages.js').LFMessages;
const I18N = load('js/i18n.js').LFI18n;
const C = core();
const html = read('index.html');
const JAPANESE = new RegExp('[' + [[0x3000, 0x303f], [0x3040, 0x30ff], [0x3400, 0x9fff], [0xff00, 0xffef]]
  .map(([a, b]) => String.fromCharCode(a) + '-' + String.fromCharCode(b)).join('') + ']');

test('日本語と英語の辞書は同じキーを持ち、置き場所（{name}）もそろう', () => {
  const ja = Object.keys(MESSAGES.ja);
  assert.deepEqual(Object.keys(MESSAGES.en).sort(), [...ja].sort());
  const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const k of ja) assert.equal(ph(MESSAGES.en[k]), ph(MESSAGES.ja[k]), k);
  assert.ok(ja.length >= 150, String(ja.length));
  // 同じキーを2回書くと後勝ちで黙って上書きされるので、辞書のソースで重複を数える
  const src = read('js/messages.js');
  for (const lang of ['ja', 'en']) {
    const start = src.indexOf(`const ${lang} = {`);
    const block = src.slice(start, src.indexOf('\n  };', start));
    const keys = [...block.matchAll(/^\s+'([\w.]+)':/gm)].map((m) => m[1]);
    assert.ok(keys.length >= 150, `${lang}: ${keys.length}`);
    assert.equal(new Set(keys).size, keys.length, `${lang} に重複したキーがある`);
  }
});

test('英語の文言に日本語の文字がない（言語の切り替えボタンの「日本語」は例外）', () => {
  for (const [k, v] of Object.entries(MESSAGES.en)) {
    if (k === 'ui.langButton') continue;
    assert.doesNotMatch(v, JAPANESE, k);
  }
  assert.equal(MESSAGES.en['ui.langButton'], '日本語');
  assert.equal(MESSAGES.ja['ui.langButton'], 'EN');
});

test('プリセットごとに名前と説明の文言がある。表のあるプリセットの説明は {table} を持つ', () => {
  for (const id of C.PRESET_IDS) {
    assert.ok(MESSAGES.ja[`preset.${id}.name`], id);
    assert.ok(MESSAGES.ja[`preset.${id}.desc`], id);
    if (C.PRESETS[id].table) assert.match(MESSAGES.ja[`preset.${id}.desc`], /\{table\}/, id);
    else assert.doesNotMatch(MESSAGES.ja[`preset.${id}.desc`], /\{table\}/, id);
  }
});

test('index.html の data-i18n のキーは辞書にあり、書いた日本語は辞書の日本語と同じ', () => {
  const pairs = [...html.matchAll(/data-i18n="([\w.]+)"[^>]*>([^<]*)</g)].map((m) => [m[1], m[2]]);
  assert.ok(pairs.length >= 110, String(pairs.length));
  for (const [k, text] of pairs) {
    assert.ok(k in MESSAGES.ja, `辞書にないキー: ${k}`);
    assert.equal(text.trim(), MESSAGES.ja[k].trim(), k);
  }
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
    for (const part of m[1].split(';')) assert.ok(part.split(':')[1] in MESSAGES.ja, part);
  }
});

test('index.html の表示テキストは、記号と固定語を除いて data-i18n で差し替わる', () => {
  const stripped = html
    .replace(/<[a-z0-9]+\b[^>]*\bdata-i18n="[\w.]+"[^>]*>[^<]*<\/[a-z0-9]+>/g, '')
    .replace(/\b(placeholder|aria-label|title|label)="[^"]*"/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const lines = stripped.split('\n').filter((l) => JAPANESE.test(l));
  assert.deepEqual(lines, []);
});

test('t() は言語の辞書から引き、無いキーは日本語かキーそのものを返す。{name} を埋める', () => {
  setLanguage('en');
  assert.equal(getLanguage(), 'en');
  assert.equal(t('ui.tabConvert'), 'Convert');
  assert.equal(t('conv.stats', { changed: 2, chars: 3, keys: 1, length: 9 }), '2 replacements (3 characters) · 1 keys used · output 9 characters');
  assert.equal(t('no.such.key'), 'no.such.key');
  setLanguage('ja');
  assert.equal(getLanguage(), 'ja');
  assert.equal(t('conv.stats', { changed: 2, chars: 3, keys: 1, length: 9 }), '置換 2カ所（3文字）・使ったキー 1種・出力 9文字');
  setLanguage('xx');
  assert.equal(getLanguage(), 'ja');
});

test('初期の言語: ?lang= → 保存 → ブラウザーの言語（日本語以外は英語）', () => {
  assert.equal(I18N.fromQuery('?lang=en'), 'en');
  assert.equal(I18N.fromQuery('?x=1&lang=ja&y=2'), 'ja');
  assert.equal(I18N.fromQuery('?lang=fr'), null);
  assert.equal(I18N.initialLanguage('?lang=en', 'ja', ['ja-JP']), 'en');
  assert.equal(I18N.initialLanguage('', 'en', ['ja-JP']), 'en');
  assert.equal(I18N.initialLanguage('', null, ['ja-JP', 'en']), 'ja');
  assert.equal(I18N.initialLanguage('', null, ['en-US']), 'en');
  assert.equal(I18N.initialLanguage('', null, []), 'en');
  assert.equal(I18N.initialLanguage('', 'zz', undefined), 'en');
});

test('applyStaticText は data-i18n と data-i18n-attr を差し替え、lang と title を更新する', () => {
  const nodes = [
    { dataset: { i18n: 'ui.tabConvert' }, textContent: '' },
    { dataset: { i18nAttr: 'aria-label:ui.themeToggle;title:conv.copyTitle' }, attrs: {}, setAttribute(a, v) { this.attrs[a] = v; } },
  ];
  const doc = {
    documentElement: { lang: 'ja' },
    title: '',
    querySelectorAll(sel) { return sel === '[data-i18n]' ? [nodes[0]] : [nodes[1]]; },
  };
  I18N.use('en', doc);
  assert.equal(doc.documentElement.lang, 'en');
  assert.equal(doc.title, 'LeetForge - Leet Speak Converter');
  assert.equal(nodes[0].textContent, 'Convert');
  assert.deepEqual(nodes[1].attrs, { 'aria-label': 'Toggle color theme', title: 'Copy the output' });
  I18N.use('ja', doc);
  assert.equal(nodes[0].textContent, 'コンバート');
  assert.equal(doc.title, 'LeetForge - リートコンバーター');
});
