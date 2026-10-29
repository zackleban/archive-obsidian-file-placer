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

## Merge recovery follow-up — 2026-10-28

**Status: automated recovery checks pass; live recovery and link destinations are
blocked, so the deliverable is incomplete.** Computer Use `cua.getApp("Obsidian")`
again returned **“Computer Use was not approved to use Obsidian”** in this job.
No alternative app-control route was attempted after that denial. A fresh
`PlistBuddy` read of the installed bundle's `CFBundleShortVersionString` returned
**1.14.5**. This is bundle metadata, not an observed running-app version. The
declared minimum remains 1.7.2; neither version was exercised in a live merge.

Agent decision — 2026-10-28: extend only the uncovered failure stages and retain
reusable synthetic fixtures, because preservation evidence is useful even while
app access is blocked. Keep the existing merge implementation: the new cases
reproduce partial completion, but no failing preservation assertion or live
defect justified a source change. No automatic retry or rollback was added.

### Verified automated evidence

Fresh `npm run qa` exits 0: lint, **17 tests**, TypeScript, production bundle and
package checks pass. `npm run test:integration` exits 0: **four** cases pass against
the sibling Pinit checkout at `8ac0c77`. Rebuilding leaves `main.js`, `manifest.json`
and `styles.css` unchanged. Three new cases in `tests/behavior.test.mjs` cover:

| Stage | Observed in the host double |
| --- | --- |
| Second snapshot creation rejects after the first succeeds | Only the exact target snapshot exists. Both original texts and paths are unchanged. The captured Notice is `File Placer: source snapshot: disk full`; no success Notice is emitted. |
| Source archival rejects before the mocked rename mutates files, after target body and properties are written | Both snapshots are exact. Original source text/path and all other fixture files are untouched; the target contains every body line and combined properties. One rename attempt, no automatic retry. Notice: `File Placer: archive rename: permission denied`. |
| Recovery followed by a deliberate retry, after either success or the archive failure above | Move the source back if archived; replace both texts from the snapshots. Both original texts match exactly, including CRLF and absence of a final newline. Retry produces exactly the first merged text, without a duplicate section, and preserves the first snapshots while adding `... (before merge) 1.md.txt` copies. |

The tests also assert that errors reach the console boundary and the merge lock
clears. Notices are captured constructor arguments, **not observed app UI**. The
rename double has no link maintenance and fails before changing the source; this
does not prove the outcome of a real rename that changes files and then rejects.
The fixtures use JSON flow mappings (valid YAML), and the existing test double
parses JSON and simulates the frontmatter callback. Real YAML serialization and
Obsidian's resolver remain untested here. Link strings remain literal in the
mocked merged body; no destination is inferred from that assertion.

### Reusable fixture and comparison evidence

The single fixture source is [tests/fixtures/merge-recovery.mjs](../tests/fixtures/merge-recovery.mjs).
It includes different source/target folders, conflicting YAML properties, nested
fences, repeated lines, CRLF source text, a target with no final newline, relative
Markdown links and SVG embeds, a self-heading link, and inbound Markdown/wikilinks.
Same-named peers and generated SVGs contain distinct SOURCE/TARGET markers, making
a wrong but existing destination distinguishable from a broken link.

[tests/recovery-drill.mjs](../tests/recovery-drill.mjs) only prepares files or compares
bytes. It never drives the app, merges, restores, enables a plugin, or sets a link
preference. Preparation refuses an existing run directory. From the repository:

```sh
node tests/recovery-drill.mjs prepare file-placer-recovery-2026-10-28
node tests/recovery-drill.mjs verify-originals ../obsidian-plugin-test-vaults/file-placer-recovery-2026-10-28/links-on
node tests/recovery-drill.mjs verify-originals ../obsidian-plugin-test-vaults/file-placer-recovery-2026-10-28/links-off
```

