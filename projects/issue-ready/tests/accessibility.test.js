import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const htmlPath = fileURLToPath(new URL("../site/index.html", import.meta.url));
const cssPath = fileURLToPath(new URL("../site/styles.css", import.meta.url));
const appPath = fileURLToPath(new URL("../site/src/app.js", import.meta.url));
const html = existsSync(htmlPath) ? readFileSync(htmlPath, "utf8") : "";
const css = existsSync(cssPath) ? readFileSync(cssPath, "utf8") : "";
const app = existsSync(appPath) ? readFileSync(appPath, "utf8") : "";

function parseVariables(block) {
  return Object.fromEntries([...block.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-f]{6})\s*;/gi)]
    .map((match) => [match[1], match[2]]));
}

function themeVariables(source, theme) {
  if (theme === "dark") {
    const match = source.match(/:root\s*\{([^}]+)\}/);
    return match ? parseVariables(match[1]) : {};
  }
  const match = source.match(/@media\s*\(prefers-color-scheme:\s*light\)\s*\{[\s\S]*?:root\s*\{([^}]+)\}/i);
  return match ? parseVariables(match[1]) : {};
}

function luminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(left, right) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("accessibility: required local page files exist", () => {
  assert.ok(existsSync(htmlPath), "site/index.html is missing");
  assert.ok(existsSync(cssPath), "site/styles.css is missing");
  assert.ok(existsSync(appPath), "site/src/app.js is missing");
});

test("accessibility: dark and light theme text and control contrast meet the required ratios", () => {
  for (const theme of ["dark", "light"]) {
    const colors = themeVariables(css, theme);
    for (const token of ["color-bg", "color-surface", "color-text", "color-muted", "color-border", "color-action", "color-action-text"]) {
      assert.ok(colors[token], `${theme} theme is missing --${token}`);
    }
    for (const surface of [colors["color-bg"], colors["color-surface"]]) {
      assert.ok(contrast(colors["color-text"], surface) >= 4.5, `${theme} body text contrast is too low`);
      assert.ok(contrast(colors["color-muted"], surface) >= 4.5, `${theme} secondary text contrast is too low`);
    }
    assert.ok(contrast(colors["color-action-text"], colors["color-action"]) >= 4.5, `${theme} button text contrast is too low`);
    assert.ok(contrast(colors["color-border"], colors["color-surface"]) >= 3, `${theme} control boundary contrast is too low`);
  }
});

test("accessibility: forms have visible labels, language selection, live status, and a text preview", () => {
  for (const id of ["title", "summary", "version", "steps", "expected", "actual", "logs", "language"]) {
    assert.match(html, new RegExp(`<label\\b[^>]*for=["']${id}["']`, "i"), `missing visible label for ${id}`);
  }
  assert.match(html, /<html\b[^>]*lang=["'][a-z-]+["']/i);
  assert.match(html, /<div\b[^>]*id=["']status["'][^>]*aria-live=["']polite["']/i);
  assert.match(html, /<pre\b[^>]*id=["']preview["']/i);
  assert.match(html, /<select\b[^>]*id=["']language["']/i);
});

test("accessibility: the language label stays available to assistive technology on mobile", () => {
  assert.match(html, /<label\b[^>]*for=["']language["']/i);
  assert.doesNotMatch(css, /\.language-label\s*\{\s*display\s*:\s*none\s*;/i);
});

test("accessibility: review output is rendered as text and no content persistence or upload API is used", () => {
  assert.doesNotMatch(app, /\.innerHTML\s*=/);
  assert.match(app, /\.textContent\s*=/);
  assert.doesNotMatch(app, /\b(?:fetch|XMLHttpRequest|sendBeacon)\s*\(/);
  assert.doesNotMatch(app, /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie)\b/i);
  assert.doesNotMatch(app, /console\.(?:log|info|debug|warn|error)\s*\(/);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc=["']https?:\/\//i);
  assert.doesNotMatch(css, /@import\s+url\s*\(/i);
});
