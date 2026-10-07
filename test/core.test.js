import test from 'node:test';
import assert from 'node:assert/strict';
import { core } from './load.js';

const C = core();

// 目録の全キーを有効にし、候補の有効・無効を指定どおりにした対応表を作る（テスト用）
function withKeys(keys, restrict = {}) {
  const m = C.defaultMapping();
  for (const k of keys) {
    m.map[k].enabled = true;
    if (restrict[k]) for (const a of m.map[k].alts) a.enabled = restrict[k].includes(a.value);
  }
  return m;
}
// 旧版の既定（a の候補は 4 と @ だけ有効、ほかは全部有効）を再現する。参照実装 leet_ref.mjs の期待値と突き合わせる
const OLD_BASIC = withKeys(['a', 'e', 'i', 'o', 's', 't', 'l'], { a: ['4', '@'] });

test('目録: 74キー（小文字26・大文字26・数字10・単語12）、候補に空・重複・制御文字がない', () => {
  const keys = Object.keys(C.CATALOG);
  assert.equal(keys.length, 74);
  assert.equal(keys.filter((k) => /^[a-z]$/.test(k)).length, 26);
  assert.equal(keys.filter((k) => /^[A-Z]$/.test(k)).length, 26);
  assert.equal(keys.filter((k) => /^[0-9]$/.test(k)).length, 10);
  assert.deepEqual(keys.filter((k) => k.length > 1), C.WORDS);
  for (const [k, alts] of Object.entries(C.CATALOG)) {
    assert.ok(C.isValidKey(k), k);
    assert.equal(new Set(alts).size, alts.length, `${k} の候補に重複がある`);
    for (const a of alts) assert.ok(C.isValidAlt(a), `${k} の候補 ${JSON.stringify(a)}`);
  }
  const nonAscii = Object.values(C.CATALOG).flat().filter((a) => !C.isAscii(a));
  assert.equal(nonAscii.length, 32); // 旧版で有効だった30に、a の ∂ と b の ß（旧版では無効）を足した数
});

test('defaultMapping は全キー無効・全候補有効。initialMapping は basic が当たっている', () => {
  const d = C.defaultMapping();
  assert.equal(Object.keys(d.map).length, 74);
  assert.ok(Object.values(d.map).every((e) => e.enabled === false && e.alts.every((a) => a.enabled)));
  const i = C.initialMapping();
  assert.deepEqual(C.enabledKeys(i), ['a', 'e', 'i', 'l', 'o', 's', 't']);
  for (const [k, vals] of Object.entries(C.PRESETS.basic.table)) {
    assert.deepEqual(i.map[k].alts.filter((a) => a.enabled).map((a) => a.value), vals, k);
  }
});

test('hash32 と fnv1a の既知値（参照実装と同じ）', () => {
  assert.equal(C.hash32(0, 0, 0), 2861659158);
  assert.equal(C.fnv1a('a'), 3826002220);
  assert.equal(C.fnv1a('great'), 4212348398);
  assert.equal(C.hash32(1337, 0, C.fnv1a('a')), 4116810985);
  assert.equal(C.hash32(1337, 7, C.fnv1a('o')), 3448105438);
});

test('basic（README の定義）の既知解答', () => {
  const m = C.initialMapping();
  assert.equal(C.convert('Happy hacking!', m).text, 'H4ppy h4ck1ng!');
  assert.equal(C.convert('hello world', m).text, 'h3110 w0r1d');
  assert.equal(C.convert('company2024', m).text, 'c0mp4ny2024');
  assert.equal(C.convert('HELLO WORLD', m).text, 'HELLO WORLD'); // 大文字のキーは区別する
  assert.equal(C.convert('security akademeia', m).text, '53cur17y 4k4d3m314');
});

test('旧版の既定を再現した対応表で、参照実装 leet_ref.mjs と同じ出力になる', () => {
  assert.equal(C.convert('password', OLD_BASIC, { seed: 1337 }).text, 'p45$w¤rd');
  assert.equal(C.convert('password', OLD_BASIC, { seed: 42 }).text, 'p@ş$w¤rd');
  assert.equal(C.convert('password', OLD_BASIC, { seed: 7 }).text, 'p45$w[]rd');
  assert.equal(C.convert('日本語 test', OLD_BASIC, { seed: 1 }).text, '日本語 73$†');
  const adv = withKeys(C.LOWER);
  assert.deepEqual([1, 2, 3, 4, 5].map((seed) => C.convert('fun', adv, { seed }).text), ['phµท', ']=µ<\\>', '|=L|/\\/', '|#|_|{\\}', '|=|_|ท']);
});

