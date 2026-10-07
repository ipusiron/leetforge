/* =======================================================
 * LeetForge - 完成版
 * - 3タブ（コンバート / マッピング / 座学）
 * - 変換の計算は js/leet-core.js（LeetCore）。script.js は画面の処理だけ
 * - マッピング一覧/編集/追加/削除
 * - JSON インポート/エクスポート
 * - ランダム/ラウンドロビン選択
 * - シード固定（位置ハッシュ。同じシードなら同じ結果）
 * - リアルタイム変換（デバウンス）
 * ======================================================= */

const STORAGE_KEY = "leetforge.mapping.v1";
const Core = globalThis.LeetCore;

// 保存領域。localStorage が使えない環境（例外になる設定・プライベートモードの一部）でも動き、保存できないことは画面に出す
const storage = {
  available: true,
  get(key) {
    try { return localStorage.getItem(key); } catch { this.available = false; return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); return true; } catch { this.available = false; return false; }
  }
};

// 画面への通知（alert を使わない）
const noticeEl = document.getElementById("notice");
const mappingStatusEl = document.getElementById("mapping-status");
function showNotice(text) {
  noticeEl.textContent = text;
  noticeEl.hidden = !text;
}
function showMappingStatus(text, isError = false) {
  mappingStatusEl.textContent = text;
  mappingStatusEl.classList.toggle("error", isError);
}

// ---------- State ----------
let mapping = loadMapping();
let lastResult = null; // 直近の変換結果（区間つき）

// ---------- Helpers ----------
function saveMapping() {
  storage.set(STORAGE_KEY, JSON.stringify(mapping));
}

function loadMapping() {
  const raw = storage.get(STORAGE_KEY);
  if (!raw) return Core.initialMapping();
  try {
    const obj = JSON.parse(raw);
    const normalized = Core.normalizeMapping(obj);
    return Object.keys(normalized.map).length ? normalized : Core.initialMapping();
  } catch {
    return Core.initialMapping();
  }
}

function resetToDefaults() {
  mapping = Core.initialMapping();
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

// シード: 「シード固定」なら入力値、固定しないならセッションのシード（リアルタイムで安定し、「変換を実行」で引き直す）
function randomSeed() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}
let sessionSeed = randomSeed();

