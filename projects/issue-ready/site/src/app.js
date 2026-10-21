import { isReviewCurrent, isTitleValid } from "./app-state.js";
import { scanInputs } from "./scanner.js";
import { buildReport } from "./report.js";

const FIELD_IDS = ["title", "summary", "version", "steps", "expected", "actual", "logs"];
const FIELD_LABEL_KEYS = {
  title: "titleLabel",
  summary: "summaryLabel",
  version: "versionLabel",
  steps: "stepsLabel",
  expected: "expectedLabel",
  actual: "actualLabel",
  logs: "logsLabel",
};

const COPY = {
  en: {
    languageLabel: "Language",
    english: "English",
    chinese: "简体中文",
    eyebrow: "BUG REPORT / LOCAL ONLY",
    pageTitle: "Help maintainers reproduce your bug.",
    pageLead: "Turn the details you already have into a clear report, then review likely sensitive text before you share it.",
    privacyTitle: "Your report stays in this tab.",
    privacyCopy: "Nothing is uploaded. Refreshing the page clears your draft.",
    stepCompose: "Write the report",
    stepReview: "Review and share",
    initialStatus: "A quick scan can miss things. Review the complete report before sharing.",
    sectionOne: "01 / DETAILS",
    composeHeading: "Describe what happened",
    composeNote: "A useful report gives maintainers a way to see the same problem.",
    titleLabel: "Issue title",
    required: "Required",
    optional: "Optional",
    titleHint: "Keep it specific, such as “App closes after importing a CSV”.",
    titleError: "Add a title before continuing.",
    summaryLabel: "What went wrong?",
    summaryPlaceholder: "A short description helps maintainers understand the impact.",
    versionLabel: "Version and environment",
    versionPlaceholder: "App version, operating system, browser, runtime…",
    stepsLabel: "Steps to reproduce",
    stepsPlaceholder: "1. Open…\n2. Choose…\n3. Notice…",
    expectedLabel: "Expected result",
    expectedPlaceholder: "What did you expect to happen?",
    actualLabel: "Actual result",
    actualPlaceholder: "What happened instead? Include any visible error.",
    logsLabel: "Relevant logs",
    logsPlaceholder: "Paste only the lines that help explain the problem.",
    logsHint: "The scanner checks common patterns. It cannot guarantee that every secret is found.",
    scanButton: "Check and preview",
    clearButton: "Clear draft",
    manualNote: "You decide what to copy or download.",
    sectionTwo: "02 / REVIEW",
    reviewHeading: "Review before sharing",
    reviewNote: "Every possible match starts redacted. Check the final Markdown yourself.",
    staleTitle: "The report changed after its scan.",
    staleCopy: "Run the scan again before copying or downloading.",
    findingsHeading: "Possible sensitive text",
    localChip: "LOCAL",
    previewHeading: "Markdown preview",
    previewNote: "This is the exact text your buttons will share.",
    copyButton: "Copy",
    downloadButton: "Download .md",
    reviewReminder: "Detection is best-effort. Check the complete preview, including anything the scanner did not flag.",
    backButton: "Back to edit",
    rescanButton: "Scan again",
    footerNote: "Built for careful bug reports. No accounts, uploads, or telemetry.",
    previewLabel: "Generated Markdown report preview",
    titleRequiredStatus: "Add a title before scanning the report.",
    sizeError: "This report is over 2 MiB. Shorten the text or remove unrelated log lines, then scan again.",
    findingLimitError: "This report has over 500 possible matches. Narrow the text and scan again.",
    scanFailed: "The report could not be scanned. Your draft is still here; try shortening it.",
    findingCount: (count) => `${count} possible match${count === 1 ? "" : "es"}. Review each choice before sharing.`,
    noFindingsTitle: "No common patterns found.",
    noFindingsCopy: "That does not guarantee the report is safe. Read every line before sharing.",
    fieldLabel: (field) => field,
    categoryCredential: "Credential",
    categoryEmail: "Email address",
    categoryPath: "User home path",
    matchCaption: "Matched text (shown only in this tab)",
    redactChoice: "Redact this text",
    keepChoice: "Keep original text",
    replaceChoice: "Use a custom replacement",
    replacementLabel: "Replacement text",
    clearConfirm: "Clear this draft from the page? This cannot be undone.",
    draftCleared: "Draft cleared. Nothing was saved.",
    scanCountStatus: (count) => count ? `Scan complete. ${count} possible match${count === 1 ? "" : "es"} need your review.` : "Scan complete. No common patterns were found; review the entire report anyway.",
    clipboardSuccess: "Markdown copied after your request.",
    clipboardUnavailable: "Clipboard access is unavailable here. Select the preview and copy it manually.",
    clipboardFailed: "The browser could not copy the report. Select the preview and copy it manually.",
    downloadStarted: "Your Markdown download has started.",
    reportStaleStatus: "The report changed. Scan again before sharing.",
    reportError: "The preview could not be refreshed. Scan the report again before sharing.",
  },
  zh: {
    languageLabel: "语言",
    english: "English",
    chinese: "简体中文",
    eyebrow: "问题报告 / 仅本机处理",
    pageTitle: "帮维护者复现你遇到的问题。",
    pageLead: "把已有信息整理成清晰的报告，再检查可能包含敏感内容的文本。",
    privacyTitle: "报告只留在当前标签页。",
    privacyCopy: "内容不会上传。刷新页面会清空草稿。",
    stepCompose: "填写报告",
    stepReview: "检查并分享",
    initialStatus: "扫描可能漏掉内容。分享前请检查完整报告。",
    sectionOne: "01 / 问题详情",
    composeHeading: "描述发生了什么",
    composeNote: "清晰的报告能帮助维护者重现同一个问题。",
    titleLabel: "问题标题",
    required: "必填",
    optional: "选填",
    titleHint: "尽量具体，例如“导入 CSV 后应用自动关闭”。",
    titleError: "请先填写标题。",
    summaryLabel: "遇到了什么问题？",
    summaryPlaceholder: "简要描述问题，帮助维护者了解影响。",
    versionLabel: "版本与运行环境",
    versionPlaceholder: "应用版本、操作系统、浏览器、运行时……",
    stepsLabel: "复现步骤",
    stepsPlaceholder: "1. 打开……\n2. 选择……\n3. 观察……",
    expectedLabel: "预期结果",
    expectedPlaceholder: "你原本希望发生什么？",
    actualLabel: "实际结果",
    actualPlaceholder: "实际发生了什么？可以写出界面显示的错误。",
    logsLabel: "相关日志",
    logsPlaceholder: "只粘贴有助于说明问题的日志行。",
    logsHint: "扫描只检查常见格式，不能保证发现所有密钥。",
    scanButton: "检查并预览",
    clearButton: "清空草稿",
    manualNote: "复制或下载由你决定。",
    sectionTwo: "02 / 检查报告",
    reviewHeading: "分享前先检查",
    reviewNote: "可能的命中项默认遮盖。请自行检查最终 Markdown。",
    staleTitle: "扫描后报告内容发生了变化。",
    staleCopy: "请重新扫描，再复制或下载。",
    findingsHeading: "可能的敏感内容",
    localChip: "本机",
    previewHeading: "Markdown 预览",
    previewNote: "下方内容就是按钮将复制或下载的文本。",
    copyButton: "复制",
    downloadButton: "下载 .md",
    reviewReminder: "扫描只能尽力发现常见内容。请检查完整预览，包括未被标记的部分。",
    backButton: "返回修改",
    rescanButton: "重新扫描",
    footerNote: "为认真撰写问题报告而做。无需账号，不上传，不收集遥测。",
    previewLabel: "生成的 Markdown 报告预览",
    titleRequiredStatus: "请先填写标题，再扫描报告。",
    sizeError: "报告超过 2 MiB。请缩短文本或删除无关日志后再扫描。",
    findingLimitError: "报告中可能的命中项超过 500 个。请缩小范围后再扫描。",
    scanFailed: "无法扫描报告。草稿仍在页面中，请尝试缩短内容。",
    findingCount: (count) => `发现 ${count} 个可能的命中项。分享前请逐项检查。`,
    noFindingsTitle: "没有发现常见格式。",
    noFindingsCopy: "这不代表报告一定安全。分享前请逐行检查。",
    fieldLabel: (field) => field,
    categoryCredential: "凭据或密钥",
    categoryEmail: "电子邮箱",
    categoryPath: "用户目录路径",
    matchCaption: "命中的文本（仅在当前标签页显示）",
    redactChoice: "遮盖这段文本",
    keepChoice: "保留原文",
    replaceChoice: "使用自定义替换文本",
    replacementLabel: "替换文本",
    clearConfirm: "确定从页面清空这份草稿吗？清空后无法撤销。",
    draftCleared: "草稿已清空，没有保存到任何位置。",
    scanCountStatus: (count) => count ? `扫描完成。有 ${count} 个可能的命中项需要你检查。` : "扫描完成。未发现常见格式，仍请检查完整报告。",
    clipboardSuccess: "已按你的操作复制 Markdown。",
    clipboardUnavailable: "当前环境无法访问剪贴板。请选中预览内容并手动复制。",
    clipboardFailed: "浏览器无法复制报告。请选中预览内容并手动复制。",
    downloadStarted: "Markdown 文件已开始下载。",
    reportStaleStatus: "报告内容发生变化。分享前请重新扫描。",
    reportError: "无法更新预览。请重新扫描报告后再分享。",
  },
};

