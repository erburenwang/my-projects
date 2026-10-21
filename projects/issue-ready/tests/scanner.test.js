import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scannerUrl = new URL("../site/src/scanner.js", import.meta.url);
let scanInputs;
if (existsSync(fileURLToPath(scannerUrl))) {
  ({ scanInputs } = await import(scannerUrl.href));
}

if (typeof scanInputs !== "function") {
  test("scanner exports scanInputs", () => {
    assert.equal(typeof scanInputs, "function");
  });
} else {
  function findingsFor(field, value) {
    const result = scanInputs({ [field]: value });
    assert.equal(result.ok, true);
    assert.equal(result.error, null);
    return result.findings;
  }

  test("finds Bearer and Basic authorization credentials", () => {
    const bearer = "Bearer abcdefghijk_1234567890";
    const basic = "Basic dXNlcjpwYXNzd29yZA==";
    const found = findingsFor("logs", `Authorization: ${bearer}\nAuthorization: ${basic}`);
    assert.deepEqual(found.map((item) => item.value), [bearer, basic]);
    assert.ok(found.every((item) => item.category === "credential"));
  });

  test("finds common provider token prefixes", () => {
    const github = `ghp_${"A".repeat(32)}`;
    const slack = `xoxb-${"A".repeat(24)}`;
    const openAiStyle = `sk-${"A".repeat(32)}`;
    const found = findingsFor("logs", `${github} ${slack} ${openAiStyle}`);
    assert.deepEqual(found.map((item) => item.value), [github, slack, openAiStyle]);
  });

  test("finds values assigned to sensitive names without including quotes", () => {
    const source = 'password="hunter2secret" API_KEY=real-secret-777';
    const found = findingsFor("config", source);
    assert.deepEqual(found.map((item) => item.value), ["hunter2secret", "real-secret-777"]);
    assert.ok(found.every((item) => source.slice(item.start, item.end) === item.value));
  });

  test("finds JSON web tokens and PEM private-key blocks", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123xyz";
    const pem = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----";
    const found = findingsFor("logs", `${jwt}\n${pem}`);
    assert.deepEqual(found.map((item) => item.value), [jwt, pem]);
  });

  test("finds email addresses and Windows, macOS, and Linux home paths", () => {
    const source = "alice.chen@work.example C:\\Users\\Alice\\AppData\\app.log /Users/alice/Library/app.log /home/alice/.config/app";
    const found = findingsFor("logs", source);
    assert.deepEqual(found.map((item) => item.value), [
      "alice.chen@work.example",
      "C:\\Users\\Alice\\AppData\\app.log",
      "/Users/alice/Library/app.log",
      "/home/alice/.config/app",
    ]);
    assert.deepEqual(found.map((item) => item.category), [
      "email",
      "filesystem-path",
      "filesystem-path",
      "filesystem-path",
    ]);
  });

  test("does not flag ordinary prose, example placeholders, or empty secret values", () => {
    const source = [
      "The word secret appears in this explanation.",
      'password="your_password_here"',
      "Authorization: Bearer placeholder",
      "api_key=",
      "person@example.com",
    ].join("\n");
    assert.deepEqual(findingsFor("logs", source), []);
  });

  test("merges overlapping rules into one exact source range", () => {
    const token = `ghp_${"B".repeat(32)}`;
    const source = `Authorization: Bearer ${token}`;
    const found = findingsFor("logs", source);
    assert.equal(found.length, 1);
    assert.equal(source.slice(found[0].start, found[0].end), found[0].value);
    assert.equal(found[0].value, `Bearer ${token}`);
  });

  test("uses UTF-16 offsets after non-BMP characters", () => {
    const source = `🙂 before ghp_${"C".repeat(32)} after`;
    const [found] = findingsFor("logs", source);
    assert.equal(source.slice(found.start, found.end), found.value);
    assert.equal(found.start, source.indexOf("ghp_"));
  });

  test("accepts exactly 2 MiB of input and rejects larger input without partial findings", () => {
    const max = "a".repeat(2 * 1024 * 1024);
    const atLimit = scanInputs({ logs: max });
    assert.equal(atLimit.ok, true);
    assert.deepEqual(atLimit.findings, []);

    const overLimit = scanInputs({ logs: `${max}a` });
    assert.deepEqual(overLimit, { ok: false, error: "input-too-large", findings: [] });
  });

  test("accepts 500 findings and rejects the 501st without partial results", () => {
    const withinLimit = scanInputs({ logs: Array(500).fill("alice@work.example").join(" ") });
    assert.equal(withinLimit.ok, true);
    assert.equal(withinLimit.findings.length, 500);

    const overLimit = scanInputs({ logs: Array(501).fill("alice@work.example").join(" ") });
    assert.deepEqual(overLimit, { ok: false, error: "too-many-findings", findings: [] });
  });

  test("returns findings in field order with stable IDs", () => {
    const fields = { title: "alice@work.example", logs: "bob@work.example" };
    const first = scanInputs(fields);
    const second = scanInputs(fields);
    assert.deepEqual(first.findings.map(({ field }) => field), ["title", "logs"]);
    assert.deepEqual(first.findings.map(({ id }) => id), second.findings.map(({ id }) => id));
  });
}
