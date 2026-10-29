# Local review checklist

Prepared on 2026-10-28. Nothing was submitted, tagged, pushed, or released.

## Automated checks

Run `npm ci`, then `npm run qa` from this repository. QA runs the official Obsidian ESLint recommendations with zero warnings, regression tests, the TypeScript/production build, and metadata/artifact validation. The optional recommendation to adopt the newer declarative settings API is disabled to retain Obsidian 1.7.2 compatibility; imperative settings remain supported there.

The tracked `main.js`, `manifest.json`, and `styles.css` are the local installation files. The build embeds bundled dependency licenses. `versions.json` preserves prior entries and records this candidate's minimum app version.

## Before a later submission

Perform the real-app checks below in a disposable vault on the declared minimum version and the current stable version. Automated host mocks cannot verify Obsidian's private explorer/graph implementation or physical input devices. Then, when separately authorized, publish a GitHub release whose tag exactly matches `manifest.json` (no `v` prefix), attach the three installation files, and use the official submission workflow. Directory name/ID availability and the hosted review are checked at that time. No release or submission was part of this work.

References checked:

- [Manifest](https://docs.obsidian.md/Reference/Manifest)
- [Submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
- [Developer policies](https://docs.obsidian.md/community-directory/developer-policies)
- [Official local lint rules](https://github.com/obsidianmd/eslint-plugin)
- [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin)

## Real-app smoke checks still to run

Shared sorting evidence and resumption steps: [RUNTIME-SORTING.md](RUNTIME-SORTING.md).
The 2026-10-28 live attempt is **blocked**, not passed: installed bundle metadata
reports 1.14.5, but app launch/control was unavailable. Every live item below stays
open, including minimum-version and mobile coverage.

- Enable with Files open, closed, and deferred; confirm the explorer still works when disabled.
- Place files before/after another item, into an expanded/collapsed folder, and at the vault root. Reload and check persistence.
- Try a name conflict, a folder dragged into itself, and a multiple-file drag. Nothing should be overwritten.
- Merge two test notes with YAML, fenced code, repeated lines, and links. Inspect both `.md.txt` snapshots, the merged target, and archived source. Check restoration.
- Use a detached explorer window and test dragging, drag cancellation, and changing windows.
- Enable Pinit in both plugin-load orders. Top/bottom pins must remain pinned; disabling either plugin must leave the other working.
- On mobile, verify loading, settings, and saved ordering; touch-only dragging is not advertised.

## Review — 2026-10-28

Agent decision, 2026-10-28: review the seven completed local preparations before adding features, because their shared explorer behavior and remaining host checks need validation.

Fresh `npm run qa` passed: 14 tests, TypeScript, production build, and package checks. Fixed a reproduced interaction failure: File Placer kept applying saved Pinit pins during Pinit teardown while its registry entry remained. Pinit now exposes active pins, and File Placer uses that state. Both updated local candidates are needed for the fix. `npm run test:integration` additionally passes four cases against the actual sibling Pinit source: both load orders, disabling either plugin, re-enabling it, and restoring ordinary order after both unload. Two of these cases failed before the fix. The suite lives only in this repository; standalone QA does not require Pinit.

This is automated local evidence, not a live Obsidian or minimum-version certification. The real-app checklist above remains open. Nothing was installed into the personal vault, pushed, released, or submitted.

## Runtime follow-up — 2026-10-28

Fresh `npm run qa` (14 tests) and `npm run test:integration` (four host-double
cases) pass; rebuilding leaves tracked assets unchanged. No runtime defect was
reproduced and no implementation changed. See the shared record above for exact
access failures and all still-blocked desktop scenarios. This follow-up does not
complete the live sorting deliverable.
