# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LeetForge is a browser-based educational tool that converts plain text into 1337 (leet) speak. It's a static web application with no build step - files are served directly via GitHub Pages.

Demo: https://ipusiron.github.io/leetforge/

## Development

This is a vanilla JavaScript project with no dependencies or build tools. To develop:

1. Open `index.html` directly in a browser, or
2. Use a local server: `python -m http.server 8000` then visit `http://localhost:8000`

## Architecture

### Core Files

- **index.html** - Main UI with 3 tabs (Convert, Mapping, Guide). Uses tab-based navigation with ARIA attributes for accessibility. Includes strict CSP headers.
- **script.js** - Contains all application logic:
  - `DEFAULT_MAPPING` object defines character-to-leet mappings with enable/disable flags per character and per alternative
  - `doConvert()` performs text conversion using the mapping
  - `mulberry32()` provides deterministic PRNG for reproducible random conversions
  - State persisted to localStorage under key `leetforge.mapping.v1`
- **style.css** - Styling with dark/light theme support via CSS custom properties

### Data Model

Mappings use a nested structure where each key (character or word) has:
- `enabled`: boolean to toggle the entire mapping
- `alts`: array of alternatives, each with `{ value, enabled }` for individual control

```javascript
"a": {
  enabled: true,
  alts: [
    { value: "4", enabled: true },
    { value: "@", enabled: true }
  ]
}
```

### Key Functions

- `chooseIndex()` - Selects replacement using uniform random or round-robin mode
- `normalizeAltsToNewFormat()` - Migrates old array-of-strings format to new object format
- `getEnabledAlts()` - Filters to only enabled alternatives for conversion
- `validateKeyChar()` / `sanitizeInput()` - Input validation to prevent XSS
