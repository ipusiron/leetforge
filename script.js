/* =======================================================
 * LeetForge - 完成版
 * - 2タブ（コンバート / マッピング）
 * - マッピング一覧/編集/追加/削除
 * - JSON インポート/エクスポート
 * - ランダム/ラウンドロビン選択
 * - シード固定（Mulberry32）
 * - リアルタイム変換（デバウンス）
 * ======================================================= */

const STORAGE_KEY = "leetforge.mapping.v1";
const DEFAULT_MAPPING = {
  version: 1,
  map: {
    // Lowercase letters - more common in leet
    "a": { enabled: true,  alts: [
      { value: "4", enabled: true },
      { value: "@", enabled: true },
      { value: "/\\", enabled: false },
      { value: "/-\\", enabled: false },
      { value: "^", enabled: false },
      { value: "(L", enabled: false },
      { value: "∂", enabled: false }
    ]},
    "b": { enabled: true,  alts: [
      { value: "8", enabled: true },
      { value: "|3", enabled: true },
      { value: "13", enabled: false },
      { value: "!3", enabled: false },
      { value: "(3", enabled: false },
      { value: "/3", enabled: false },
      { value: ")3", enabled: false },
      { value: "|-]", enabled: false },
      { value: "j3", enabled: false },
      { value: "ß", enabled: false }
    ]},
    "c": { enabled: true,  alts: ["(", "[", "<", "¢", "©", "{"] },
    "d": { enabled: true,  alts: ["|)", "(|", "[)", "I>", "|>", "T)"] },
    "e": { enabled: true,  alts: ["3", "€", "£", "&", "ə"] },
    "f": { enabled: true,  alts: ["|=", "ph", "|#", "]="] },
    "g": { enabled: true,  alts: ["9", "6", "&", "(_+", "[,", "(_-", "C-"] },
    "h": { enabled: true,  alts: ["#", "|-|", "[-]", "]-[", ")-(", "(-)", ":-:", "}{"] },
    "i": { enabled: true,  alts: ["1", "!", "|", "][", "¡"] },
    "j": { enabled: true,  alts: ["_|", "_/", "]", "</"] },
    "k": { enabled: true,  alts: ["|<", "1<", "l<", "|{", "][<"] },
    "l": { enabled: true,  alts: ["1", "|", "7", "£", "|_"] },
    "m": { enabled: true,  alts: ["/\\/\\", "|\\/|", "^^", "nn", "IVI", "[V]", "{V}"] },
    "n": { enabled: true,  alts: ["|\\|", "/\\/", "[]\\[]", "<\\>", "{\\}", "~", "ท"] },
    "o": { enabled: true,  alts: ["0", "()", "[]", "{}", "°", "¤"] },
    "p": { enabled: true,  alts: ["|*", "|o", "|>", "[]D", "|7"] },
    "q": { enabled: true,  alts: ["(_,)", "()_", "0_", "<|", "&"] },
    "r": { enabled: true,  alts: ["|2", "12", "2", "/2", "I2", "|^", "l2", "Я"] },
    "s": { enabled: true,  alts: ["5", "$", "z", "§", "ş"] },
    "t": { enabled: true,  alts: ["7", "+", "-|-", "']['", "†", "|"] },
    "u": { enabled: true,  alts: ["|_|", "(_)", "v", "L|", "µ"] },
    "v": { enabled: true,  alts: ["\\/", "|/", "\\|"] },
    "w": { enabled: true,  alts: ["\\/\\/", "vv", "\\N", "'//", "\\\\//", "\\^/", "(n)", "\\V/", "\\X/"] },
    "x": { enabled: true,  alts: ["><", "}{", ")(", "]["] },
    "y": { enabled: true,  alts: ["`/", "¥", "\\|/", "j", "\\//"] },
    "z": { enabled: true,  alts: ["2", "7_", ">_", "%", "~/_"] },

    // Uppercase letters - less common but included
    "A": { enabled: false, alts: ["4", "@", "/\\", "Д"] },
    "B": { enabled: false, alts: ["8", "|3", "ß"] },
    "C": { enabled: false, alts: ["(", "[", "©"] },
    "D": { enabled: false, alts: ["|)", "[)", "Ð"] },
    "E": { enabled: false, alts: ["3", "€", "£"] },
    "F": { enabled: false, alts: ["|=", "]="] },
    "G": { enabled: false, alts: ["6", "9", "C-"] },
    "H": { enabled: false, alts: ["#", "|-|", "}{"] },
    "I": { enabled: false, alts: ["1", "!", "|"] },
    "J": { enabled: false, alts: ["_|", "]"] },
    "K": { enabled: false, alts: ["|<", "|{"] },
    "L": { enabled: false, alts: ["1", "|_", "£"] },
    "M": { enabled: false, alts: ["/\\/\\", "|\\/|", "IVI"] },
    "N": { enabled: false, alts: ["|\\|", "/\\/", "И"] },
    "O": { enabled: false, alts: ["0", "()", "[]"] },
    "P": { enabled: false, alts: ["|*", "|>", "[]D"] },
    "Q": { enabled: false, alts: ["(_,)", "9", "0_"] },
    "R": { enabled: false, alts: ["|2", "Я"] },
    "S": { enabled: false, alts: ["5", "$", "§"] },
    "T": { enabled: false, alts: ["7", "+", "†"] },
    "U": { enabled: false, alts: ["|_|", "(_)", "µ"] },
    "V": { enabled: false, alts: ["\\/", "|/"] },
    "W": { enabled: false, alts: ["\\/\\/", "VV", "\\N"] },
    "X": { enabled: false, alts: ["><", "}{", ")("] },
    "Y": { enabled: false, alts: ["`/", "¥", "\\|/"] },
    "Z": { enabled: false, alts: ["2", "7_", "%"] },

    // Numbers - reverse leet (numbers to letters)
    "0": { enabled: false, alts: ["o", "O", "()"] },
    "1": { enabled: false, alts: ["i", "I", "l", "L", "|"] },
    "2": { enabled: false, alts: ["z", "Z", "to", "too"] },
    "3": { enabled: false, alts: ["e", "E", "ε"] },
    "4": { enabled: false, alts: ["a", "A", "for"] },
    "5": { enabled: false, alts: ["s", "S"] },
    "6": { enabled: false, alts: ["g", "G"] },
    "7": { enabled: false, alts: ["t", "T", "l", "L"] },
    "8": { enabled: false, alts: ["b", "B"] },
    "9": { enabled: false, alts: ["g", "G", "q"] },

    // Common word substitutions
    "and": { enabled: true, alts: ["&", "n", "+"] },
    "for": { enabled: true, alts: ["4"] },
    "to": { enabled: true, alts: ["2"] },
    "too": { enabled: false, alts: ["2"] },
    "you": { enabled: true, alts: ["u"] },
    "are": { enabled: false, alts: ["r"] },
    "see": { enabled: false, alts: ["c"] },
    "be": { enabled: false, alts: ["b"] },
    "ate": { enabled: false, alts: ["8"] },
    "great": { enabled: true, alts: ["gr8"] },
    "mate": { enabled: false, alts: ["m8"] },
    "late": { enabled: false, alts: ["l8"] }
  }
};

