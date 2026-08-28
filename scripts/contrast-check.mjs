#!/usr/bin/env node
// Parses the OKLCH design tokens in app/globals.css and computes real WCAG
// contrast ratios for every semantic pair, in both themes. Dependency-free by
// design (docs/DESIGN.md §2's check) — an LLM asked to "compute contrast" in
// prose fabricates numbers, so this is the only trustworthy source.
import { readFileSync } from 'node:fs';

const CSS_PATH = 'app/globals.css';
const TEXT_THRESHOLD = 4.5;
const NON_TEXT_THRESHOLD = 3;

function extractBlock(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1)
    throw new Error(`Could not find "${selector}" block in ${CSS_PATH}`);
  const braceStart = css.indexOf('{', start);
  const braceEnd = css.indexOf('}', braceStart);
  if (braceEnd === -1)
    throw new Error(`Unterminated "${selector}" block in ${CSS_PATH}`);
  return css.slice(braceStart + 1, braceEnd);
}

function parseTokens(block) {
  const tokens = {};
  const pattern = /--([a-z0-9-]+):\s*oklch\(([^)]+)\)/g;
  let match;
  while ((match = pattern.exec(block))) {
    const [, name, triple] = match;
    const [l, c, h] = triple.trim().split(/\s+/).map(Number);
    tokens[name] = { l, c, h };
  }
  return tokens;
}

// Björn Ottosson's OKLab -> linear sRGB matrices.
function oklchToLinearSrgb({ l, c, h }) {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const lc = l_ ** 3;
  const mc = m_ ** 3;
  const sc = s_ ** 3;

  return {
    r: 4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    g: -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    b: -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
  };
}

// The OKLab matrices above already yield linear-light sRGB, so WCAG's
// relative-luminance weights apply directly — no gamma round-trip needed.
function relativeLuminance(token) {
  const { r, g, b } = oklchToLinearSrgb(token);
  const clamp = (v) => Math.min(1, Math.max(0, v));
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b);
}

function contrastRatio(a, b) {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

function buildPairs(tokens) {
  const pairs = [];
  const seen = new Set();

  function addPair(textName, bgName, threshold) {
    const key = `${textName}::${bgName}`;
    if (seen.has(key) || !tokens[textName] || !tokens[bgName]) return;
    seen.add(key);
    pairs.push({
      label: `${textName} on ${bgName}`,
      textName,
      bgName,
      threshold,
    });
  }

  // Every token paired with its own -foreground.
  for (const name of Object.keys(tokens)) {
    if (name.endsWith('-foreground')) continue;
    const fg = `${name}-foreground`;
    if (tokens[fg]) addPair(fg, name, TEXT_THRESHOLD);
  }

  // Text roles laid over every surface background.
  const textRoles = ['foreground', 'muted-foreground', 'destructive'];
  const surfaces = ['background', 'card', 'popover', 'muted'];
  for (const role of textRoles)
    for (const surface of surfaces) addPair(role, surface, TEXT_THRESHOLD);

  // Non-text UI elements against the page background — 3:1 threshold.
  for (const name of ['border', 'input', 'ring'])
    addPair(name, 'background', NON_TEXT_THRESHOLD);

  return pairs;
}

const css = readFileSync(CSS_PATH, 'utf8');
const lightTokens = parseTokens(extractBlock(css, ':root'));
const darkTokens = parseTokens(extractBlock(css, '.dark'));
const pairs = buildPairs(lightTokens);

let failed = false;
const rows = pairs.map(({ label, textName, bgName, threshold }) => {
  const light = contrastRatio(lightTokens[textName], lightTokens[bgName]);
  const dark = contrastRatio(darkTokens[textName], darkTokens[bgName]);
  const pass = light >= threshold && dark >= threshold;
  if (!pass) failed = true;
  return {
    Pair: label,
    Light: light.toFixed(2),
    Dark: dark.toFixed(2),
    Required: threshold.toFixed(1),
    Result: pass ? 'pass' : 'FAIL',
  };
});

console.table(rows);

if (failed) {
  console.error(
    'contrast:check — one or more token pairs fail their WCAG threshold.',
  );
  process.exit(1);
} else {
  console.log(`contrast:check — all ${rows.length} pairs pass.`);
}
