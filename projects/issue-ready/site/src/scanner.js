export const MAX_INPUT_BYTES = 2 * 1024 * 1024;
export const MAX_FINDINGS = 500;

const RULES = [
  {
    name: "authorization-scheme",
    category: "credential",
    pattern: /\b(?:Bearer|Basic)[\t ]+[A-Za-z0-9._~+/=-]{8,}/gdi,
  },
  {
    name: "provider-token",
    category: "credential",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/gdi,
  },
  {
    name: "jwt",
    category: "credential",
    pattern: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/gdi,
  },
  {
    name: "private-key-block",
    category: "credential",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/gdi,
  },
  {
    name: "email-address",
    category: "email",
    pattern: /\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+\b/gdi,
  },
  {
    name: "home-path",
    category: "filesystem-path",
    pattern: /(?:^|[\s("'=])(?<path>[A-Z]:\\Users\\[^\\/\s"'<>;,|]+(?:\\[^\s"'<>;,|]*)*|\/(?:Users|home|root)\/[A-Za-z0-9._-]+(?:\/[^\s"'<>;,|]*)?)(?=$|[\s"'<>;,|])/gdi,
    captureName: "path",
  },
];

const CATEGORY_PRIORITY = new Map([
  ["credential", 3],
  ["email", 2],
  ["filesystem-path", 1],
]);

const SENSITIVE_NAME = /password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key/gi;
const KEY_CHARACTER = /[A-Za-z0-9_.-]/;

function collectSensitiveAssignments(text) {
  const matches = [];
  const pattern = new RegExp(SENSITIVE_NAME.source, SENSITIVE_NAME.flags);
  let keyword;

  while ((keyword = pattern.exec(text)) !== null) {
    let keyStart = keyword.index;
    let keyLength = keyword[0].length;
    while (keyStart > 0 && keyLength < 128 && KEY_CHARACTER.test(text[keyStart - 1])) {
      keyStart -= 1;
      keyLength += 1;
    }
    if (keyStart > 0 && KEY_CHARACTER.test(text[keyStart - 1])) continue;

    let keyEnd = keyword.index + keyword[0].length;
    while (keyEnd < text.length && keyLength < 128 && KEY_CHARACTER.test(text[keyEnd])) {
      keyEnd += 1;
      keyLength += 1;
    }
    if (keyEnd < text.length && KEY_CHARACTER.test(text[keyEnd])) continue;
    if (text[keyEnd] === "\"" || text[keyEnd] === "'") keyEnd += 1;

    let delimiter = keyEnd;
    while (text[delimiter] === " " || text[delimiter] === "\t") delimiter += 1;
    if (text[delimiter] !== "=" && text[delimiter] !== ":") continue;

    let start = delimiter + 1;
    while (text[start] === " " || text[start] === "\t") start += 1;
    let end = start;
    const quote = text[start] === "\"" || text[start] === "'" ? text[start] : null;
    if (quote) {
      start += 1;
      const closingQuote = text.indexOf(quote, start);
      const lineBreak = text.indexOf("\n", start);
      end = closingQuote < 0 || (lineBreak >= 0 && lineBreak < closingQuote)
        ? (lineBreak >= 0 ? lineBreak : text.length)
        : closingQuote;
    } else {
      while (end < text.length && !/[\s,;#]/.test(text[end])) end += 1;
    }

    if (end - start >= 6) {
      const value = text.slice(start, end);
      if (!isPlaceholder("sensitive-assignment", value)) {
        matches.push({ start, end, rule: "sensitive-assignment", category: "credential", value });
      }
    }

    pattern.lastIndex = Math.max(pattern.lastIndex, end);
  }

  return matches;
}

function isPlaceholder(ruleName, value) {
  let candidate = value.trim();
  if (ruleName === "authorization-scheme") {
    candidate = candidate.replace(/^(?:Bearer|Basic)\s+/i, "");
  }

  if (ruleName === "email-address" && /@(?:example\.(?:com|net|org)|localhost)$/i.test(candidate)) {
    return true;
  }

  return /^(?:x{3,}|\*{3,}|<[^>]+>|\{\{?[^}]+\}\}?|your(?:[_ -](?:password|passwd|secret|api[_ -]?key|access[_ -]?token|auth[_ -]?token))?(?:[_ -](?:here|value|goes|example))?|(?:example|placeholder|changeme|change_me|redacted|dummy|fake|test|none|null|undefined|insert[_ -]?here)(?:[-_][a-z0-9]+)*)$/i.test(candidate);
}

function getMatchRange(match, rule) {
  if (rule.captureName) {
    return match.indices.groups[rule.captureName];
  }
  if (rule.captureGroups) {
    for (const group of rule.captureGroups) {
      if (match.indices[group]) return match.indices[group];
    }
  }
  return match.indices[0];
}

function scanField(field, text) {
  const matches = [];
  for (const rule of RULES) {
    const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
    for (const match of text.matchAll(pattern)) {
      const [start, end] = getMatchRange(match, rule);
      const value = text.slice(start, end);
      if (!isPlaceholder(rule.name, value)) {
        matches.push({ start, end, rule: rule.name, category: rule.category, value });
      }
    }
  }
  matches.push(...collectSensitiveAssignments(text));

  matches.sort((left, right) => left.start - right.start || right.end - left.end || left.rule.localeCompare(right.rule));

  const merged = [];
  for (const match of matches) {
    const previous = merged.at(-1);
    if (!previous || match.start >= previous.end) {
      merged.push({ ...match, rules: [match.rule] });
      continue;
    }

    previous.end = Math.max(previous.end, match.end);
    previous.rules.push(match.rule);
    if (CATEGORY_PRIORITY.get(match.category) > CATEGORY_PRIORITY.get(previous.category)) {
      previous.category = match.category;
    }
    previous.value = text.slice(previous.start, previous.end);
  }

  return merged.map(({ start, end, rule, rules, category, value }) => {
    const mergedRule = [...new Set(rules)].sort().join("+") || rule;
    return {
      id: `${field}:${start}:${end}:${mergedRule}`,
      field,
      start,
      end,
      rule: mergedRule,
      category,
      value,
    };
  });
}

export function scanInputs(fields) {
  const encoder = new TextEncoder();
  const normalizedFields = Object.entries(fields ?? {}).map(([field, value]) => [field, typeof value === "string" ? value : ""]);
  let byteCount = 0;
  for (const [, value] of normalizedFields) {
    byteCount += encoder.encode(value).byteLength;
    if (byteCount > MAX_INPUT_BYTES) {
      return { ok: false, error: "input-too-large", findings: [] };
    }
  }

  const findings = [];
  for (const [field, value] of normalizedFields) {
    findings.push(...scanField(field, value));
    if (findings.length > MAX_FINDINGS) {
      return { ok: false, error: "too-many-findings", findings: [] };
    }
  }

  return { ok: true, error: null, findings };
}