// ---------- Convert ----------
function doConvert() {
  const text = inputText.value;
  const mode = selectMode.value; // "uniform" | "roundrobin"
  const seedLocked = optSeedLock.checked;
  const isRealtime = optRealtime.checked;

  // 手動の「変換を実行」はそのたびに別の結果（シードを引き直す）。リアルタイムは同じシードで安定させる
  if (!isRealtime && !seedLocked) sessionSeed = randomSeed();
  const seed = seedLocked ? Core.parseSeed(seedValue.value) : sessionSeed;

  lastResult = Core.convert(text, mapping, { mode, seed });
  outputText.value = lastResult.text;

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

    const normalizedAlts = entry.alts;
    normalizedAlts.forEach((alt, index) => {
      const altItem = document.createElement('div');
      altItem.className = `alt-item ${alt.enabled ? '' : 'disabled'}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = alt.enabled;
      checkbox.addEventListener('change', () => {
        // Update the alternative's enabled state
        entry.alts[index].enabled = checkbox.checked;

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

  dlgAlts.value = entry.alts.map(alt => alt.value).join(", ");

  dlgError.textContent = "";
  dlg.showModal();
}

document.getElementById("dlg-cancel").addEventListener("click", () => dlg.close());

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
  if (!Core.isValidKey(key)) {
    dlgError.textContent = "キーは1文字または単語（空白と制御文字を含まない、最大20文字）で指定してください。";
    return;
  }
  if (key !== editingOriginalKey && (key in mapping.map)) {
    dlgError.textContent = "同じキーがすでにあります。";
    return;
  }
  // 既存の候補は有効・無効をそのまま引き継ぎ、新しい候補は有効にする
  const previous = (editingOriginalKey && mapping.map[editingOriginalKey]) ? mapping.map[editingOriginalKey].alts : [];
  const newAlts = Core.splitAlts(dlgAlts.value).map(value => {
    const old = previous.find(alt => alt.value === value);
    return { value, enabled: old ? old.enabled : true };
  });
  if (!newAlts.length) {
    dlgError.textContent = "候補を1つ以上、カンマ区切りで入れてください。";
    return;
  }
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
    // 読み込む前に大きさで弾く（1MB）
    if (file.size > Core.LIMITS.importBytes) {
      showMappingStatus(importErrorMessage("tooLarge"), true);
      return;
    }
    const text = await file.text();
    const parsed = Core.parseImport(text);
    if (!parsed.ok) {
      showMappingStatus(importErrorMessage(parsed.errors[0]), true);
      return;
    }
    mapping = parsed.mapping;
    saveMapping();
    renderTable();
    const note = parsed.skipped.length ? `（読み飛ばしたキー: ${parsed.skipped.join(", ")}）` : "";
    showMappingStatus(`${parsed.count}件のキーを読み込みました${note}`);
    if (optRealtime.checked) debouncedConvert();
  } catch (err) {
    console.error(err);
    showMappingStatus(importErrorMessage("invalidJson"), true);
  } finally {
    e.target.value = ""; // reset
  }
});

function importErrorMessage(code) {
  const messages = {
    tooLarge: "ファイルサイズが大きすぎます。1MB以下のファイルを選択してください。",
    invalidJson: "読み込みに失敗しました。JSONの形式を確認してください。",
    noMap: "不正なJSONです。'map' オブジェクトが見つかりません。",
    tooManyKeys: "マッピング数が多すぎます。200個以下に制限してください。",
    empty: "有効なキーが1つもありません。"
  };
  return messages[code] || messages.invalidJson;
}

// ---------- Reset Defaults ----------
document.getElementById("btn-reset-defaults").addEventListener("click", () => {
  if (confirm("対応表を初期状態（基本プリセット）に戻します。よろしいですか？")) {
    resetToDefaults();
    if (optRealtime.checked) debouncedConvert();
  }
});

// ---------- Preset Functions ----------
const leetPreset = document.getElementById("leet-preset");
const btnApplyPreset = document.getElementById("btn-apply-preset");

function presetTableText(presetKey) {
  const table = Core.PRESETS[presetKey].table;
  return Object.entries(table).map(([k, vals]) => `${k}→${vals.join("/")}`).join(" ");
}

const PRESETS = {
  basic: { name: "基本 (Basic)", description: `7文字の単一対応: ${presetTableText("basic")}` },
  standard: { name: "標準 (Standard)", description: `よく見る12文字、候補は1〜2個: ${presetTableText("standard")}` },
  advanced: { name: "上級 (Advanced)", description: "小文字26文字。ASCIIの候補をすべて使う" },
  elite: { name: "エリート (Elite)", description: "小文字と大文字52文字。非ASCIIを含む候補をすべて使う" },
  words: { name: "単語変換 (Words)", description: "よく使う英単語12語を短く（and→& for→4 great→gr8 など）" },
  combo: { name: "コンボ (Combo)", description: `基本の7文字に単語6語を足す: ${presetTableText("combo")}` },
  reverse: { name: "逆変換 (Reverse)", description: "数字0〜9を文字に戻す（1→i/I/l/L/| のように一意には戻らない）" },
  hashcat: { name: "hashcat leetspeak.rule", description: `hashcat の rules/leetspeak.rule と同じ置換: ${presetTableText("hashcat")}` },
  john: { name: "John the Ripper Leet", description: `John the Ripper の john.conf [List.External:Leet] と同じ置換: ${presetTableText("john")}` },
  cupp: { name: "cupp 1337 mode", description: `cupp の cupp.cfg [leet] と同じ置換: ${presetTableText("cupp")}` }
};

function applyPreset(presetKey) {
  if (!PRESETS[presetKey]) return;
  mapping = Core.applyPreset(mapping, presetKey);
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

  // 有効になるキーの数と、いま有効で無効になるキーの数
  const summary = Core.presetSummary(mapping, presetKey);
  presetEnableCountEl.textContent = summary.enable;
  presetDisableCountEl.textContent = summary.disable;

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

document.getElementById("preset-cancel").addEventListener("click", () => presetDialog.close());

btnApplyPreset.addEventListener("click", () => {
  const selectedPreset = leetPreset.value;
  if (selectedPreset && PRESETS[selectedPreset]) {
    showPresetDialog(selectedPreset);
  }
});

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
  let ok = false;
  try {
    await navigator.clipboard.writeText(outputText.value);
    ok = true;
  } catch {
    ok = fallbackCopy(outputText);
  }
  if (ok) {
    btnCopyOut.classList.add('success');
    setTimeout(() => btnCopyOut.classList.remove('success'), 500);
  }
  flashButton(btnCopyOut, ok ? "✓ コピー完了" : "コピーできません");
});
btnClearIn.addEventListener("click", () => {
  inputText.value = "";
  if (optRealtime.checked) debouncedConvert();
});

function flashButton(btn, label) {
  const span = btn.querySelector('span');
  if (!span) return;
  const originalText = span.textContent;
  span.textContent = label;
  btn.disabled = true;
  setTimeout(() => {
    span.textContent = originalText;
    btn.disabled = false;
  }, 1000);
}

// clipboard API が使えないとき（file:// や権限なし）の代替。成功したかを返す
function fallbackCopy(el) {
  el.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  el.setSelectionRange(0, 0);
  return ok;
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
  const raw = storage.get(LS_OPT_KEY);
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
  storage.set(LS_OPT_KEY, JSON.stringify(o));
}
// Update convert button visibility based on realtime mode
function updateConvertButtonVisibility() {
  btnConvert.style.display = optRealtime.checked ? 'none' : 'inline-flex';
}

optRealtime.addEventListener("change", () => {
  updateConvertButtonVisibility();
  saveOptions();
  if (optRealtime.checked) debouncedConvert();
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
  storage.set('leetforge.diffView', optDiffView.checked);
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
  storage.set(THEME_KEY, theme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

function initTheme() {
  // Check localStorage first
  const savedTheme = storage.get(THEME_KEY);
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
    if (!storage.get(THEME_KEY)) {
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
  const savedDiffView = storage.get('leetforge.diffView');
  if (savedDiffView === 'true') {
    optDiffView.checked = true;
  }

  if (!storage.available) {
    showNotice("ブラウザーの保存領域が使えないため、対応表とオプションはこのページを閉じると消えます。");
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
