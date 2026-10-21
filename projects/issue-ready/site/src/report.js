const LABELS = {
  en: {
    summary: "Summary",
    expected: "Expected behavior",
    actual: "Actual behavior",
    steps: "Steps to reproduce",
    version: "Environment",
    logs: "Logs",
  },
  zh: {
    summary: "问题简述",
    expected: "预期结果",
    actual: "实际结果",
    steps: "复现步骤",
    version: "版本与环境",
    logs: "日志",
  },
};

const SECTION_ORDER = ["summary", "expected", "actual", "steps", "version", "logs"];
const CATEGORY_NAMES = new Set(["credential", "email", "filesystem-path"]);

function getDecision(decisions, findingId) {
  if (decisions instanceof Map) return decisions.get(findingId);
  return decisions?.[findingId];
}

function replacementFor(finding, decisions) {
  const decision = getDecision(decisions, finding.id);
  if (decision?.action === "keep") return finding.value;
  if (decision?.action === "replace" && typeof decision.replacement === "string") {
    return decision.replacement;
  }

  const category = typeof finding.category === "string" && CATEGORY_NAMES.has(finding.category)
    ? finding.category
    : "credential";
  return `[REDACTED:${category}]`;
}

function applyDecisions(source, findings, decisions) {
  const edits = findings.map((finding) => {
    if (!finding || !Number.isSafeInteger(finding.start) || !Number.isSafeInteger(finding.end)) {
      throw new TypeError("Scan results are invalid. Scan the report again.");
    }
    if (finding.start < 0 || finding.end <= finding.start || finding.end > source.length) {
      throw new TypeError("Scan results are invalid. Scan the report again.");
    }
    if (source.slice(finding.start, finding.end) !== finding.value) {
      throw new TypeError("Scan results do not match the current report content. Scan again.");
    }

    return {
      start: finding.start,
      end: finding.end,
      replacement: replacementFor(finding, decisions),
    };
  }).sort((left, right) => right.start - left.start || right.end - left.end);

  let output = source;
  let lastStart = source.length + 1;
  for (const edit of edits) {
    if (edit.end > lastStart) {
      throw new RangeError("Scan findings overlap. Scan the report again.");
    }
    output = `${output.slice(0, edit.start)}${edit.replacement}${output.slice(edit.end)}`;
    lastStart = edit.start;
  }
  return output;
}

function formatTitle(value) {
  return value
    .trim()
    .replace(/[\r\n]+/g, " ")
    .replace(/[\\`*_{}\[\]()#+\-.!|<>]/g, "\\$&");
}

function fenceFor(value) {
  let longest = 0;
  for (const match of value.matchAll(/`+/g)) {
    longest = Math.max(longest, match[0].length);
  }
  return "`".repeat(Math.max(3, longest + 1));
}

function sectionValue(fields, key, findings, decisions) {
  const source = typeof fields[key] === "string" ? fields[key] : "";
  return applyDecisions(source, findings.filter((finding) => finding?.field === key), decisions);
}

export function buildReport(fields = {}, findings = [], decisions = {}, language = "en") {
  const normalizedFields = fields && typeof fields === "object" ? fields : {};
  const normalizedFindings = Array.isArray(findings) ? findings : [];
  const locale = typeof language === "string" ? language.toLowerCase() : "en";
  const labels = locale.startsWith("zh") ? LABELS.zh : LABELS.en;
  const titleSource = typeof normalizedFields.title === "string" ? normalizedFields.title : "";
  const title = applyDecisions(
    titleSource,
    normalizedFindings.filter((finding) => finding?.field === "title"),
    decisions,
  );
  if (!title.trim()) throw new TypeError("A report title is required.");

  const blocks = [`# ${formatTitle(title)}`];
  for (const key of SECTION_ORDER) {
    const value = sectionValue(normalizedFields, key, normalizedFindings, decisions);
    if (!value.trim()) continue;

    if (key === "logs") {
      const fence = fenceFor(value);
      const body = value.endsWith("\n") ? value : `${value}\n`;
      blocks.push(`## ${labels.logs}\n\n${fence}text\n${body}${fence}`);
    } else {
      blocks.push(`## ${labels[key]}\n\n${value}`);
    }
  }

  return `${blocks.join("\n\n")}\n`;
}
