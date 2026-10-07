import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { read, core } from './load.js';

const C = core();
const readme = read('README.md');
const readmeEn = read('README.en.md');
const ROOT = new URL('..', import.meta.url);
const BOTH = [['README.md', readme], ['README.en.md', readmeEn]];

test('YAML メタデータの構造と値を保つ', () => {
  const block = readme.match(/^<!--\n---\n([\s\S]*?)\n---\n-->/);
  assert.ok(block, 'HTML コメントで囲んだ YAML がない');
  const yaml = block[1];
  assert.match(yaml, /^id: day079$/m);
  assert.match(yaml, /^slug: leetforge$/m);
  assert.match(yaml, /^repo_url: "https:\/\/github\.com\/ipusiron\/leetforge"$/m);
  assert.match(yaml, /^demo_url: "https:\/\/ipusiron\.github\.io\/leetforge\/"$/m);
  assert.match(yaml, /^hub: true$/m);
  assert.match(yaml, /^difficulty: \d$/m);
  assert.equal(yaml.includes('Encording'), false);
  // 配列はブロック形式（「- 」で始まる行）であること。フロー形式 [a, b] に書き換えない
  for (const key of ['category_ja', 'category_en', 'tags']) {
    const m = yaml.match(new RegExp(`^${key}:\\n((?:  - .+\\n)+)`, 'm'));
    assert.ok(m, `${key} がブロック形式でない`);
  }
  assert.equal(readmeEn.includes('<!--\n---'), false, 'YAML は README.md だけに置く');
});

test('言語の行がある', () => {
  assert.match(readme, /^\[English\]\(README\.en\.md\) · 日本語$/m);
  assert.match(readmeEn, /^English · \[日本語\]\(README\.md\)$/m);
});

// README の既知解答は計算部で再計算する。期待値を手で書き換えない
const EXAMPLES = [
  ['basic', 'Happy hacking!', 'H4ppy h4ck1ng!'],
  ['basic', 'hello world', 'h3110 w0r1d'],
  ['basic', 'company2024', 'c0mp4ny2024'],
  ['combo', 'great idea', 'gr8 1d34'],
  ['words', "you're great, mate", "u're gr8, m8"],
  ['cupp', 'password', 'p455w0rd'],
];

test('README の例（プリセットと入力→出力）が計算部の出力と一致し、両方の README にある', () => {
  for (const [preset, input, expected] of EXAMPLES) {
    const m = C.applyPreset(C.defaultMapping(), preset);
    assert.equal(C.convert(input, m).text, expected, `${preset}: ${input}`);
    for (const [name, text] of BOTH) {
      assert.ok(text.includes('`' + input + '`'), `${name} に ${input} がない`);
      assert.ok(text.includes('`' + expected + '`'), `${name} に ${expected} がない`);
    }
  }
});

test('README のプリセットの表は計算部の PRESETS から作った文字列と一致する', () => {
  const tableText = (id) => Object.entries(C.PRESETS[id].table).map(([k, vals]) => `${k}→${vals.join('/')}`).join(' ');
  for (const id of C.PRESET_IDS) {
    const p = C.PRESETS[id];
    for (const [name, text] of BOTH) {
      if (p.table) assert.ok(text.includes('`' + tableText(id) + '`'), `${name}: ${id} の表 ${tableText(id)}`);
      assert.ok(new RegExp(`^\\| \`${id}\` \\|`, 'm').test(text), `${name}: プリセット ${id} の行がない`);
    }
  }
});

test('README の上限の表が計算部の LIMITS と一致する', () => {
  for (const [name, text] of BOTH) {
    const rows = [...text.matchAll(/^\| `LIMITS\.(\w+)` \| ([\d,]+) \|/gm)];
    const found = Object.fromEntries(rows.map((m) => [m[1], Number(m[2].replace(/,/g, ''))]));
    assert.deepEqual(found, { ...C.LIMITS }, name);
  }
});

test('README の数（キー・単語・候補・テスト）が計算部とファイルの実態に合う', () => {
  const keys = Object.keys(C.CATALOG).length;
  const words = C.WORDS.length;
  for (const [name, text] of BOTH) {
    assert.ok(text.includes(`${keys}`), `${name}: キーの数 ${keys}`);
    assert.ok(text.includes(`${words}`), `${name}: 単語の数 ${words}`);
    assert.ok(text.includes(`${C.PRESET_IDS.length}`), `${name}: プリセットの数`);
  }
});

test('README の画像がすべて実在し、assets/ の PNG は README から参照されているものだけ。1枚ごとにキャプションがある', () => {
  for (const [name, text, dir] of [['README.md', readme, 'assets/'], ['README.en.md', readmeEn, 'assets/en/']]) {
    const imgs = [...text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]).filter((u) => !u.startsWith('http'));
    assert.equal(imgs.length, 4, `${name}: 画像の参照が ${imgs.length} 件`);
    for (const rel of imgs) {
      assert.ok(rel.startsWith(dir), `${name}: ${rel} は ${dir} の下に置く`);
      assert.ok(fs.existsSync(new URL(rel, ROOT)), `${rel} がない`);
      const re = new RegExp(`!\\[[^\\]]*\\]\\(${rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\s*\\n>\\s*\\*[^*]+\\*`);
      assert.match(text, re, `${rel} のキャプションがない`);
      assert.ok(fs.statSync(new URL(rel, ROOT)).size <= 300 * 1024, `${rel} が 300KB を超える`);
    }
    const pngs = fs.readdirSync(new URL(dir, ROOT)).filter((f) => f.endsWith('.png'));
    for (const f of pngs) assert.ok(imgs.includes(`${dir}${f}`), `${dir}${f} が README から参照されていない`);
  }
});

