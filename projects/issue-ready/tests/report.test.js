import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const reportUrl = new URL("../site/src/report.js", import.meta.url);
let buildReport;
if (existsSync(fileURLToPath(reportUrl))) {
  ({ buildReport } = await import(reportUrl.href));
}

if (typeof buildReport !== "function") {
  test("report module exports buildReport", () => {
    assert.equal(typeof buildReport, "function");
  });
} else {
  function makeFinding(field, source, needle, id, category = "credential") {
    const start = source.indexOf(needle);
    assert.notEqual(start, -1);
    return { id, field, start, end: start + needle.length, rule: "test", category, value: needle };
  }

  test("report: starts with the required title heading", () => {
    const report = buildReport({ title: "Crash on startup" }, [], {}, "en");
    assert.ok(report.startsWith("# Crash on startup\n"));
  });

  test("report: omits empty optional sections", () => {
    const report = buildReport({
      title: "Crash on startup",
      summary: "  ",
      expected: "",
      actual: "The app exits.",
      steps: "\n",
      version: "",
      logs: "",
    }, [], {}, "en");
    assert.match(report, /## Actual behavior/);
    for (const heading of ["## Summary", "## Expected behavior", "## Steps to reproduce", "## Environment", "## Logs"]) {
      assert.ok(!report.includes(heading), `unexpected empty section: ${heading}`);
    }
  });

  test("report: uses English and Simplified Chinese field labels", () => {
    const fields = { title: "Network error", summary: "Fails offline", expected: "It works", actual: "It stops" };
    const english = buildReport(fields, [], {}, "en");
    const chinese = buildReport(fields, [], {}, "zh-CN");
    assert.match(english, /## Summary/);
    assert.match(english, /## Expected behavior/);
    assert.match(chinese, /## 问题简述/);
    assert.match(chinese, /## 预期结果/);
  });

  test("report: redacts by default and honors keep and replace decisions", () => {
    const source = "password=keep-this-secret api_key=replace-this-secret email=alice@example.org";
    const fields = { title: "Credential report", logs: source };
    const findings = [
      makeFinding("logs", source, "keep-this-secret", "keep"),
      makeFinding("logs", source, "replace-this-secret", "replace"),
      makeFinding("logs", source, "alice@example.org", "redact", "email"),
    ];
    const report = buildReport(fields, findings, {
      keep: { action: "keep" },
      replace: { action: "replace", replacement: "[REMOVED BY REPORTER]" },
    }, "en");

    assert.ok(report.includes("keep-this-secret"));
    assert.ok(report.includes("[REMOVED BY REPORTER]"));
    assert.ok(report.includes("[REDACTED:email]"));
    assert.ok(!report.includes("replace-this-secret"));
    assert.ok(!report.includes("alice@example.org"));
  });

  test("report: redacts findings in the title as well as body fields", () => {
    const title = `Crash from ghp_${"D".repeat(32)}`;
    const finding = makeFinding("title", title, `ghp_${"D".repeat(32)}`, "title-token");
    const report = buildReport({ title }, [finding], {}, "en");
    assert.ok(report.startsWith("# Crash from \\[REDACTED:credential\\]\n"));
    assert.ok(!report.includes("ghp_"));
  });

  test("report: applies multiple edits without shifting later ranges", () => {
    const source = "first-secret then second-secret";
    const findings = [
      makeFinding("logs", source, "first-secret", "first"),
      makeFinding("logs", source, "second-secret", "second"),
    ];
    const report = buildReport({ title: "Range test", logs: source }, findings, {}, "en");
    assert.ok(report.includes("[REDACTED:credential] then [REDACTED:credential]"));
    assert.ok(!report.includes("first-secret"));
    assert.ok(!report.includes("second-secret"));
  });

  test("report: does not mutate fields, findings, or decisions", () => {
    const source = "token-to-hide";
    const fields = Object.freeze({ title: "Immutability", logs: source });
    const finding = Object.freeze(makeFinding("logs", source, source, "immutable"));
    const findings = Object.freeze([finding]);
    const decisions = Object.freeze({ immutable: Object.freeze({ action: "replace", replacement: "safe" }) });
    const before = { fields: structuredClone(fields), findings: structuredClone(findings), decisions: structuredClone(decisions) };

    buildReport(fields, findings, decisions, "en");

    assert.deepEqual({ fields, findings, decisions }, before);
  });

  test("report: uses a log fence longer than every backtick run", () => {
    const logs = "first line\n```` a user supplied four-backtick run\nlast line";
    const report = buildReport({ title: "Fence test", logs }, [], {}, "en");
    assert.ok(report.includes("`````text\n"));
    assert.ok(report.includes("\n`````\n"));
  });

  test("report: keeps multiline titles on one heading line", () => {
    const report = buildReport({ title: "Crash\n## injected section" }, [], {}, "en");
    assert.ok(report.startsWith("# Crash \\#\\# injected section\n"));
    assert.equal((report.match(/^## /gm) ?? []).length, 0);
  });

  test("report: rejects stale scan ranges instead of leaving changed text unreviewed", () => {
    const stale = { id: "stale", field: "logs", start: 0, end: 12, rule: "test", category: "credential", value: "old-secret!" };
    assert.throws(
      () => buildReport({ title: "Stale scan", logs: "new-secret!!" }, [stale], {}, "en"),
      /scan results/i,
    );
  });

  test("report: rejects overlapping findings rather than silently skipping one", () => {
    const source = "first-secret second-secret";
    const first = makeFinding("logs", source, "first-secret", "first");
    const second = makeFinding("logs", source, "second-secret", "second");
    second.start = first.start + 4;
    second.end = first.end + 8;
    second.value = source.slice(second.start, second.end);
    assert.throws(
      () => buildReport({ title: "Overlap", logs: source }, [first, second], {}, "en"),
      /overlap/i,
    );
  });
}