test('単語は長い順・大文字小文字を区別せず・語境界つきで1回だけ当たる', () => {
  const words = C.applyPreset(C.defaultMapping(), 'words');
  assert.equal(C.convert('GREAT Great great YOU to', words).text, 'gr8 gr8 gr8 u 2');
  assert.equal(C.convert("you're great, mate", words).text, "u're gr8, m8");
  assert.equal(C.convert('tomorrow auto to-day', words).text, 'tomorrow auto 2-day');
  assert.equal(C.convert('too', words).text, '2'); // too（3文字）が to（2文字）より先に当たる
  const combo = C.applyPreset(C.defaultMapping(), 'combo');
  assert.equal(C.convert('great idea', combo).text, 'gr8 1d34');
  assert.equal(C.convert('great idea', combo, { mode: 'roundrobin' }).text, 'gr8 1d34');
});

test('置換した文字列は二度と触らない（候補が他のキーを含んでも連鎖しない）', () => {
  const m = withKeys(['f', 'h', 'p'], { f: ['ph'] });
  assert.equal(C.convert('f', m).text, 'ph');
  assert.equal(C.convert('xxxf', withKeys(['f', 'h', 'p', 'x'], { f: ['ph'], x: ['><'] })).text, '><><><ph');
  const k = withKeys(['k', 'l'], { k: ['l<'], l: ['1'] });
  assert.equal(C.convert('k', k).text, 'l<');
});

test('末尾に打鍵しても前の文字の候補は変わらない（uniform・roundrobin とも）', () => {
  const seq = ['p', 'pa', 'pas', 'pass', 'passw', 'passwo', 'passwor', 'password'];
  for (const mode of C.MODES) {
    const outs = seq.map((s) => C.convert(s, OLD_BASIC, { mode, seed: 1337 }).text);
    outs.forEach((o, i) => { if (i) assert.ok(o.startsWith(outs[i - 1]), `${mode}: ${outs[i - 1]} → ${o}`); });
  }
  assert.equal(C.convert('aaa', withKeys(['a'], { a: ['4', '@'] }), { mode: 'roundrobin' }).text, '4@4');
  assert.equal(C.convert('aaa', withKeys(['a'], { a: ['4', '@'] }), { mode: 'roundrobin' }).text, '4@4'); // 2回目も同じ
});

test('取りこぼしがない: basic の文字集合の長さ1〜4を総当たり', () => {
  const letters = ['a', 'e', 'i', 'o', 's', 't', 'l', 'x', ' '];
  const set = new Set(['a', 'e', 'i', 'o', 's', 't', 'l']);
  let total = 0;
  const gen = (p, n) => {
    if (n === 0) {
      if (!p.trim()) return;
      total++;
      const r = C.convert(p, OLD_BASIC).text;
      assert.ok(![...r].some((c) => set.has(c)), `${JSON.stringify(p)} → ${JSON.stringify(r)}`);
      return;
    }
    for (const c of letters) gen(p + c, n - 1);
  };
  for (let n = 1; n <= 4; n++) gen('', n);
  assert.equal(total, 7376);
});

test('区間: from をつなぐと入力、to をつなぐと出力。stats が区間と一致する', () => {
  const combo = C.applyPreset(C.defaultMapping(), 'combo');
  const r = C.convert('great idea!', combo);
  assert.equal(r.segments.map((s) => s.from).join(''), 'great idea!');
  assert.equal(r.segments.map((s) => s.to).join(''), r.text);
  assert.deepEqual(r.segments.map((s) => [s.from, s.to, s.changed]), [
    ['great', 'gr8', true], [' ', ' ', false], ['i', '1', true], ['d', 'd', false], ['e', '3', true], ['a', '4', true], ['!', '!', false],
  ]);
  assert.deepEqual(r.stats, { changed: 4, chars: 8, keys: 4 });
  for (const s of r.segments) assert.equal(s.from, 'great idea!'.slice(s.start, s.end));
  const mm = C.convert('mm', withKeys(['m']), { seed: 1 });
  assert.equal(mm.segments.length, 2);
  assert.ok(mm.segments.every((s) => s.changed && s.from === 'm' && s.to.length >= 2));
});