const element = (id) => document.getElementById(id);
const elements = {
  form: element("report-form"),
  title: element("title"),
  titleError: element("title-error"),
  language: element("language"),
  status: element("status"),
  composePanel: element("compose-panel"),
  reviewPanel: element("review-panel"),
  stepCompose: element("step-compose"),
  stepReview: element("step-review"),
  findingSummary: element("finding-summary"),
  findingList: element("finding-list"),
  reviewContent: element("review-content"),
  staleNotice: element("stale-notice"),
  preview: element("preview"),
  copyButton: element("copy-button"),
  downloadButton: element("download-button"),
  clearButton: element("clear-button"),
  backButton: element("back-button"),
  rescanButton: element("rescan-button"),
};

let language = navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
let findings = [];
let decisions = Object.create(null);
let reviewedFields = null;
let reportText = "";

function copy() {
  return language.toLowerCase().startsWith("zh") ? COPY.zh : COPY.en;
}

function currentFields() {
  return Object.fromEntries(FIELD_IDS.map((id) => [id, element(id).value]));
}

function setStatus(message, tone = "") {
  elements.status.textContent = message;
  elements.status.classList.remove("is-error", "is-success");
  if (tone) elements.status.classList.add(`is-${tone}`);
}

function applyLanguage() {
  const text = copy();
  document.documentElement.lang = language === "zh-CN" ? "zh-CN" : "en";
  elements.language.value = language;
  for (const node of document.querySelectorAll("[data-i18n]")) {
    const key = node.dataset.i18n;
    if (typeof text[key] === "string") node.textContent = text[key];
  }
  for (const node of document.querySelectorAll("[data-i18n-placeholder]")) {
    const key = node.dataset.i18nPlaceholder;
    if (typeof text[key] === "string") node.setAttribute("placeholder", text[key]);
  }
  elements.preview.setAttribute("aria-label", text.previewLabel);
  if (!elements.reviewPanel.hidden) renderReview();
}

