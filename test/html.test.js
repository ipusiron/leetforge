import test from 'node:test';
import assert from 'node:assert/strict';
import { read, core } from './load.js';

const html = read('index.html');
const C = core();

test('CSP の meta があり、meta では効かない指定と unsafe-inline を書かない', () => {
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(csp, 'CSP の meta がない');
  for (const d of ["default-src 'self'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:", "connect-src 'none'", "object-src 'none'", "base-uri 'none'"]) {
    assert.ok(csp[1].includes(d), d);
  }
  assert.doesNotMatch(csp[1], /frame-ancestors/); // meta では効かない
  assert.doesNotMatch(csp[1], /unsafe-inline|unsafe-eval/);
  for (const name of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'X-XSS-Protection']) {
    assert.equal(html.includes(name), false, `${name} は meta では効かない`);
  }
});

test('referrer の meta・favicon・noscript があり、lang は ja', () => {
  assert.match(html, /<meta name="referrer" content="no-referrer"/);
  assert.match(html, /<link rel="icon" href="data:,"/);
  assert.match(html, /<noscript><p class="notice">[^<]+<\/p><\/noscript>/);
  assert.match(html, /^<html lang="ja">/m);
});

test('インラインのイベントハンドラーと style 属性がない', () => {
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /\sstyle\s*=\s*"/i);
  assert.doesNotMatch(html, /javascript:/i);
});

test('入出力の textarea に名前があり、テーマボタンは header-tools の中、タブは roving tabindex', () => {
  assert.match(html, /<h2 id="label-input">/);
  assert.match(html, /<textarea id="input-text" aria-labelledby="label-input"/);
  assert.match(html, /<h2 id="label-output">/);
  assert.match(html, /<textarea id="output-text" aria-labelledby="label-output"/);
  assert.match(html, /<div class="header-tools">\s*<button class="theme-toggle" id="theme-toggle" type="button" aria-label="[^"]+">/);
  assert.match(html, /id="tab-convert" tabindex="0"/);
  assert.match(html, /id="tab-mapping" tabindex="-1"/);
  assert.match(html, /id="tab-guide" tabindex="-1"/);
  for (const cls of ['col-enabled', 'col-key', 'col-actions']) assert.ok(html.includes(`<th class="${cls}">`), cls);
});

test('スクリプトは計算部・画面の順に読み込む', () => {
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(srcs, ['js/leet-core.js', 'script.js']);
});

test('プリセットの選択肢は計算部の PRESETS と同じ（順も同じ）', () => {
  const sel = html.match(/<select id="leet-preset"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(sel, 'プリセットの select がない');
  const values = [...sel[1].matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
  assert.deepEqual(values, C.PRESET_IDS);
});

test('ダイアログのキャンセルは type="button"（submit にしない）。required のブラウザー検証に頼らない', () => {
  assert.match(html, /<button type="button" id="preset-cancel" class="btn ghost">/);
  assert.match(html, /<button type="button" id="dlg-cancel" class="btn ghost">/);
  assert.doesNotMatch(html, /value="cancel"/);
  assert.doesNotMatch(html, /<input id="dlg-key"[^>]*\srequired/);
  assert.match(html, /<form method="dialog" class="dialog-card" id="preset-form" novalidate>/);
  assert.match(html, /<form method="dialog" class="dialog-card" id="edit-form" novalidate>/);
});

test('通知の領域（role="status"）がある', () => {
  assert.match(html, /<p id="notice" class="notice" role="status" aria-live="polite" hidden><\/p>/);
  assert.match(html, /<p class="status" id="mapping-status" role="status" aria-live="polite"><\/p>/);
});

test('主要な要素の id がそろっている', () => {
  const ids = [
    'theme-toggle', 'tab-convert', 'tab-mapping', 'tab-guide', 'panel-convert', 'panel-mapping', 'panel-guide',
    'input-text', 'output-text', 'btn-clear-input', 'btn-copy-output', 'opt-diff-view', 'opt-realtime', 'opt-seed-lock',
    'seed-field', 'seed-value', 'select-mode', 'btn-convert', 'rate-value', 'rate-output', 'opt-ascii-only', 'convert-stats',
    'btn-add-key', 'leet-preset', 'btn-apply-preset', 'btn-export-json', 'file-import-json', 'btn-reset-defaults', 'mapping-table', 'mapping-tbody',
    'preset-dialog', 'preset-form', 'preset-name', 'preset-description', 'preset-enable-count', 'preset-disable-count', 'preset-cancel', 'preset-confirm',
    'edit-dialog', 'edit-form', 'dlg-key', 'dlg-alts', 'dlg-enabled', 'dlg-error', 'dlg-cancel', 'dlg-delete', 'dlg-save', 'row-template',
  ];
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), `id="${id}" がない`);
});

test('タブとパネルが id で結ばれている（role・aria-controls・aria-labelledby）', () => {
  const tabs = [...html.matchAll(/<button class="tab[^"]*" role="tab" aria-selected="(?:true|false)" aria-controls="panel-(\w+)" id="tab-(\w+)"/g)];
  assert.equal(tabs.length, 3);
  for (const [, panelKey, tabKey] of tabs) {
    assert.equal(panelKey, tabKey);
    assert.ok(new RegExp(`<section id="panel-${panelKey}" class="panel[^"]*" role="tabpanel" aria-labelledby="tab-${panelKey}"`).test(html), panelKey);
  }
});