test('入力の上限（50,000文字）を超えると RangeError、文字列以外は TypeError。uniform は候補をほぼ一様に選ぶ', () => {
  assert.throws(() => C.convert('o'.repeat(50001), OLD_BASIC), RangeError);
  assert.throws(() => C.convert(123, OLD_BASIC), TypeError);
  const r = C.convert('o'.repeat(50000), withKeys(['o']), { seed: 99 });
  const counts = {};
  for (const s of r.segments) counts[s.to] = (counts[s.to] || 0) + 1;
  const n = Object.keys(counts).length;
  assert.equal(n, 6);
  for (const v of Object.values(counts)) assert.ok(Math.abs(v - 50000 / n) < 50000 / n * 0.05, JSON.stringify(counts));
});

test('変換率 0 は何も変えず、100 は全部変える。ASCII のみは非ASCIIの候補を使わない', () => {
  const adv = withKeys(C.LOWER);
  assert.equal(C.convert('security akademeia', adv, { rate: 0 }).text, 'security akademeia');
  assert.equal(C.convert('security akademeia', adv, { rate: 0 }).stats.changed, 0);
  const full = C.convert('security akademeia', adv, { seed: 1337, rate: 100 });
  assert.equal(full.stats.changed, 17);
  const half = C.convert('security akademeia'.repeat(20), adv, { seed: 1337, rate: 50 });
  assert.ok(half.stats.changed > 100 && half.stats.changed < 240, String(half.stats.changed));
  const elite = C.applyPreset(C.defaultMapping(), 'elite');
  for (let seed = 0; seed < 20; seed++) {
    assert.ok(C.isAscii(C.convert('hello world', elite, { seed, asciiOnly: true }).text), String(seed));
  }
  assert.ok([0, 1, 2, 3, 4, 5].some((seed) => !C.isAscii(C.convert('hello world', elite, { seed }).text)));
});

test('空・空白・改行・絵文字・CJK をそのまま通す。対応表を書き換えない', () => {
  assert.deepEqual(C.convert('', OLD_BASIC), { text: '', segments: [], stats: { changed: 0, chars: 0, keys: 0 } });
  assert.equal(C.convert('  hi  \n', OLD_BASIC).text, '  h1  \n');
  const adv = withKeys(C.LOWER);
  const emoji = C.convert('a😀b', adv, { seed: 1 });
  assert.equal(emoji.segments.length, 3);
  assert.equal(emoji.segments[1].from, '😀');
  assert.equal(emoji.segments[1].changed, false);
  const before = JSON.stringify(adv);
  C.convert('the quick brown fox', adv);
  assert.equal(JSON.stringify(adv), before);
});

test('50,000 文字を 500ms 以内に変換する', () => {
  const big = 'the quick brown fox jumps over the lazy dog 0123456789 '.repeat(900).slice(0, 50000);
  const t0 = performance.now();
  const r = C.convert(big, withKeys(C.LOWER));
  assert.ok(performance.now() - t0 < 500);
  assert.ok(r.text.length > big.length);
});

test('プリセット: table 形式はキーと候補を決め、keys 形式は候補を all／ascii で決める', () => {
  for (const id of C.PRESET_IDS) {
    const m = C.applyPreset(C.defaultMapping(), id);
    const p = C.PRESETS[id];
    if (p.table) {
      assert.deepEqual(C.enabledKeys(m).sort(), Object.keys(p.table).sort(), id);
      for (const [k, vals] of Object.entries(p.table)) {
        assert.deepEqual(m.map[k].alts.filter((a) => a.enabled).map((a) => a.value).sort(), [...vals].sort(), `${id}/${k}`);
      }
    } else {
      assert.deepEqual(C.enabledKeys(m).sort(), [...p.keys].sort(), id);
      for (const k of p.keys) {
        for (const a of m.map[k].alts) assert.equal(a.enabled, p.alts === 'all' || C.isAscii(a.value), `${id}/${k}/${a.value}`);
      }
    }
  }
  assert.throws(() => C.applyPreset(C.defaultMapping(), 'nope'));
  // 当てたあとの対応表を次のプリセットに渡しても同じ結果（前の状態に依存しない）
  const a = C.applyPreset(C.applyPreset(C.defaultMapping(), 'elite'), 'basic');
  assert.deepEqual(a, C.initialMapping());
});

