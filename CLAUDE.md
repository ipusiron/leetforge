# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LeetForge is a browser-based educational tool that converts text into 1337 (leet) spelling. It is a static web application with no build step and no dependencies; the files are served directly via GitHub Pages. The UI is available in Japanese and English.

Demo: https://ipusiron.github.io/leetforge/

## Development

- Open `index.html` directly in a browser, or serve the directory: `python -m http.server 8000`
- Run the tests: `npm test` (Node.js 22+, `node --test`, no packages to install). GitHub Actions (`.github/workflows/test.yml`) runs the same command on push and pull_request
- Do not add npm dependencies, bundlers or CDN scripts. Do not minify. Keep LF line endings

## Architecture

### Files

- `js/leet-core.js` - Pure logic exposed as `globalThis.LeetCore`. No DOM, no storage, no randomness. Holds the catalog (`CATALOG`, 74 keys), the presets (`PRESETS`, 10 ids in `PRESET_IDS`), `LIMITS`, and the functions `convert`, `applyPreset`, `presetSummary`, `normalizeMapping`, `parseImport`, `splitAlts`, `isValidKey`, `parseSeed`, `hash32`, `fnv1a`
- `js/messages.js` - The Japanese and English dictionaries (`globalThis.LFMessages`: `MESSAGES`, `t`, `setLanguage`, `getLanguage`). Both languages have the same keys; `{name}` placeholders are filled by `t(key, values)`
- `js/i18n.js` - Language selection (`?lang=` → saved choice → browser language) and static text replacement via `data-i18n` / `data-i18n-attr` (`globalThis.LFI18n`)
- `script.js` - Screen logic only: DOM, localStorage (through a try/catch `storage` wrapper), dialogs, import/export, compare view, theme, tabs, language button. Every user-facing string comes from `t()`; the format test rejects Japanese string literals here
- `index.html` - Three tabs (Convert, Mapping, Learn), two `<dialog>` forms, a row `<template>`. Strict CSP in a meta element; no inline handlers or style attributes
- `style.css` - CSS variables for dark (`:root`) and light (`[data-theme="light"]` and the `prefers-color-scheme` block, which must stay identical); responsive from 320px
- `test/*.test.js` - node:test suites (core, readme, html, contrast, i18n, format). `test/load.js` loads the plain scripts into the test realm

### Conversion

`LeetCore.convert(text, mapping, { mode, seed, rate, asciiOnly })` scans the input once. At each position it tries word keys (longest first, case-insensitive, whole-word boundaries on ASCII alphanumerics and `_`) and then single-character keys (case-sensitive). Replaced text is never processed again. Candidate choice: `uniform` uses `hash32(seed, position, fnv1a(key)) % n` (stable while typing, reproducible by seed); `roundrobin` cycles per key within one conversion. The result is `{ text, segments, stats }`; the screen renders output, compare view and counts from `segments`.

### Data model

```javascript
{ version: 1, map: { "a": { enabled: true, alts: [{ value: "4", enabled: true }, { value: "@", enabled: false }] } } }
```

`normalizeMapping()` accepts the old format (candidates as plain strings) and always returns the object format. `parseImport()` validates structure, key characters, candidate counts and lengths, and never rewrites candidate values. Presets define both keys and candidates (`table` form) or keys plus `all`/`ascii` candidates (`keys` form); `hashcat`, `john` and `cupp` copy the tools' substitution tables verbatim and are checked against the rule lines in `test/core.test.js`.

### Storage keys

`leetforge.mapping.v1` (mapping), `leetforge.options` (realtime, seedLock, seedValue, mode, rate, asciiOnly), `leetforge.diffView`, `leetforge.theme`, `leetforge.lang`.

## Conventions

- README.md carries the YAML metadata (inside an HTML comment) that hackinglab.online reads; keep its structure. README.en.md mirrors the headings of README.md
- README examples, preset tables, limits and the directory tree are verified by `test/readme.test.js`; update code and both READMEs together
- Screenshots live in `assets/` (Japanese) and `assets/en/` (English), 1280x800, 300KB or less each
- X-Frame-Options and `frame-ancestors` are HTTP-header-only; do not add them as meta elements