// ---------- State ----------
let mapping = loadMapping();
let rrIndexPerChar = Object.create(null); // round-robin index per char

// ---------- Helpers ----------
function saveMapping() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mapping));
}

function loadMapping() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(DEFAULT_MAPPING);
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object" || typeof obj.map !== "object") {
      return structuredClone(DEFAULT_MAPPING);
    }
    if (typeof obj.version !== "number") obj.version = 1;

    // Migrate old format to new format
    const migratedObj = { ...obj };
    for (const [key, entry] of Object.entries(obj.map)) {
      if (entry && Array.isArray(entry.alts)) {
        migratedObj.map[key] = {
          ...entry,
          alts: normalizeAltsToNewFormat(entry.alts)
        };
      }
    }

    return migratedObj;
  } catch {
    return structuredClone(DEFAULT_MAPPING);
  }
}

function resetToDefaults() {
  mapping = structuredClone(DEFAULT_MAPPING);
  saveMapping();
  renderTable();
}

function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), ms);
  };
}

// Deterministic PRNG: Mulberry32
function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// choose index by mode
function chooseIndex(char, altsLen, mode, rng, position = 0) {
  if (altsLen <= 1) return 0;
  if (mode === "roundrobin") {
    const k = rrIndexPerChar[char] || 0;
    rrIndexPerChar[char] = k + 1;
    return k % altsLen;
  }
  // uniform random - use position for consistency in realtime mode
  const isRealtime = optRealtime.checked;
  if (isRealtime && !optSeedLock.checked) {
    // Use character and position for deterministic selection
    const charCode = char.charCodeAt(0);
    const deterministicIndex = (charCode + position) % altsLen;
    return deterministicIndex;
  }
  return Math.floor(rng() * altsLen);
}