test('hashcat プリセットは rules/leetspeak.rule の s ルール16行と一致する', () => {
  const rules = ['sa4', 'sa@', 'sb6', 'sc<', 'sc{', 'se3', 'sg9', 'si1', 'si!', 'so0', 'sq9', 'ss5', 'ss$', 'st7', 'st+', 'sx%'];
  const table = {};
  for (const r of rules) (table[r[1]] = table[r[1]] || []).push(r[2]);
  assert.deepEqual(C.PRESETS.hashcat.table, table);
  assert.deepEqual(C.PRESETS.cupp.table, { a: ['4'], i: ['1'], e: ['3'], t: ['7'], o: ['0'], s: ['5'], g: ['9'], z: ['2'] });
  assert.deepEqual(C.PRESETS.john.table, { a: ['4', '@'], b: ['8'], e: ['3'], g: ['9'], i: ['1', '!'], l: ['1'], o: ['0'], s: ['$', '5'], t: ['7'] });
  const m = C.applyPreset(C.defaultMapping(), 'cupp');
  assert.equal(C.convert('password', m).text, 'p455w0rd');
});

test('presetSummary: 有効になるキーの数と、無効になるキーの数', () => {
  assert.deepEqual(C.presetSummary(C.initialMapping(), 'advanced'), { enable: 26, disable: 0 });
  assert.deepEqual(C.presetSummary(C.applyPreset(C.defaultMapping(), 'advanced'), 'basic'), { enable: 7, disable: 19 });
  assert.deepEqual(C.presetSummary(C.initialMapping(), 'words'), { enable: 12, disable: 7 });
});

test('normalizeMapping: 旧形式（文字列の配列・カンマ区切りの文字列）を新形式にそろえ、壊れた項目を落とす', () => {
  const m = C.normalizeMapping({ version: 1, map: {
    a: { enabled: true, alts: ['4', '@', '4', ' ', ''] },
    b: { enabled: true, alts: [{ value: '8', enabled: false }, { value: '|3' }] },
    c: { enabled: false, alts: '(, [, <' },
    'bad key': { enabled: true, alts: ['x'] },
    d: null,
    e: { enabled: 'yes', alts: ['3'] },
  } });
  assert.deepEqual(Object.keys(m.map), ['a', 'b', 'c', 'e']);
  assert.deepEqual(m.map.a.alts, [{ value: '4', enabled: true }, { value: '@', enabled: true }]);
  assert.deepEqual(m.map.b.alts, [{ value: '8', enabled: false }, { value: '|3', enabled: true }]);
  assert.deepEqual(m.map.c.alts.map((x) => x.value), ['(', '[', '<']);
  assert.equal(m.map.e.enabled, false); // boolean の true 以外は無効
  assert.deepEqual(C.normalizeMapping(null), { version: 1, map: {} });
  assert.deepEqual(C.normalizeMapping({ map: [] }), { version: 1, map: {} });
});

test('isValidKey / isValidAlt / splitAlts', () => {
  for (const k of ['a', 'and', 'é', 'Я', '日本', 'x'.repeat(20), '<3', '/\\', 'a-b_c']) assert.ok(C.isValidKey(k), k);
  for (const k of ['', 'hello world', 'x'.repeat(21), 'a' + String.fromCharCode(0), 'a\t', ' a', 123, null]) assert.equal(C.isValidKey(k), false, String(k));
  assert.ok(C.isValidAlt('/ \\'));
  assert.equal(C.isValidAlt(' x'), false);
  assert.equal(C.isValidAlt('x'.repeat(21)), false);
  assert.deepEqual(C.splitAlts('4, @, /-\\, 4, , '), ['4', '@', '/-\\']);
  assert.deepEqual(C.splitAlts(''), []);
  assert.deepEqual(C.splitAlts(undefined), []);
});