function fieldLabel(field) {
  const key = FIELD_LABEL_KEYS[field];
  const text = copy();
  return key ? text[key] : field;
}

function categoryLabel(category) {
  const text = copy();
  if (category === "email") return text.categoryEmail;
  if (category === "filesystem-path") return text.categoryPath;
  return text.categoryCredential;
}

function showTitleError(show) {
  elements.titleError.hidden = !show;
  elements.title.setAttribute("aria-invalid", show ? "true" : "false");
}

function markActiveStep(step) {
  elements.stepCompose.classList.toggle("is-active", step === "compose");
  elements.stepReview.classList.toggle("is-active", step === "review");
  elements.stepCompose.setAttribute("aria-current", step === "compose" ? "step" : "false");
  elements.stepReview.setAttribute("aria-current", step === "review" ? "step" : "false");
}

function makeChoice(finding, index, action, label, replacementInput) {
  const choiceLabel = document.createElement("label");
  choiceLabel.className = "decision-label";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = `finding-${index}`;
  input.value = action;
  input.checked = decisions[finding.id]?.action === action;
  const choiceText = document.createElement("span");
  choiceText.textContent = label;
  choiceLabel.append(input, choiceText);

  input.addEventListener("change", () => {
    decisions[finding.id] = action === "replace"
      ? { action, replacement: replacementInput.value }
      : { action };
    replacementInput.disabled = action !== "replace";
    refreshPreview();
  });
  return choiceLabel;
}