All three commands exited 0. The two disposable vaults are under
`/Users/maxogalactic/side-projects/obsidian-plugin-test-vaults/file-placer-recovery-2026-10-28/`.
Each has the rebuilt installation assets and an empty community-plugin enable
list. `links-on` and `links-off` are labels for future runs, not applied settings.
No plugin was enabled in a running app. Both baseline comparisons reported:

| Original | Bytes | SHA-256 |
| --- | --- | --- |
| `Source/Source.md` | 305 | `f78354499a2ca554df4499e265328b45ac408226216cc05586bae86a2271fa07` |
| `Target/Target.md` | 139 | `bb146ce260689faa145c433d1521cba87e7eb181514089252b7b5d846ab807ab` |

These are **pre-merge baseline checks**, not disk restoration evidence. Snapshot
verification on disk and comparisons after a live restoration have not run.

### Live drill to resume

1. With permitted app access, open only one prepared disposable vault. Record the
   running app version, enable File Placer, keep merge confirmation on, and set
   **Automatically update internal links** to the mode named by the folder.
   Set this in the app; the preparation script does not change it. For the off
   run, decline link updates if prompted and record the exact response (or absence
   of a prompt). A separate fresh run is needed to test accepting that prompt.
2. Before merging, record the full path reached by every link below and each
   rendered SVG marker. Preserve copies of the inbound note and originals outside
   the vault. Drag `Source/Source.md` over `Target/Target.md`, hold for the merge
   highlight and confirm. Inspect the target's YAML/body, all repeated lines and
   fenced code, the two `.md.txt` snapshots, and `Merged originals/Source.md`.
3. Run `node tests/recovery-drill.mjs verify-snapshots <disposable-vault>` to compare
   both initial snapshots to the fixture bytes. Save the actual merged, archived
   and inbound texts outside the vault. Open each link and record its destination
   path; record rendered media markers or errors. A link opening some existing
   note does not establish the correct destination. Do not edit the snapshots.
4. Follow **Restore a merge** in README: preserve evidence, move the archived
   source back, let link updates settle, close the vault, and replace source and
   target with the snapshot bytes. Run `verify-originals <disposable-vault>` and
   `verify-snapshots <disposable-vault>` before reopening, then again after the app
   settles. Record the output and separately inspect/restore inbound links.
5. Only after exact comparison succeeds, deliberately merge once more. Check one
   source section, original snapshots retained, and newly numbered exact snapshots.
   Repeat the successful merge/recovery drill in the other mode. A live partial
   failure and restoration remain a separate open check; the only injected archive
   failure evidence in this job comes from the host double, not the app.

For another attempt, prepare a new run name rather than resetting old evidence.
Use synthetic files only. The current fixture and snapshots must never be copied
into the personal vault.

### Link outcomes: precise limits and open observations

File Placer does not rebase the copied body links and does not redirect inbound
links to the merged target. It delegates the source move to Obsidian. If Obsidian
updates a link for that move, it follows the **archived source**, not the target.
If the link is left unchanged, it can become unresolved or resolve differently.
The archive's Markdown text can be rewritten by the host; the `.md.txt` snapshots
are separate text files. Copying a relative path to a different folder changes
its path context, but Obsidian's actual resolution must be observed.

Every runtime cell below is **blocked / not observed**, including the pre-merge
baseline destinations. No actual link destination is claimed by this job.

| Link or embed to inspect | Location(s) to inspect | Updates on | Updates off, decline prompt if offered |
| --- | --- | --- | --- |
| `[bare peer](Peer.md)` and `[explicit peer](./Peer.md)` | Source before; copied section in target; archived source | Blocked | Blocked |
| `![relative marker](media/marker.svg)` | Source before; copied section in target; archived source; compare SOURCE/TARGET MEDIA | Blocked | Blocked |
| `[self heading](../Source/Source.md#Source)` | Source before; copied section in target; archived source | Blocked | Blocked |
| Existing `[target peer](./Peer.md)` and target SVG embed | Target before/after | Blocked | Blocked |
| `[Source heading](../Source/Source.md#Source)` and `[[Source/Source]]` | `Watch/Inbound.md` before/after | Blocked | Blocked |
| `[Target](../Target/Target.md)` | `Watch/Inbound.md` before/after | Blocked | Blocked |
| All of the above after restoring originals | Original locations, target and inbound note | Blocked | Blocked |