function normalizeAlts(input) {
  if (!input) return [];
  return input
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .filter((s, i, arr) => arr.indexOf(s) === i);
}

// Helper functions for new alternative structure
function isNewAltsFormat(alts) {
  return Array.isArray(alts) && alts.length > 0 &&
         typeof alts[0] === 'object' && 'value' in alts[0];
}

function normalizeAltsToNewFormat(alts) {
  if (!Array.isArray(alts)) return [];

  // If already in new format, return as-is
  if (isNewAltsFormat(alts)) {
    return alts.map(alt => ({
      value: String(alt.value || ''),
      enabled: typeof alt.enabled === 'boolean' ? alt.enabled : true
    })).filter(alt => alt.value.length > 0);
  }

  // Convert old format (array of strings) to new format
  return alts.filter(alt => alt && String(alt).trim().length > 0)
             .map(alt => ({ value: String(alt).trim(), enabled: true }));
}

function getEnabledAlts(alts) {
  if (!Array.isArray(alts)) return [];

  if (isNewAltsFormat(alts)) {
    return alts.filter(alt => alt.enabled).map(alt => alt.value);
  }

  // Old format - all are enabled
  return alts.filter(alt => alt && String(alt).trim().length > 0);
}

function normalizeAltsFromInput(input) {
  if (!input) return [];
  const stringAlts = normalizeAlts(input);
  return stringAlts.map(value => ({ value, enabled: true }));
}

function validateKeyChar(ch) {
  if (typeof ch !== "string") return false;
  // Allow single characters or words (alphanumeric + some symbols)
  const trimmed = ch.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 20) return false; // Reasonable limit

  // Allow letters, numbers, and common symbols - stricter pattern
  const validPattern = /^[a-zA-Z0-9\-_@#$%&+*=<>()[\]{}|\\\/.,!?]+$/;

  // Additional security checks
  if (trimmed.includes('<script>') || trimmed.includes('</script>')) return false;
  if (trimmed.includes('javascript:')) return false;
  if (trimmed.includes('data:')) return false;

  return validPattern.test(trimmed);
}