function createFindingCard(finding, index) {
  const text = copy();
  const card = document.createElement("fieldset");
  card.className = "finding-card";
  const legend = document.createElement("legend");
  legend.textContent = `${categoryLabel(finding.category)} · ${fieldLabel(finding.field)}`;

  const caption = document.createElement("p");
  caption.className = "match-caption";
  caption.textContent = text.matchCaption;
  const value = document.createElement("code");
  value.className = "match-value";
  value.textContent = finding.value;

  const choices = document.createElement("div");
  choices.className = "decision-options";
  const replacementLabel = document.createElement("label");
  const replacementId = `replacement-${index}`;
  replacementLabel.className = "replacement-label";
  replacementLabel.htmlFor = replacementId;
  replacementLabel.textContent = text.replacementLabel;
  const replacementInput = document.createElement("input");
  replacementInput.className = "replacement-input";
  replacementInput.type = "text";
  replacementInput.id = replacementId;
  replacementInput.disabled = decisions[finding.id]?.action !== "replace";
  replacementInput.value = decisions[finding.id]?.replacement ?? "";
  replacementInput.spellcheck = false;
  replacementInput.addEventListener("input", () => {
    if (decisions[finding.id]?.action === "replace") {
      decisions[finding.id] = { action: "replace", replacement: replacementInput.value };
      refreshPreview();
    }
  });

  choices.append(
    makeChoice(finding, index, "redact", text.redactChoice, replacementInput),
    makeChoice(finding, index, "keep", text.keepChoice, replacementInput),
    makeChoice(finding, index, "replace", text.replaceChoice, replacementInput),
    replacementLabel,
    replacementInput,
  );
  card.append(legend, caption, value, choices);
  return card;
}

function renderFindings() {
  const text = copy();
  elements.findingList.replaceChildren();
  if (findings.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-findings";
    const title = document.createElement("strong");
    title.textContent = text.noFindingsTitle;
    const note = document.createElement("span");
    note.textContent = text.noFindingsCopy;
    empty.append(title, note);
    elements.findingList.append(empty);
  } else {
    findings.forEach((finding, index) => elements.findingList.append(createFindingCard(finding, index)));
  }
  elements.findingSummary.textContent = text.findingCount(findings.length);
}

function previewIsCurrent() {
  return reviewedFields !== null && isReviewCurrent(currentFields(), reviewedFields);
}

function setExportEnabled(enabled) {
  elements.copyButton.disabled = !enabled;
  elements.downloadButton.disabled = !enabled;
}