test('parseImport: 構造を検証し、data: などの値はそのまま受け入れる', () => {
  const ok = C.parseImport(JSON.stringify({ version: 1, map: {
    a: { enabled: true, alts: [{ value: 'data:x', enabled: true }, { value: '4', enabled: true }] },
    b: { enabled: true, alts: ['onx=', '8'] },
    ' bad': { enabled: true, alts: ['x'] },
  } }));
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.mapping.map.a.alts.map((x) => x.value), ['data:x', '4']);
  assert.deepEqual(ok.mapping.map.b.alts.map((x) => x.value), ['onx=', '8']);
  assert.deepEqual(ok.skipped, [' bad']);
  assert.equal(ok.count, 2);
  assert.deepEqual(C.parseImport('{bad').errors, ['invalidJson']);
  assert.deepEqual(C.parseImport('[]').errors, ['noMap']);
  assert.deepEqual(C.parseImport('{"map":[]}').errors, ['noMap']);
  assert.deepEqual(C.parseImport('{"map":{"  ":{"alts":["x"]}}}').errors, ['empty']);
  const many = {};
  for (let i = 0; i < 201; i++) many['k' + i] = { enabled: true, alts: ['x'] };
  assert.deepEqual(C.parseImport(JSON.stringify({ map: many })).errors, ['tooManyKeys']);
  assert.deepEqual(C.parseImport('x'.repeat(C.LIMITS.importBytes + 1)).errors, ['tooLarge']);
  assert.deepEqual(C.parseImport(42).errors, ['notText']);
});

