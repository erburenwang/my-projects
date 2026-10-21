# IssueReady manual browser QA

## Acceptance checklist

- [ ] Empty or whitespace-only title prevents scanning and exposes a useful validation message.
- [ ] A report with representative notes, a credential-shaped string, an email, and a home-directory path scans without sending content off-device.
- [ ] Every finding starts redacted; keeping and replacing a finding changes only the preview.
- [ ] Editing any field after scanning marks the preview stale and requires a new scan.
- [ ] English and Simplified Chinese labels work without discarding review decisions.
- [ ] Copy and `.md` download each contain the current preview.
- [ ] Clear requires confirmation; accepting clears the form, and canceling preserves it.
- [ ] Refresh removes the draft; no browser storage contains report data.
- [ ] Keyboard-only use can complete the form, scan, review, and activate sharing controls.
- [ ] At 375, 768, 1024, and 1440 CSS pixels, the page has no horizontal overflow and controls remain usable.
- [ ] Light theme and reduced-motion preference remain readable and usable.
- [ ] Runtime requests stay same-origin; no external script, font, analytics, or upload request is made.

## Local verification — 2026-10-21

- Passed composer and review flows at 375, 768, 1024, and 1440 px; review uses one column at tablet width and two columns on wide screens.
- Passed empty-title validation, default redaction, keep/replace decisions, English/Chinese switching, edit-and-rescan, clear cancel/confirm, refresh reset, and keyboard-only submission with test data.
- Confirmed only same-origin app assets were requested and the app contains no upload or browser-persistence API.
- Checked dark/light contrast thresholds in the project test suite and inspected the light, reduced-motion state.
- axe 4.12.1 reported zero violations; its only incomplete check was contrast on two decorative, `aria-hidden` glyphs.
- The copy action returned its success status with dummy text; clipboard contents were not read back. Report formatting is covered by unit tests.
- The isolated Chrome for Testing profile used for this run rejected downloads for both the app's Blob URL and an ordinary local static-file link. File completion could not be verified in that browser profile; verify a downloaded `.md` file in a regular browser as part of release QA.

This record does not imply that the heuristic scanner finds every secret or that a report is safe to share. Review the complete Markdown output.
