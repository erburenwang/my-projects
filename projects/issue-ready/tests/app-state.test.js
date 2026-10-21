import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const stateUrl = new URL("../site/src/app-state.js", import.meta.url);
let isTitleValid;
let isReviewCurrent;
if (existsSync(fileURLToPath(stateUrl))) {
  ({ isTitleValid, isReviewCurrent } = await import(stateUrl.href));
}

if (typeof isTitleValid !== "function" || typeof isReviewCurrent !== "function") {
  test("app state: exports title and review validation helpers", () => {
    assert.equal(typeof isTitleValid, "function");
    assert.equal(typeof isReviewCurrent, "function");
  });
} else {
  test("app state: rejects blank titles and accepts visible text", () => {
    assert.equal(isTitleValid("   \n\t"), false);
    assert.equal(isTitleValid("Crash on startup"), true);
    assert.equal(isTitleValid("  Cache is stale  "), true);
  });

  test("app state: recognizes an unchanged field snapshot", () => {
    const fields = { title: "Bug", summary: "Short summary", logs: "last line" };
    assert.equal(isReviewCurrent(fields, { ...fields }), true);
  });

  test("app state: invalidates a scan when any field changes", () => {
    const reviewed = { title: "Bug", summary: "Short summary", logs: "last line" };
    assert.equal(isReviewCurrent({ ...reviewed, logs: "new line" }, reviewed), false);
    assert.equal(isReviewCurrent({ ...reviewed, extra: "added" }, reviewed), false);
    assert.equal(isReviewCurrent({ title: "Bug", logs: "last line" }, reviewed), false);
  });

  test("app state: treats non-string or non-record snapshots as invalid", () => {
    assert.equal(isReviewCurrent({ title: 1 }, { title: "1" }), false);
    assert.equal(isReviewCurrent(null, { title: "Bug" }), false);
    assert.equal(isReviewCurrent({ title: "Bug" }, null), false);
  });
}