test('coverage: 置換の候補数 n、変種の数、hashcat・John・cupp の到達と使った置換の内訳', () => {
  const basic = C.initialMapping();
  const r = C.convert('password', basic);
  assert.equal(r.text, 'p455w0rd'); // basic は s→5 も持つ
  assert.ok(r.segments.filter((s) => s.changed).every((s) => s.n === 1));
  const cov = C.coverage('password', r, basic);
  assert.deepEqual(cov.variants, { count: '16', bits: 4, positions: 4 });
  assert.deepEqual(cov.used.map((u) => [u.from, u.to, u.hashcat, u.john, u.cupp]),
    [['a', '4', true, true, true], ['s', '5', true, true, true], ['o', '0', true, true, true]]);
  assert.deepEqual(cov.hashcat, { reachable: false, rules: [] }); // 1行につき1種類の置換なので3種類は作れない
  assert.deepEqual(cov.john, { reachable: true, reason: null, letters: 4, total: 54 }); // a(3)・s(3)・s(3)・o(2)
  assert.deepEqual(cov.cupp, { reachable: true, expected: 'p455w0rd' }); // cupp の表を全部当てた結果と同じ
  assert.equal(cov.identity, false);

  // o→() にすると cupp の1通りからは外れる（John は o→0 しか持たないので表にない）
  const paren = withKeys(['a', 's', 'o'], { a: ['4'], s: ['5'], o: ['()'] });
  const r2 = C.convert('password', paren);
  const cov2 = C.coverage('password', r2, paren);
  assert.equal(r2.text, 'p455w()rd');
  assert.deepEqual(cov2.cupp, { reachable: false, expected: 'p455w0rd' });
  assert.deepEqual(cov2.john, { reachable: false, reason: 'notInTable', letters: 4, total: 54 });
  assert.equal(cov2.hashcat.reachable, false);

  // hashcat の multi 行（sa@sc<se3si1so0ss$）で一致する例
  const m = withKeys(['a', 's', 'o'], { a: ['@'], s: ['$'], o: ['0'] });
  const r3 = C.convert('password', m);
  const cov3 = C.coverage('password', r3, m);
  assert.equal(r3.text, 'p@$$w0rd');
  assert.deepEqual(cov3.hashcat, { reachable: true, rules: ['sa@sc<se3si1so0ss$'] });
  assert.equal(cov3.john.reachable, true);
  assert.equal(cov3.cupp.reachable, false);

  // 単独の s ルール。cupp の表のうち banana に効くのは a→4 だけなので cupp も一致
  const a4 = withKeys(['a'], { a: ['4'] });
  const cov4 = C.coverage('banana', C.convert('banana', a4), a4);
  assert.deepEqual(cov4.hashcat, { reachable: true, rules: ['sa4'] });
  assert.deepEqual(cov4.john, { reachable: true, reason: null, letters: 4, total: 54 });
  assert.equal(cov4.cupp.reachable, true);

  // John の上限: 回すのは先頭から、組み合わせが 4,000 以上になったら打ち切り（a は 3 通りなので 8 文字目まで）
  assert.deepEqual(C.coverage('a'.repeat(8), C.convert('a'.repeat(8), a4), a4).john, { reachable: true, reason: null, letters: 8, total: 6561 });
  assert.deepEqual(C.coverage('a'.repeat(9), C.convert('a'.repeat(9), a4), a4).john, { reachable: false, reason: 'beyondLimit', letters: 8, total: 6561 });
  // 文字数の上限 10（b は 2 通りなので 2^10 = 1024 < 4000。先に 10 文字で止まる）
  const b8 = withKeys(['b'], { b: ['8'] });
  assert.deepEqual(C.coverage('b'.repeat(11), C.convert('b'.repeat(11), b8), b8).john, { reachable: false, reason: 'beyondLimit', letters: 10, total: 1024 });

  // 表にない置換・単語の置換
  const e = withKeys(['e'], { e: ['ə'] });
  const cov5 = C.coverage('eel', C.convert('eel', e), e);
  assert.deepEqual(cov5.used, [{ from: 'e', to: 'ə', hashcat: false, john: false, cupp: false }]);
  assert.equal(cov5.john.reason, 'notInTable');
  const words = C.applyPreset(C.defaultMapping(), 'words');
  const cov6 = C.coverage('great', C.convert('great', words), words);
  assert.equal(cov6.words, 1);
  assert.equal(cov6.john.reason, 'word');
  assert.equal(cov6.hashcat.reachable, false);

  // 変換率で飛ばした位置も変種の数に入る（率 100 で数える）。何も置換していなければ identity
  const r7 = C.convert('password', basic, { rate: 0 });
  const cov7 = C.coverage('password', r7, basic, { rate: 0 });
  assert.equal(cov7.identity, true);
  assert.equal(cov7.variants.count, '16');
  // 大きな数も文字列で返す
  const adv = withKeys(C.LOWER);
  const big = C.coverage('the quick brown fox jumps over the lazy dog', C.convert('the quick brown fox jumps over the lazy dog', adv), adv);
  assert.ok(big.variants.count.length > 20 && big.variants.bits > 60, JSON.stringify(big.variants));
});

test('ATTACK_RULES は PRESETS の表から作られ、hashcat の行は rules/leetspeak.rule の16行＋multi と同じ', () => {
  assert.deepEqual(C.ATTACK_RULES.hashcatSingle.map((r) => r.line),
    ['sa4', 'sa@', 'sb6', 'sc<', 'sc{', 'se3', 'sg9', 'si1', 'si!', 'so0', 'sq9', 'ss5', 'ss$', 'st7', 'st+', 'sx%']);
  assert.equal(C.ATTACK_RULES.hashcatMulti.line, 'sa@sc<se3si1so0ss$');
  assert.equal(C.ATTACK_RULES.john, C.PRESETS.john.table);
  assert.equal(C.ATTACK_RULES.cupp, C.PRESETS.cupp.table);
  assert.equal(C.ATTACK_RULES.johnMaxLetters, 10);
  assert.equal(C.ATTACK_RULES.johnMaxTotal, 4000);
});

test('parseSeed: 空と数でない値は既定値 1337、整数に丸めて 32 ビットに収める', () => {
  assert.equal(C.parseSeed(''), 1337);
  assert.equal(C.parseSeed('abc'), 1337);
  assert.equal(C.parseSeed('0'), 0);
  assert.equal(C.parseSeed('-1'), 4294967295);
  assert.equal(C.parseSeed('1.5'), 1);
  assert.equal(C.parseSeed('1e3'), 1000);
  assert.equal(C.parseSeed('4294967296'), 0);
  assert.equal(C.parseSeed(42), 42);
  assert.equal(C.parseSeed(undefined), 1337);
});