function sanitizeInput(input) {
  if (typeof input !== "string") return "";
  // Remove potential XSS vectors
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

// Static seed for consistent realtime conversion
let staticSeed = 1337;

// ---------- Convert ----------
function doConvert() {
  const text = sanitizeInput(inputText.value);
  const mode = selectMode.value; // "uniform" | "roundrobin"
  const seedLocked = optSeedLock.checked;
  const seedVal = seedValue.value.trim();

  // For realtime mode, use deterministic approach
  const isRealtime = optRealtime.checked;

  // rng
  let rng;
  if (seedLocked) {
    const seedInt = seedVal === "" ? 1337 : Number(seedVal);
    rng = mulberry32(Number.isFinite(seedInt) ? seedInt : 1337);
  } else if (isRealtime) {
    // Use static seed for realtime to ensure consistency
    rng = mulberry32(staticSeed);
  } else {
    // Generate new seed only for manual conversion
    staticSeed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    rng = mulberry32(staticSeed);
  }

  // Reset round-robin only for manual conversion or when seed changes
  if (!isRealtime || seedLocked) {
    rrIndexPerChar = Object.create(null);
  }

  // Sort mapping keys by length (longest first) to prioritize words over characters
  const sortedKeys = Object.keys(mapping.map)
    .filter(key => {
      const entry = mapping.map[key];
      return entry.enabled && getEnabledAlts(entry.alts).length > 0;
    })
    .sort((a, b) => b.length - a.length);

  let result = text;
  let processedPositions = new Set();

  // Process words first, then characters
  for (const key of sortedKeys) {
    const entry = mapping.map[key];
    const enabledAlts = getEnabledAlts(entry.alts);
    if (!entry.enabled || !enabledAlts.length) continue;

    // Create case-insensitive regex for word boundaries if key is a word
    const isWord = key.length > 1;
    const regex = isWord
      ? new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      : new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');

    result = result.replace(regex, (match, offset) => {
      // Check if this position has already been processed by a longer match
      let shouldSkip = false;
      for (let i = offset; i < offset + match.length; i++) {
        if (processedPositions.has(i)) {
          shouldSkip = true;
          break;
        }
      }

      if (shouldSkip) return match;

      // Mark these positions as processed
      for (let i = offset; i < offset + match.length; i++) {
        processedPositions.add(i);
      }

      const idx = chooseIndex(key, enabledAlts.length, mode, rng, offset);
      return enabledAlts[idx];
    });
  }

  outputText.value = result;

  // Update diff view if enabled
  if (optDiffView.checked) {
    updateDiffView();
  }
}

const debouncedConvert = debounce(doConvert, 250);

// ---------- Mapping Table ----------
const tbody = document.getElementById("mapping-tbody");
const rowTemplate = document.getElementById("row-template");

function renderTable() {
  tbody.innerHTML = "";
  // stable sort by key (localeCompare)
  const keys = Object.keys(mapping.map).sort((a,b)=>a.localeCompare(b));
  for (const key of keys) {
    const entry = mapping.map[key];
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    const enabledEl = row.querySelector(".cell-enabled");
    const keyEl = row.querySelector(".cell-key");
    const altsEl = row.querySelector(".cell-alts");

    enabledEl.checked = !!entry.enabled;
    keyEl.textContent = key;

    // Create alternatives list with individual checkboxes
    altsEl.innerHTML = '';
    altsEl.className = 'alternatives-list';

    const normalizedAlts = normalizeAltsToNewFormat(entry.alts);
    normalizedAlts.forEach((alt, index) => {
      const altItem = document.createElement('div');
      altItem.className = `alt-item ${alt.enabled ? '' : 'disabled'}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = alt.enabled;
      checkbox.addEventListener('change', () => {
        // Update the alternative's enabled state
        if (isNewAltsFormat(entry.alts)) {
          entry.alts[index].enabled = checkbox.checked;
        } else {
          // Convert to new format if needed
          entry.alts = normalizeAltsToNewFormat(entry.alts);
          entry.alts[index].enabled = checkbox.checked;
        }

        // Update visual state
        altItem.className = `alt-item ${checkbox.checked ? '' : 'disabled'}`;

        saveMapping();
        if (optRealtime.checked) debouncedConvert();
      });

      const valueSpan = document.createElement('span');
      valueSpan.className = 'alt-value';
      valueSpan.textContent = alt.value;
      valueSpan.addEventListener('click', () => {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
      });

      altItem.appendChild(checkbox);
      altItem.appendChild(valueSpan);
      altsEl.appendChild(altItem);
    });

    // Style word keys differently
    if (key.length > 1) {
      keyEl.classList.add('word-key');
      keyEl.classList.remove('mono');
    } else {
      keyEl.classList.add('mono');
      keyEl.classList.remove('word-key');
    }

    // events
    enabledEl.addEventListener("change", () => {
      entry.enabled = enabledEl.checked;
      saveMapping();
      if (optRealtime.checked) debouncedConvert();
    });

    row.querySelector("[data-action='edit']").addEventListener("click", () => openEditDialog(key));
    row.querySelector("[data-action='delete']").addEventListener("click", () => deleteKey(key));

    tbody.appendChild(row);
  }
}

function deleteKey(key) {
  if (!(key in mapping.map)) return;
  delete mapping.map[key];
  saveMapping();
  renderTable();
  if (optRealtime.checked) debouncedConvert();
}

// ---------- Edit Dialog ----------
const dlg = document.getElementById("edit-dialog");
const dlgForm = document.getElementById("edit-form");
const dlgKey = document.getElementById("dlg-key");
const dlgAlts = document.getElementById("dlg-alts");
const dlgEnabled = document.getElementById("dlg-enabled");
const dlgError = document.getElementById("dlg-error");
const dlgDeleteBtn = document.getElementById("dlg-delete");
const dlgSaveBtn = document.getElementById("dlg-save");
let editingOriginalKey = null;

function openEditDialog(key) {
  editingOriginalKey = key;
  const entry = mapping.map[key];
  dlgKey.value = key;
  dlgEnabled.checked = !!entry.enabled;

  // Convert alternatives to comma-separated string for editing
  const altValues = getEnabledAlts(entry.alts).concat(
    isNewAltsFormat(entry.alts)
      ? entry.alts.filter(alt => !alt.enabled).map(alt => alt.value)
      : []
  );
  dlgAlts.value = [...new Set(altValues)].join(", ");

  dlgError.textContent = "";
  dlg.showModal();
}

dlgDeleteBtn.addEventListener("click", () => {
  if (editingOriginalKey && (editingOriginalKey in mapping.map)) {
    delete mapping.map[editingOriginalKey];
    saveMapping();
    renderTable();
    dlg.close();
    if (optRealtime.checked) debouncedConvert();
  }
});

dlgForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const key = dlgKey.value.trim();
  if (!validateKeyChar(key)) {
    dlgError.textContent = "キーは1文字または単語（英数字・記号、最大20文字）で指定してください。";
    return;
  }
  const newAlts = normalizeAltsFromInput(dlgAlts.value);
  const enabled = dlgEnabled.checked;

  // 上書き保存（キー変更にも対応）
  // 既存キー削除 → 新キー設定
  if (editingOriginalKey && editingOriginalKey !== key && (editingOriginalKey in mapping.map)) {
    delete mapping.map[editingOriginalKey];
  }
  mapping.map[key] = { enabled, alts: newAlts };

  saveMapping();
  renderTable();
  dlg.close();
  if (optRealtime.checked) debouncedConvert();
});

// ---------- Add Key ----------
document.getElementById("btn-add-key").addEventListener("click", () => {
  editingOriginalKey = null;
  dlgKey.value = "";
  dlgAlts.value = "";
  dlgEnabled.checked = true;
  dlgError.textContent = "";
  dlg.showModal();
});

// ---------- Import / Export ----------
document.getElementById("btn-export-json").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(mapping, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leetforge-mapping.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("file-import-json").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();

    // File size limit (1MB)
    if (text.length > 1024 * 1024) {
      alert("ファイルサイズが大きすぎます。1MB以下のファイルを選択してください。");
      return;
    }

    // Sanitize the JSON content
    const sanitizedText = sanitizeInput(text);
    const obj = JSON.parse(sanitizedText);

    if (!obj || typeof obj !== "object" || typeof obj.map !== "object") {
      alert("不正なJSONです。'map' オブジェクトが見つかりません。");
      return;
    }

    // Validate object structure more strictly
    if (Object.keys(obj.map).length > 200) {
      alert("マッピング数が多すぎます。200個以下に制限してください。");
      return;
    }
    // 取り込み時に正規化
    const normalized = { version: Number(obj.version) || 1, map: {} };
    for (const [k, v] of Object.entries(obj.map)) {
      if (!validateKeyChar(k)) continue;
      const en = !!v.enabled;

      // Handle both old and new alternative formats
      let alts;
      if (Array.isArray(v.alts)) {
        alts = normalizeAltsToNewFormat(v.alts);
      } else {
        // Convert string to new format
        const stringAlts = normalizeAlts(String(v.alts || ""));
        alts = stringAlts.map(value => ({ value, enabled: true }));
      }

      normalized.map[k] = { enabled: en, alts };
    }
    mapping = normalized;
    saveMapping();
    renderTable();
    if (optRealtime.checked) debouncedConvert();
  } catch (err) {
    console.error(err);
    alert("読み込みに失敗しました。JSONの形式を確認してください。");
  } finally {
    e.target.value = ""; // reset
  }
});

// ---------- Reset Defaults ----------
document.getElementById("btn-reset-defaults").addEventListener("click", () => {
  if (confirm("初期マップに戻します。よろしいですか？")) {
    resetToDefaults();
    if (optRealtime.checked) debouncedConvert();
  }
});

// ---------- Preset Functions ----------
const leetPreset = document.getElementById("leet-preset");
const btnApplyPreset = document.getElementById("btn-apply-preset");

const PRESETS = {
  basic: {
    name: "基本 (Basic)",
    description: "最も基本的なLeet変換",
    enableKeys: ["a", "e", "i", "o", "s", "t", "l"],
    disableOthers: true
  },
  standard: {
    name: "標準 (Standard)",
    description: "一般的なLeet変換",
    enableKeys: ["a", "b", "c", "e", "g", "h", "i", "l", "o", "s", "t", "z"],
    disableOthers: true
  },
  advanced: {
    name: "上級 (Advanced)",
    description: "より複雑なLeet変換",
    enableKeys: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"],
    disableOthers: true
  },
  elite: {
    name: "エリート (Elite)",
    description: "全文字 + 大文字も有効",
    enableKeys: ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"],
    disableOthers: true
  },
  reverse: {
    name: "逆変換 (Reverse)",
    description: "数字を文字に変換",
    enableKeys: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    disableOthers: true
  },
  words: {
    name: "単語変換 (Words)",
    description: "よく使う英単語をLeet化",
    enableKeys: ["and", "for", "to", "too", "you", "are", "see", "be", "ate", "great", "mate", "late"],
    disableOthers: true
  },
  combo: {
    name: "コンボ (Combo)",
    description: "基本文字 + 単語変換",
    enableKeys: ["a", "e", "i", "o", "s", "t", "l", "and", "for", "to", "you", "are", "great"],
    disableOthers: true
  }
};

function applyPreset(presetKey) {
  if (!PRESETS[presetKey]) return;

  const preset = PRESETS[presetKey];

  // Disable all if requested
  if (preset.disableOthers) {
    for (const key in mapping.map) {
      mapping.map[key].enabled = false;
    }
  }

  // Enable specified keys
  preset.enableKeys.forEach(key => {
    if (mapping.map[key]) {
      mapping.map[key].enabled = true;
    }
  });

  saveMapping();
  renderTable();
  if (optRealtime.checked) debouncedConvert();
}

leetPreset.addEventListener("change", () => {
  btnApplyPreset.disabled = !leetPreset.value;
});

// ---------- Preset Dialog ----------
const presetDialog = document.getElementById("preset-dialog");
const presetForm = document.getElementById("preset-form");
const presetNameEl = document.getElementById("preset-name");
const presetDescriptionEl = document.getElementById("preset-description");
const presetEnableCountEl = document.getElementById("preset-enable-count");
const presetDisableCountEl = document.getElementById("preset-disable-count");
const presetConfirmBtn = document.getElementById("preset-confirm");

function showPresetDialog(presetKey) {
  const preset = PRESETS[presetKey];
  if (!preset) return;

  // Update dialog content
  presetNameEl.textContent = preset.name;
  presetDescriptionEl.textContent = preset.description;

  // Calculate stats
  const currentEnabled = Object.keys(mapping.map).filter(key => mapping.map[key].enabled).length;
  const willEnable = preset.enableKeys.length;
  const willDisable = preset.disableOthers ? Object.keys(mapping.map).length - willEnable : 0;

  presetEnableCountEl.textContent = willEnable;
  presetDisableCountEl.textContent = willDisable;

  // Store preset key for confirmation
  presetConfirmBtn.dataset.presetKey = presetKey;

  // Show dialog
  presetDialog.showModal();
}

presetForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const presetKey = presetConfirmBtn.dataset.presetKey;
  if (presetKey) {
    applyPreset(presetKey);
    leetPreset.value = ""; // Reset selection
    btnApplyPreset.disabled = true;
    presetDialog.close();
  }
});

btnApplyPreset.addEventListener("click", () => {
  const selectedPreset = leetPreset.value;
  if (selectedPreset && PRESETS[selectedPreset]) {
    showPresetDialog(selectedPreset);
  }
});

// ---------- Tabs ----------
const tabConvert = document.getElementById("tab-convert");
const tabMapping = document.getElementById("tab-mapping");
const panelConvert = document.getElementById("panel-convert");
const panelMapping = document.getElementById("panel-mapping");

function activateTab(which) {
  const isConvert = which === "convert";
  tabConvert.classList.toggle("active", isConvert);
  tabMapping.classList.toggle("active", !isConvert);
  tabConvert.setAttribute("aria-selected", String(isConvert));
  tabMapping.setAttribute("aria-selected", String(!isConvert));
  panelConvert.hidden = !isConvert;
  panelMapping.hidden = isConvert;
  panelConvert.classList.toggle("active", isConvert);
  panelMapping.classList.toggle("active", !isConvert);
}

tabConvert.addEventListener("click", () => activateTab("convert"));
tabMapping.addEventListener("click", () => activateTab("mapping"));

// ---------- Convert UI ----------
const inputText   = document.getElementById("input-text");
const outputText  = document.getElementById("output-text");
const btnConvert  = document.getElementById("btn-convert");
const btnCopyOut  = document.getElementById("btn-copy-output");
const btnClearIn  = document.getElementById("btn-clear-input");
const optRealtime = document.getElementById("opt-realtime");
const optSeedLock = document.getElementById("opt-seed-lock");
const seedValue   = document.getElementById("seed-value");
const seedField   = document.getElementById("seed-field");
const selectMode  = document.getElementById("select-mode");

btnConvert.addEventListener("click", () => {
  doConvert();
  // Add pulse animation
  btnConvert.classList.add('pulse');
  outputText.classList.add('highlight-change');
  setTimeout(() => {
    btnConvert.classList.remove('pulse');
    outputText.classList.remove('highlight-change');
  }, 600);
});
btnCopyOut.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(outputText.value);
    btnCopyOut.classList.add('success');
    flashButton(btnCopyOut, "✓ コピー完了");
    setTimeout(() => btnCopyOut.classList.remove('success'), 500);
  } catch {
    fallbackCopy(outputText);
  }
});
btnClearIn.addEventListener("click", () => {
  inputText.value = "";
  if (optRealtime.checked) debouncedConvert();
});

function flashButton(btn, label) {
  const originalContent = btn.innerHTML;
  const span = btn.querySelector('span');
  if (span) {
    const originalText = span.textContent;
    span.textContent = label;
    btn.disabled = true;
    setTimeout(() => {
      span.textContent = originalText;
      btn.disabled = false;
    }, 1000);
  } else {
    btn.textContent = label;
    btn.disabled = true;
    setTimeout(() => {
      btn.innerHTML = originalContent;
      btn.disabled = false;
    }, 1000);
  }
}

function fallbackCopy(el) {
  el.select();
  document.execCommand("copy");
  el.setSelectionRange(0, 0);
}

inputText.addEventListener("input", () => {
  if (optRealtime.checked) debouncedConvert();
});
selectMode.addEventListener("change", () => {
  if (optRealtime.checked) debouncedConvert();
});
optSeedLock.addEventListener("change", () => {
  // Enable/disable seed value input based on seed lock
  seedValue.disabled = !optSeedLock.checked;
  seedField.classList.toggle('disabled', !optSeedLock.checked);
  if (optRealtime.checked) debouncedConvert();
});
seedValue.addEventListener("input", () => {
  if (optRealtime.checked) debouncedConvert();
});

// persist simple options to localStorage
const LS_OPT_KEY = "leetforge.options";
function loadOptions() {
  const raw = localStorage.getItem(LS_OPT_KEY);
  if (!raw) return;
  try {
    const o = JSON.parse(raw);
    if (typeof o.realtime === "boolean") {
      optRealtime.checked = o.realtime;
      updateConvertButtonVisibility();
    }
    if (typeof o.seedLock === "boolean") {
      optSeedLock.checked = o.seedLock;
      seedValue.disabled = !o.seedLock;
      seedField.classList.toggle('disabled', !o.seedLock);
    }
    if (typeof o.seedValue === "string") seedValue.value = o.seedValue;
    if (o.mode === "uniform" || o.mode === "roundrobin") selectMode.value = o.mode;
  } catch {}
}
function saveOptions() {
  const o = {
    realtime: optRealtime.checked,
    seedLock: optSeedLock.checked,
    seedValue: seedValue.value,
    mode: selectMode.value
  };
  localStorage.setItem(LS_OPT_KEY, JSON.stringify(o));
}
// Update convert button visibility based on realtime mode
function updateConvertButtonVisibility() {
  btnConvert.style.display = optRealtime.checked ? 'none' : 'inline-flex';
}

optRealtime.addEventListener("change", () => {
  updateConvertButtonVisibility();
  saveOptions();
});

for (const el of [optSeedLock, seedValue, selectMode]) {
  el.addEventListener("change", saveOptions);
  el.addEventListener("input", saveOptions);
}

// ---------- Diff View Feature ----------
const optDiffView = document.getElementById("opt-diff-view");
const diffContainer = document.createElement('div');
diffContainer.className = 'diff-view';
diffContainer.style.display = 'none';

function updateDiffView() {
  if (optDiffView.checked && inputText.value && outputText.value) {
    showDiffView();
  } else {
    hideDiffView();
  }
}

function showDiffView() {
  const parent = outputText.parentElement;
  const insertBefore = parent.querySelector('.diff-toggle');

  if (!parent.contains(diffContainer)) {
    parent.insertBefore(diffContainer, insertBefore);
  }

  // Create diff elements safely without innerHTML
  diffContainer.innerHTML = '';

  const originalDiv = document.createElement('div');
  originalDiv.className = 'diff-text original';
  originalDiv.textContent = inputText.value;

  const arrowDiv = document.createElement('div');
  arrowDiv.className = 'diff-arrow';
  arrowDiv.textContent = '→';

  const convertedDiv = document.createElement('div');
  convertedDiv.className = 'diff-text converted';
  convertedDiv.innerHTML = highlightChanges(inputText.value, outputText.value);

  diffContainer.appendChild(originalDiv);
  diffContainer.appendChild(arrowDiv);
  diffContainer.appendChild(convertedDiv);
  diffContainer.style.display = 'grid';
  outputText.style.display = 'none';
}

function hideDiffView() {
  diffContainer.style.display = 'none';
  outputText.style.display = 'block';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function highlightChanges(original, converted) {
  const origChars = [...original];
  const convChars = [...converted];
  let result = [];

  for (let i = 0; i < origChars.length; i++) {
    if (i < convChars.length && origChars[i] !== convChars[i]) {
      result.push(`<span class="char-highlight">${escapeHtml(convChars[i])}</span>`);
    } else if (i < convChars.length) {
      result.push(escapeHtml(convChars[i]));
    }
  }

  return result.join('');
}

optDiffView.addEventListener('change', () => {
  updateDiffView();
  localStorage.setItem('leetforge.diffView', optDiffView.checked);
});

// ---------- Theme Toggle ----------
const themeToggle = document.getElementById('theme-toggle');
const THEME_KEY = 'leetforge.theme';

function detectSystemTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

function setTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

function initTheme() {
  // Check localStorage first
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    setTheme(savedTheme);
  } else {
    // Use system preference
    const systemTheme = detectSystemTheme();
    setTheme(systemTheme);
  }
}

// Listen for system theme changes
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
    // Only auto-switch if user hasn't manually set a preference
    if (!localStorage.getItem(THEME_KEY)) {
      setTheme(e.matches ? 'light' : 'dark');
    }
  });
}

themeToggle.addEventListener('click', toggleTheme);

// ---------- Init ----------
function init() {
  // Initialize theme
  initTheme();

  loadOptions();
  renderTable();
  // 初回は空入力で出力クリア
  outputText.value = "";

  // Initialize seed field state
  seedValue.disabled = !optSeedLock.checked;
  seedField.classList.toggle('disabled', !optSeedLock.checked);

  // Initialize convert button visibility
  updateConvertButtonVisibility();

  // Load diff view preference
  const savedDiffView = localStorage.getItem('leetforge.diffView');
  if (savedDiffView === 'true') {
    optDiffView.checked = true;
  }

  // Initialize preset to "basic" on first load
  initializeDefaultPreset();
}

function initializeDefaultPreset() {
  const leetPresetSelect = document.getElementById('leet-preset');
  const hasExistingMapping = localStorage.getItem(STORAGE_KEY);

  // If no existing mapping data, apply basic preset automatically
  if (!hasExistingMapping) {
    leetPresetSelect.value = 'basic';
    applyPreset('basic');
  }
}
// Tab switching
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const targetPanel = tab.getAttribute('aria-controls');

    // Update tabs
    tabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    // Update panels
    panels.forEach(panel => {
      panel.classList.remove('active');
      panel.setAttribute('hidden', '');
    });

    const activePanel = document.getElementById(targetPanel);
    if (activePanel) {
      activePanel.classList.add('active');
      activePanel.removeAttribute('hidden');
    }
  });
});

init();