function renderReview() {
  if (!previewIsCurrent()) {
    elements.staleNotice.hidden = false;
    elements.reviewContent.hidden = true;
    elements.preview.textContent = copy().reportStaleStatus;
    reportText = "";
    setExportEnabled(false);
    return;
  }

  elements.staleNotice.hidden = true;
  elements.reviewContent.hidden = false;
  renderFindings();
  refreshPreview();
}

function refreshPreview() {
  if (!previewIsCurrent()) {
    if (!elements.reviewPanel.hidden) renderReview();
    return false;
  }

  try {
    reportText = buildReport(currentFields(), findings, decisions, language);
    elements.preview.textContent = reportText;
    setExportEnabled(true);
    return true;
  } catch {
    reportText = "";
    elements.preview.textContent = copy().reportError;
    setExportEnabled(false);
    return false;
  }
}

function scanReport() {
  const text = copy();
  const fields = currentFields();
  showTitleError(!isTitleValid(fields.title));
  if (!isTitleValid(fields.title)) {
    setStatus(text.titleRequiredStatus, "error");
    elements.title.focus();
    return false;
  }

  const result = scanInputs(fields);
  if (!result.ok) {
    reviewedFields = null;
    findings = [];
    decisions = Object.create(null);
    if (result.error === "input-too-large") setStatus(text.sizeError, "error");
    else if (result.error === "too-many-findings") setStatus(text.findingLimitError, "error");
    else setStatus(text.scanFailed, "error");
    return false;
  }

  findings = result.findings;
  decisions = Object.create(null);
  for (const finding of findings) decisions[finding.id] = { action: "redact" };
  reviewedFields = { ...fields };
  elements.composePanel.hidden = true;
  elements.reviewPanel.hidden = false;
  markActiveStep("review");
  renderReview();
  setStatus(text.scanCountStatus(findings.length), "success");
  elements.reviewPanel.scrollIntoView({ block: "start", behavior: "smooth" });
  return true;
}

function showComposer() {
  elements.reviewPanel.hidden = true;
  elements.composePanel.hidden = false;
  markActiveStep("compose");
  elements.title.focus();
}

function clearDraft() {
  const text = copy();
  const hasDraft = Object.values(currentFields()).some((value) => value.length > 0);
  if (hasDraft && !window.confirm(text.clearConfirm)) return;

  elements.form.reset();
  findings = [];
  decisions = Object.create(null);
  reviewedFields = null;
  reportText = "";
  showTitleError(false);
  showComposer();
  setStatus(text.draftCleared, "success");
}

function safeFilename(title) {
  const clean = title
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 80);
  return `${clean || "issue-report"}.md`;
}

async function copyReport() {
  if (!previewIsCurrent() || !reportText) return;
  const text = copy();
  try {
    if (!navigator.clipboard?.writeText) {
      setStatus(text.clipboardUnavailable, "error");
      return;
    }
    await navigator.clipboard.writeText(reportText);
    setStatus(text.clipboardSuccess, "success");
  } catch {
    setStatus(text.clipboardFailed, "error");
  }
}

function downloadReport() {
  if (!previewIsCurrent() || !reportText) return;
  const blob = new Blob([reportText], { type: "text/markdown;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = safeFilename(currentFields().title);
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  setStatus(copy().downloadStarted, "success");
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  scanReport();
});
elements.form.addEventListener("input", (event) => {
  if (event.target === elements.title && isTitleValid(elements.title.value)) showTitleError(false);
  if (!elements.reviewPanel.hidden) {
    renderReview();
    if (!previewIsCurrent()) setStatus(copy().reportStaleStatus, "error");
  }
});
elements.language.addEventListener("change", () => {
  language = elements.language.value;
  applyLanguage();
});
elements.clearButton.addEventListener("click", clearDraft);
elements.backButton.addEventListener("click", showComposer);
elements.rescanButton.addEventListener("click", scanReport);
elements.copyButton.addEventListener("click", copyReport);
elements.downloadButton.addEventListener("click", downloadReport);

applyLanguage();
markActiveStep("compose");
