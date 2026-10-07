// LeetForge 計算部（通常のスクリプト。globalThis.LeetCore に置く。DOM・保存領域・乱数を使わない）
//
// 変換は1パスの字句分割で行う。各位置で、単語のキー（2文字以上。長い順・大文字小文字を区別しない・
// ASCII の語境界つき）→ 1文字のキー（大文字小文字を区別する）の順に1回だけ当て、置換した文字列は二度と触らない。
// 候補の選択:
//   uniform    = 位置ハッシュ hash32(seed, 位置, キー) % 候補数。同じ入力・同じシードなら同じ結果になり、
//                末尾に文字を足しても前の文字の候補は変わらない（リアルタイム変換でちらつかない）
//   roundrobin = 1回の変換の中で、キーごとに候補を順番に回す
(function (root) {
  'use strict';

  const VERSION = 1;
  const DEFAULT_SEED = 1337;
  const LIMITS = Object.freeze({
    text: 50000,        // 入力の文字数（UTF-16 単位）
    keyLength: 20,      // キーの長さ（コードポイント）
    keys: 200,          // 対応表のキーの数
    altLength: 20,      // 候補の長さ（コードポイント）
    altsPerKey: 32,     // 1キーあたりの候補の数
    importBytes: 1024 * 1024, // インポートする JSON の大きさ
  });
  const MODES = Object.freeze(['uniform', 'roundrobin']);

  // 既定の対応表（候補の目録）。有効・無効はプリセットが決めるので、ここでは候補を並べるだけ
  const LOWER = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const DIGITS = '0123456789'.split('');
  const WORDS = ['and', 'for', 'to', 'too', 'you', 'are', 'see', 'be', 'ate', 'great', 'mate', 'late'];
  const CATALOG = {
    a: ['4', '@', '/\\', '/-\\', '^', '(L', '∂'],
    b: ['8', '|3', '13', '!3', '(3', '/3', ')3', '|-]', 'j3', 'ß', '6'],
    c: ['(', '[', '<', '¢', '©', '{'],
    d: ['|)', '(|', '[)', 'I>', '|>', 'T)'],
    e: ['3', '€', '£', '&', 'ə'],
    f: ['|=', 'ph', '|#', ']='],
    g: ['9', '6', '&', '(_+', '[,', '(_-', 'C-'],
    h: ['#', '|-|', '[-]', ']-[', ')-(', '(-)', ':-:', '}{'],
    i: ['1', '!', '|', '][', '¡'],
    j: ['_|', '_/', ']', '</'],
    k: ['|<', '1<', 'l<', '|{', '][<'],
    l: ['1', '|', '7', '£', '|_'],
    m: ['/\\/\\', '|\\/|', '^^', 'nn', 'IVI', '[V]', '{V}'],
    n: ['|\\|', '/\\/', '[]\\[]', '<\\>', '{\\}', '~', 'ท'],
    o: ['0', '()', '[]', '{}', '°', '¤'],
    p: ['|*', '|o', '|>', '[]D', '|7'],
    q: ['(_,)', '()_', '0_', '<|', '&', '9'],
    r: ['|2', '12', '2', '/2', 'I2', '|^', 'l2', 'Я'],
    s: ['5', '$', 'z', '§', 'ş'],
    t: ['7', '+', '-|-', "']['", '†', '|'],
    u: ['|_|', '(_)', 'v', 'L|', 'µ'],
    v: ['\\/', '|/', '\\|'],
    w: ['\\/\\/', 'vv', '\\N', "'//", '\\\\//', '\\^/', '(n)', '\\V/', '\\X/'],
    x: ['><', '}{', ')(', '][', '%'],
    y: ['`/', '¥', '\\|/', 'j', '\\//'],
    z: ['2', '7_', '>_', '%', '~/_'],
    A: ['4', '@', '/\\', 'Д'],
    B: ['8', '|3', 'ß'],
    C: ['(', '[', '©'],
    D: ['|)', '[)', 'Ð'],
    E: ['3', '€', '£'],
    F: ['|=', ']='],
    G: ['6', '9', 'C-'],
    H: ['#', '|-|', '}{'],
    I: ['1', '!', '|'],
    J: ['_|', ']'],
    K: ['|<', '|{'],
    L: ['1', '|_', '£'],
    M: ['/\\/\\', '|\\/|', 'IVI'],
    N: ['|\\|', '/\\/', 'И'],
    O: ['0', '()', '[]'],
    P: ['|*', '|>', '[]D'],
    Q: ['(_,)', '9', '0_'],
    R: ['|2', 'Я'],
    S: ['5', '$', '§'],
    T: ['7', '+', '†'],
    U: ['|_|', '(_)', 'µ'],
    V: ['\\/', '|/'],
    W: ['\\/\\/', 'VV', '\\N'],
    X: ['><', '}{', ')('],
    Y: ['`/', '¥', '\\|/'],
    Z: ['2', '7_', '%'],
    0: ['o', 'O', '()'],
    1: ['i', 'I', 'l', 'L', '|'],
    2: ['z', 'Z', 'to', 'too'],
    3: ['e', 'E', 'ε'],
    4: ['a', 'A', 'for'],
    5: ['s', 'S'],
    6: ['g', 'G'],
    7: ['t', 'T', 'l', 'L'],
    8: ['b', 'B'],
    9: ['g', 'G', 'q'],
    and: ['&', 'n', '+'],
    for: ['4'],
    to: ['2'],
    too: ['2'],
    you: ['u'],
    are: ['r'],
    see: ['c'],
    be: ['b'],
    ate: ['8'],
    great: ['gr8'],
    mate: ['m8'],
    late: ['l8'],
  };

  // プリセット。table 形式はキーと有効にする候補を両方決める。keys 形式はキーを有効にし、候補は all（全部）か ascii（ASCII だけ）
  // 出典のあるものは source に書く（README と座学で同じ表を使う）
  const BASIC_TABLE = { a: ['4'], e: ['3'], i: ['1'], o: ['0'], s: ['5'], t: ['7'], l: ['1'] };
  const PRESETS = {
    basic: { table: BASIC_TABLE },
    standard: {
      table: { a: ['4', '@'], b: ['8'], c: ['('], e: ['3'], g: ['9'], h: ['#'], i: ['1', '!'], l: ['1'], o: ['0'], s: ['5', '$'], t: ['7'], z: ['2'] },
    },
    advanced: { keys: LOWER, alts: 'ascii' },
    elite: { keys: LOWER.concat(UPPER), alts: 'all' },
    words: { keys: WORDS, alts: 'all' },
    combo: { table: Object.assign({}, BASIC_TABLE, { and: ['&'], for: ['4'], to: ['2'], you: ['u'], are: ['r'], great: ['gr8'] }) },
    reverse: { keys: DIGITS, alts: 'all' },
    // hashcat rules/leetspeak.rule の「leetspeak single」の s ルール16行（a4 a@ b6 c< c{ e3 g9 i1 i! o0 q9 s5 s$ t7 t+ x%）
    hashcat: {
      table: { a: ['4', '@'], b: ['6'], c: ['<', '{'], e: ['3'], g: ['9'], i: ['1', '!'], o: ['0'], q: ['9'], s: ['5', '$'], t: ['7', '+'], x: ['%'] },
      source: 'hashcat rules/leetspeak.rule',
    },
    // John the Ripper run/john.conf の [List.External:Leet] の表（a→4@ b→8 e→3 g→9 i→1! l→1 o→0 s→$5 t→7）
    john: {
      table: { a: ['4', '@'], b: ['8'], e: ['3'], g: ['9'], i: ['1', '!'], l: ['1'], o: ['0'], s: ['$', '5'], t: ['7'] },
      source: 'John the Ripper run/john.conf [List.External:Leet]',
    },
    // cupp の cupp.cfg [leet]（a=4 i=1 e=3 t=7 o=0 s=5 g=9 z=2）
    cupp: {
      table: { a: ['4'], i: ['1'], e: ['3'], t: ['7'], o: ['0'], s: ['5'], g: ['9'], z: ['2'] },
      source: 'cupp cupp.cfg [leet]',
    },
  };
  const PRESET_IDS = Object.freeze(Object.keys(PRESETS));

  // 制御文字（U+0000〜001F・U+007F〜009F）と空白を含むキー・候補は受け付けない
  const BAD_CHARS = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(31)
    + String.fromCharCode(127) + '-' + String.fromCharCode(159) + '\\s]');
  const ASCII_ONLY = /^[\x20-\x7e]+$/;

  const cpLength = (s) => Array.from(s).length;
  const isAscii = (s) => ASCII_ONLY.test(s);

  function isValidKey(key) {
    if (typeof key !== 'string') return false;
    const n = cpLength(key);
    return n >= 1 && n <= LIMITS.keyLength && !BAD_CHARS.test(key);
  }

  function isValidAlt(value) {
    if (typeof value !== 'string') return false;
    const n = cpLength(value);
    if (n < 1 || n > LIMITS.altLength) return false;
    // 候補は内側の空白を許す（「/ \」のような字形）。先頭末尾の空白と制御文字は不可
    return value === value.trim() && !BAD_CHARS.test(value.replace(/ /g, ''));
  }

  // 「4, @, /-\」のようなカンマ区切りを候補の配列にする（前後の空白を落とし、空と重複を除く）
  function splitAlts(input) {
    if (typeof input !== 'string') return [];
    const out = [];
    for (const raw of input.split(',')) {
      const v = raw.trim();
      if (isValidAlt(v) && !out.includes(v)) out.push(v);
    }
    return out.slice(0, LIMITS.altsPerKey);
  }

  // 旧形式（候補が文字列の配列、または文字列）も新形式（{value, enabled}）も、新形式にそろえる。壊れた項目は黙って落とす
  function normalizeMapping(obj) {
    const out = { version: VERSION, map: {} };
    const src = obj && typeof obj === 'object' && obj.map && typeof obj.map === 'object' && !Array.isArray(obj.map) ? obj.map : {};
    for (const [key, entry] of Object.entries(src)) {
      if (Object.keys(out.map).length >= LIMITS.keys) break;
      if (!isValidKey(key) || !entry || typeof entry !== 'object') continue;
      let raw = [];
      if (Array.isArray(entry.alts)) raw = entry.alts;
      else if (typeof entry.alts === 'string') raw = entry.alts.split(',');
      const alts = [];
      const seen = new Set();
      for (const a of raw) {
        if (alts.length >= LIMITS.altsPerKey) break;
        let value = '';
        let enabled = true;
        if (typeof a === 'string') value = a.trim();
        else if (a && typeof a === 'object') { value = String(a.value == null ? '' : a.value).trim(); enabled = a.enabled !== false; }
        if (!isValidAlt(value) || seen.has(value)) continue;
        seen.add(value);
        alts.push({ value, enabled });
      }
      out.map[key] = { enabled: entry.enabled === true, alts };
    }
    return out;
  }

  function cloneMapping(mapping) {
    return normalizeMapping(mapping);
  }

  function defaultMapping() {
    const map = {};
    for (const [key, alts] of Object.entries(CATALOG)) map[key] = { enabled: false, alts: alts.map((value) => ({ value, enabled: true })) };
    return { version: VERSION, map };
  }

  // プリセットを当てた新しい対応表を返す（元の対応表は変えない）。table にあって目録にない候補は足す
  function applyPreset(mapping, id) {
    const p = PRESETS[id];
    if (!p) throw new Error('unknown preset: ' + id);
    const m = normalizeMapping(mapping);
    for (const e of Object.values(m.map)) e.enabled = false;
    if (p.table) {
      for (const [key, values] of Object.entries(p.table)) {
        if (!m.map[key]) m.map[key] = { enabled: true, alts: [] };
        const e = m.map[key];
        e.enabled = true;
        const have = new Set(e.alts.map((a) => a.value));
        for (const v of values) if (!have.has(v)) e.alts.push({ value: v, enabled: true });
        for (const a of e.alts) a.enabled = values.includes(a.value);
      }
    } else {
      for (const key of p.keys) {
        const e = m.map[key];
        if (!e) continue;
        e.enabled = true;
        for (const a of e.alts) a.enabled = p.alts === 'all' || isAscii(a.value);
      }
    }
    return m;
  }

  // 初回の状態＝目録に basic を当てたもの
  function initialMapping() {
    return applyPreset(defaultMapping(), 'basic');
  }

  function enabledKeys(mapping) {
    const m = normalizeMapping(mapping).map;
    return Object.keys(m).filter((k) => m[k].enabled && m[k].alts.some((a) => a.enabled));
  }

  // プリセットを当てたとき、有効になるキーの数と、いま有効で無効になるキーの数
  function presetSummary(mapping, id) {
    const before = new Set(enabledKeys(mapping));
    const after = new Set(enabledKeys(applyPreset(mapping, id)));
    let disable = 0;
    for (const k of before) if (!after.has(k)) disable++;
    return { enable: after.size, disable };
  }

  // インポートする JSON を厳しめに検証する。成功なら {ok:true, mapping, skipped, count}、失敗なら {ok:false, errors}
  function parseImport(text) {
    if (typeof text !== 'string') return { ok: false, errors: ['notText'] };
    if (text.length > LIMITS.importBytes) return { ok: false, errors: ['tooLarge'] };
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, errors: ['invalidJson'] }; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !obj.map || typeof obj.map !== 'object' || Array.isArray(obj.map)) {
      return { ok: false, errors: ['noMap'] };
    }
    const keys = Object.keys(obj.map);
    if (keys.length > LIMITS.keys) return { ok: false, errors: ['tooManyKeys'] };
    const skipped = keys.filter((k) => !isValidKey(k) || !obj.map[k] || typeof obj.map[k] !== 'object');
    const mapping = normalizeMapping(obj);
    const count = Object.keys(mapping.map).length;
    if (count === 0) return { ok: false, errors: ['empty'] };
    return { ok: true, mapping, skipped, count };
  }

  // シード欄の文字列を 32 ビットの整数にする。空・数でないものは既定値
  function parseSeed(input) {
    if (typeof input === 'number') return Number.isFinite(input) ? Math.trunc(input) >>> 0 : DEFAULT_SEED;
    const s = String(input == null ? '' : input).trim();
    if (s === '') return DEFAULT_SEED;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) >>> 0 : DEFAULT_SEED;
  }

  // FNV-1a（32ビット）。キーを数にする
  function fnv1a(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // 32ビットの撹拌。Math.imul と >>> だけなので、どの JS エンジンでも同じ値になる
  function hash32(seed, pos, k) {
    let h = (seed ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ (pos + 0x7f4a7c15), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h ^ (k + 0xc2b2ae35), 0x27d4eb2f) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  const WORD_CHAR = /[A-Za-z0-9_]/;
  const isWordChar = (c) => c !== undefined && WORD_CHAR.test(c);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // 変換。戻り値は { text, segments, stats }
  //   segments: [{ from, to, start, end, changed, key? }]。from をつなぐと入力、to をつなぐと出力になる
  //   stats: { changed（置換した区間の数）, chars（置換した入力の文字数）, keys（使ったキーの種類） }
  function convert(text, mapping, options) {
    const opts = options || {};
    if (typeof text !== 'string') throw new TypeError('text must be a string');
    if (text.length > LIMITS.text) throw new RangeError('text is longer than ' + LIMITS.text);
    const mode = MODES.includes(opts.mode) ? opts.mode : 'uniform';
    const seed = parseSeed(opts.seed == null ? DEFAULT_SEED : opts.seed);
    const rate = clamp(Number.isFinite(opts.rate) ? opts.rate : 100, 0, 100);
    const asciiOnly = !!opts.asciiOnly;
    const m = normalizeMapping(mapping).map;

    const active = [];
    for (const [key, e] of Object.entries(m)) {
      if (!e.enabled) continue;
      let alts = e.alts.filter((a) => a.enabled).map((a) => a.value);
      if (asciiOnly) alts = alts.filter(isAscii);
      if (alts.length) active.push({ key, alts, word: cpLength(key) > 1, lower: key.toLowerCase(), h: fnv1a(key) });
    }
    const words = active.filter((a) => a.word).sort((a, b) => b.key.length - a.key.length || (a.key < b.key ? -1 : 1));
    const chars = new Map(active.filter((a) => !a.word).map((a) => [a.key, a]));
    const counters = Object.create(null);
    const used = new Set();

    const pick = (entry, pos) => {
      used.add(entry.key);
      const n = entry.alts.length;
      if (n === 1) return entry.alts[0];
      if (mode === 'roundrobin') {
        const k = counters[entry.key] || 0;
        counters[entry.key] = k + 1;
        return entry.alts[k % n];
      }
      return entry.alts[hash32(seed, pos, entry.h) % n];
    };
    const skip = (pos) => rate < 100 && hash32(seed, pos, 0x5eed) % 100 >= rate;

    const segments = [];
    const pushPlain = (s, pos) => {
      const last = segments[segments.length - 1];
      if (last && !last.changed) {
        last.from += s;
        last.to += s;
        last.end = pos + s.length;
      } else {
        segments.push({ from: s, to: s, start: pos, end: pos + s.length, changed: false });
      }
    };

    let i = 0;
    const len = text.length;
    while (i < len) {
      let matched = null;
      for (const w of words) {
        const L = w.key.length;
        if (i + L > len) continue;
        const piece = text.slice(i, i + L);
        if (piece.toLowerCase() !== w.lower) continue;
        if (isWordChar(text[i - 1]) || isWordChar(text[i + L])) continue;
        matched = w;
        break;
      }
      if (matched) {
        const L = matched.key.length;
        const piece = text.slice(i, i + L);
        if (skip(i)) pushPlain(piece, i);
        else segments.push({ from: piece, to: pick(matched, i), start: i, end: i + L, changed: true, key: matched.key, n: matched.alts.length });
        i += L;
        continue;
      }
      const ch = String.fromCodePoint(text.codePointAt(i));
      const entry = chars.get(ch);
      if (entry && !skip(i)) segments.push({ from: ch, to: pick(entry, i), start: i, end: i + ch.length, changed: true, key: ch, n: entry.alts.length });
      else pushPlain(ch, i);
      i += ch.length;
    }

    let changed = 0;
    let charsChanged = 0;
    for (const s of segments) if (s.changed) { changed++; charsChanged += s.from.length; }
    return { text: segments.map((s) => s.to).join(''), segments, stats: { changed, chars: charsChanged, keys: used.size } };
  }

  // ---------- 攻撃者のルールとの照合 ----------
  // 3つのツールは置換の「使い方」が違う。表が同じでも、どの出力を作れるかは別
  //   hashcat rules/leetspeak.rule: 1行につき1種類の置換を文字列の全部に当てる（sXY）。multi の1行だけ6種類を同時に当てる
  //   John the Ripper [List.External:Leet]: 表にある文字を先頭から順に「元のまま／各候補」で総当たり。回す文字は10個まで、組み合わせは4,000を超えると打ち切り
  //   cupp [leet]: 表の置換を全部いっぺんに当てる（1通りだけ）
  const ATTACK_RULES = Object.freeze({
    hashcatSingle: Object.freeze(Object.entries(PRESETS.hashcat.table).flatMap(([k, vals]) => vals.map((v) => ({ line: 's' + k + v, from: k, to: v })))),
    hashcatMulti: Object.freeze({ line: 'sa@sc<se3si1so0ss$', steps: [['a', '@'], ['c', '<'], ['e', '3'], ['i', '1'], ['o', '0'], ['s', '$']] }),
    john: PRESETS.john.table,
    johnMaxLetters: 10,
    johnMaxTotal: 4000,
    cupp: PRESETS.cupp.table,
  });

  const replaceAll = (s, from, to) => s.split(from).join(to);

  // hashcat: どの行（単独の s ルール、または multi の1行）で入力が出力になるか
  function hashcatRules(text, output) {
    const hit = [];
    for (const r of ATTACK_RULES.hashcatSingle) if (replaceAll(text, r.from, r.to) === output) hit.push(r.line);
    let m = text;
    for (const [from, to] of ATTACK_RULES.hashcatMulti.steps) m = replaceAll(m, from, to);
    if (m === output) hit.push(ATTACK_RULES.hashcatMulti.line);
    return hit;
  }

  // John: External:Leet が回す位置（先頭から、表にある文字を10個まで・組み合わせ4,000まで）
  function johnRotors(text) {
    const J = ATTACK_RULES.john;
    const positions = new Set();
    let idx = 0;
    let total = 1;
    for (let i = 0; i < text.length; i++) {
      if (idx >= ATTACK_RULES.johnMaxLetters || total >= ATTACK_RULES.johnMaxTotal) break;
      const c = text[i];
      if (J[c]) {
        positions.add(i);
        total *= 1 + J[c].length;
        idx++;
      }
    }
    return { positions, letters: idx, total };
  }

  function johnCheck(text, segments) {
    const J = ATTACK_RULES.john;
    const { positions, letters, total } = johnRotors(text);
    for (const s of segments) {
      if (!s.changed) continue;
      if (s.from.length !== 1 || !J[s.from]) return { reachable: false, reason: s.from.length === 1 ? 'notInTable' : 'word', letters, total };
      if (!J[s.from].includes(s.to)) return { reachable: false, reason: 'notInTable', letters, total };
      if (!positions.has(s.start)) return { reachable: false, reason: 'beyondLimit', letters, total };
    }
    return { reachable: true, reason: null, letters, total };
  }

  function cuppExpected(text) {
    let out = text;
    for (const [k, vals] of Object.entries(ATTACK_RULES.cupp)) out = replaceAll(out, k, vals[0]);
    return out;
  }

  // 入力 text を対応表で変換した結果 result（convert の戻り値）について、3つのツールが同じ出力を作れるか・
  // この対応表から何通りの出力が作れるか・使った置換がどの表にあるかを返す
  function coverage(text, result, mapping, options) {
    const opts = Object.assign({}, options || {}, { rate: 100 });
    const full = convert(text, mapping, opts);
    let bits = 0;
    let count = 1n;
    for (const s of full.segments) if (s.changed) { bits += Math.log2(1 + s.n); count *= BigInt(1 + s.n); }
    const seen = new Map();
    let words = 0;
    for (const s of result.segments) {
      if (!s.changed) continue;
      if (s.from.length !== 1) { words++; continue; }
      const id = s.from + '→' + s.to;
      if (seen.has(id)) continue;
      const inTable = (table) => !!table[s.from] && table[s.from].includes(s.to);
      seen.set(id, {
        from: s.from, to: s.to,
        hashcat: ATTACK_RULES.hashcatSingle.some((r) => r.from === s.from && r.to === s.to),
        john: inTable(ATTACK_RULES.john),
        cupp: inTable(ATTACK_RULES.cupp),
      });
    }
    const rules = hashcatRules(text, result.text);
    const expected = cuppExpected(text);
    return {
      variants: { count: count.toString(), bits: Math.round(bits * 100) / 100, positions: full.stats.changed },
      used: Array.from(seen.values()),
      words,
      hashcat: { reachable: rules.length > 0, rules },
      john: johnCheck(text, result.segments),
      cupp: { reachable: expected === result.text, expected },
      identity: result.text === text,
    };
  }

  root.LeetCore = {
    VERSION, LIMITS, MODES, DEFAULT_SEED, CATALOG, PRESETS, PRESET_IDS, LOWER, UPPER, DIGITS, WORDS, ATTACK_RULES,
    isAscii, isValidKey, isValidAlt, splitAlts, normalizeMapping, cloneMapping, defaultMapping, initialMapping, applyPreset,
    enabledKeys, presetSummary, parseImport, parseSeed, fnv1a, hash32, convert, coverage,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