Official guidance rechecked on 2026-10-28:
[Vault modification](https://docs.obsidian.md/Plugins/Vault) recommends `process`
for read/modify/write with a current-content check;
[internal links](https://help.obsidian.md/links) describes rename-time updates and
the prompt when automatic updates are disabled;
[submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
require an appropriate minimum version. These sources do not certify this plugin
or replace the missing runtime results. The README now distinguishes note-text
recovery from whole-vault link recovery and does not promise automatic retargeting.

## Quality review — 2026-10-29

agent decision 2026-10-28: review the four accepted follow-ups before further improvements; retain the established tests and runtime protocols because no new source defect justifies duplicating them.

Fresh `npm run qa` passes **17/17 tests**, zero-warning lint, TypeScript, production build and package checks. `npm run test:integration` from this repository passes **four** cases against the sibling Pinit checkout; the suite remains here alone. Reviewed both README install paths, version/lock agreement, bundled monkey-around notices and the existing recovery evidence. No concrete implementation or packaging regression was found; production assets remain byte-identical.

The integration cases exercise both actual plugins with an explorer double in both load orders and either disable/re-enable sequence. Snapshot/restoration evidence remains host-double evidence. [RUNTIME-SORTING.md](RUNTIME-SORTING.md) and the recovery section above still own all blocked live gates; no access retry or new recovery fixture was performed.

`git diff --check` passes. Nothing was pushed, tagged, released or submitted.

Official manifest, submission requirements, developer policies, plugin guidelines and release instructions were rechecked on 2026-10-29. Local metadata, disclosures and licensing checks do not establish minimum-version runtime compatibility, directory name availability or community approval.

## Follow-up quality review — 2026-10-29

agent decision 2026-10-28: retain the accepted implementations and existing fault matrices because independent read-only review found no concrete regression; reconcile evidence and correct documentation against source and locked dependencies.

Reviewed `a5b898a` → `dc7507f` alongside Pinit `dadd361`. The accepted File Placer change adds only the single shared rename/lifecycle suite and its evidence. Current active-pin integration, wrapper teardown and folder-placement remapping agree with Pinit's first-occurrence/top-wins normalization. No concrete implementation regression was found.

Fresh `npm run qa` passes **17/17 tests**, zero-warning lint, TypeScript, production build and package checks. `npm run test:integration` passes **12/12 cases** (four lifecycle plus eight rename/lifecycle cases) against sibling Pinit, checking exact object identity/multiplicity, both load/handler orders and either disable/re-enable from cloned saved state. The suite remains solely in `tests/integration/pinit.test.mjs`. Removed the ambiguous historical source-comment parenthetical “checked against 1.14.5” and pointed to this checklist; this is evidence wording only, with no executable behavior change.

[RUNTIME-SORTING.md](RUNTIME-SORTING.md) and the recovery section above retain the blocked live protocols. Host-double sorting, saved-state reload and synthetic restoration do not establish live compatibility, filesystem durability or actual link resolution. No new runtime protocol was created.

Rechecked current official manifest, submission requirements, developer policies, plugin guidelines and submission instructions linked in this record. Local metadata, licensing and automated checks do not establish directory availability, minimum-version runtime compatibility or community approval. Production assets match the reviewed source and remain byte-identical to this review's starting candidate; `git diff --check` passes. No tests were added because no new implementation defect was reproduced. No app-access retry, installation, push, tag, release or submission occurred.