function walk(dir, prefix = '') {
  const out = [];
  for (const e of fs.readdirSync(new URL(dir, ROOT), { withFileTypes: true })) {
    if (['.git', 'node_modules', '.claude', '.playwright-mcp'].includes(e.name)) continue;
    const rel = prefix + e.name;
    if (e.isDirectory()) out.push(...walk(dir + e.name + '/', rel + '/'));
    else out.push(rel);
  }
  return out;
}

// ディレクトリー構造のコードブロックから、字下げをたどってパスを復元する
function treePaths(text) {
  const tree = text.match(/## 📁 (?:ディレクトリー構造|Directory structure)\n\n```\n([\s\S]*?)```/);
  assert.ok(tree, 'ディレクトリー構造がない');
  const lines = tree[1].split('\n').filter((l) => l.trim());
  const paths = [];
  const stack = [];
  for (const line of lines.slice(1)) {
    const m = line.match(/^((?:[│ ]   )*)(?:├── |└── )(\S+)\s*(#.*)?$/);
    assert.ok(m, `ツリーの行の形が違う: ${line}`);
    const depth = m[1].length / 4;
    const name = m[2];
    assert.ok(m[3] && m[3].startsWith('# ') && m[3].length > 2, `説明がない: ${line}`);
    stack.length = depth;
    stack[depth] = name;
    if (!name.endsWith('/')) paths.push(stack.join(''));
  }
  return paths;
}

test('ディレクトリー構造に全ファイルが載っていて、全行に説明がある（日英とも）', () => {
  const files = walk('./').sort();
  for (const [name, text] of BOTH) {
    const listed = treePaths(text).sort();
    assert.deepEqual(listed, files, name);
  }
});

test('日英の README は同じ見出しの数・順（アイコン）を持つ', () => {
  const heads = (text) => [...text.matchAll(/^(#{1,3}) (\S+)/gm)].map((m) => m[1] + ' ' + m[2]);
  const ja = heads(readme);
  const en = heads(readmeEn);
  assert.equal(ja.length, en.length, `見出しの数 ja=${ja.length} en=${en.length}`);
  const icon = (h) => h.replace(/^(#+) (\p{Extended_Pictographic}|[^\s])\S*.*$/u, '$1 $2');
  for (let i = 0; i < ja.length; i++) {
    if (/^## \p{Extended_Pictographic}/u.test(ja[i])) assert.equal(icon(en[i]), icon(ja[i]), `${i}: ${ja[i]} / ${en[i]}`);
  }
  assert.ok(ja.length >= 18, String(ja.length));
});

test('README.md の表記（禁止語・日本語と英数字の間の空白・文末のコロン・強調の数）', () => {
  const body = readme.replace(/^<!--[\s\S]*?-->/, '').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '').replace(/https?:\/\/\S+/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  for (const ng of ['分かる', '分かり', '全て', '既に', '無い', 'インターフェース', 'サーバ ', 'ブラウザ ', 'ユーザ ']) {
    assert.equal(body.includes(ng), false, `禁止語: ${ng}`);
  }
  assert.doesNotMatch(body, /ブラウザ(?!ー)/, 'ブラウザー');
  const jp = '[\\u3041-\\u30ff\\u3400-\\u9fff\\uff01-\\uff60]';
  const spaced = [...body.matchAll(new RegExp(`${jp} [A-Za-z0-9]|[A-Za-z0-9] ${jp}`, 'g'))].map((m) => m[0]);
  assert.deepEqual(spaced, [], '日本語と英数字の間の空白');
  const colons = body.split('\n').filter((l) => /[：:]\s*$/.test(l) && !l.startsWith('|') && !/^\s*[-*]/.test(l) && !/^#+ /.test(l));
  assert.deepEqual(colons, [], '文末のコロン');
  const bold = (readme.match(/\*\*[^*\n]+\*\*/g) || []).length;
  assert.ok(bold <= 20, `強調が ${bold} か所`);
});

test('README のテストの節と workflow が実態に合う', () => {
  const tests = fs.readdirSync(new URL('test/', ROOT)).filter((f) => f.endsWith('.test.js')).sort();
  for (const [name, text] of BOTH) {
    for (const f of tests) assert.ok(text.includes(`test/${f}`) || text.includes(f), `${name}: ${f}`);
    assert.ok(text.includes('npm test'), name);
  }
  assert.ok(fs.existsSync(new URL('.github/workflows/test.yml', ROOT)));
  assert.match(read('.github/workflows/test.yml'), /node-version: 22/);
});
