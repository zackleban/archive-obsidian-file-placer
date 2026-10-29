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

- Enable with Files open, closed, and deferred; confirm the explorer still works when disabled.
- Place files before/after another item, into an expanded/collapsed folder, and at the vault root. Reload and check persistence.
- Try a name conflict, a folder dragged into itself, and a multiple-file drag. Nothing should be overwritten.
- Merge two test notes with YAML, fenced code, repeated lines, and links. Inspect both `.md.txt` snapshots, the merged target, and archived source. Check restoration.
- Use a detached explorer window and test dragging, drag cancellation, and changing windows.
- Enable Pinit in both plugin-load orders. Top/bottom pins must remain pinned; disabling either plugin must leave the other working.
- On mobile, verify loading, settings, and saved ordering; touch-only dragging is not advertised.
