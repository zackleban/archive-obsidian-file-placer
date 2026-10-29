# Local review checklist

Latest local checkpoint: [Rename order repair — 2026-10-29](#rename-order-repair--2026-10-29). Earlier entries below remain dated history.

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
- While a merge dialog is open, rename/move or replace a note and change the originals folder; verify rejection with no merge writes, then open a fresh valid prompt. Check Cancel, Escape/backdrop close, disable and normal confirmation on current/minimum versions and in popouts. Actual modal lifecycle, focus, visibility and coexistence remain unverified.
- Use a detached explorer window and test dragging, drag cancellation, and changing windows.
- Check current/minimum-version host drag-manager ordering at capture-phase drop: ordinary, held, multi-selection, cancelled/ended, and reused rows. Change source/target between preview and drop; verify File Placer rejects stale intent and separately observe core behavior. Repeat in a popout. Synthetic tests do not close this gate.
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

## Drop-intent repair — 2026-10-29

**agent decision 2026-10-28:** bind previews to observed semantic intent and reject
stale drops before action dispatch, because baseline actual-source tests select
obsolete merge, move and placement operations. Keep the merge algorithm and
sorting implementation unchanged. Use one editing owner and an independent
read-only drag-intent reviewer; the reviewer found no blocking defect in the
candidate contract or final focused coverage.

### Contract and event policy

Each preview snapshots the ordered source objects and paths, represented target
object/path, parent object/path, row, owning explorer container and open-folder
placement state. Mutable manager arrays are copied. Current vault lookups must
still resolve to those identities, and the row must be connected inside a watched,
nondeferred explorer still present in the workspace. At drop, eligibility and the
applicable destination/anchor are checked using the displayed action and direction.
Validation neither advances hold time nor substitutes another action. Conflicts
are rejected before event claiming; existing move/name/self-move checks remain.

Hold time resets when represented intent changes. Invalid or already prevented
hover, leaving the pane, dragstart/end, retired panes and unload invalidate the
preview. A source/target change needs a fresh 700 ms hold for merge/into-folder.
Elapsed time at drop alone cannot turn an ordinary placement into a held action.
An equivalent manager wrapper with the same ordered selection is allowed.

A stale drop clears highlights, dispatches no File Placer action and is left
unclaimed. An already prevented drop stays prevented and dispatches no action.
Valid drops are claimed once with `preventDefault()`. Core behavior after an
unclaimed drop is outside this contract: it may still perform its own action.
Missing/cleared manager state is rejected, so if a live host clears it before
File Placer's capture listener, that drop will be left to core. Actual ordering
and core handling remain open checks above; no host-level no-op is claimed.

### Persisted baseline and candidate evidence

`tests/drop-intent.test.mjs` loads the actual source through the existing esbuild
helper and runs actual `onDragOver`, `planFor`, `track`, `show`, `rowAt` and `onDrop`.
JSDOM 30.1.3 supplies native nodes, nested row targets, `closest`, `dataset`,
attachment, classes and cancelable capture/bubble events. An Obsidian Component
double registers/removes real listeners. `Date.now` is controlled; no private
plan fields or hold timestamps are set by tests. Actions are checked at
`askToMerge`, `moveInto` and `place`, including exact object arguments and ordering.
Separate confirmation-disabled cases use the actual actions with synthetic vault
texts and counted create/process/rename/save calls.

- Before any production-source edit, the first persisted 80 cases failed **66/80**
  at `e22bbf81e5f754754a363012b8aded8397205843`; unchanged valid controls passed.
- After bounded review additions, the final **92-case** suite replayed against
  that exact baseline fails **72/92** (20 pass). All 12 original hold-reset cases
  fail on inherited timing; the added multi-selection hold case also fails.
  Stale selected actions and actual synthetic side effects reproduce independently
  of a confirmation modal. This is not an observed live merge or data-loss event.
- Candidate focused `node --test tests/drop-intent.test.mjs`: **92/92 pass**.
  Changed/cleared/multiple/reordered sources; mutable selection arrays; path
  changes; removed/replaced objects; changed parents/destination conflicts;
  row reuse and pane ownership; ended/new drags; unload and retained callbacks;
  prevented drops; 699/700 ms timing; fresh valid actions after rejection;
  up/down/first-inside placement and real synthetic rename/save order all pass.
- The baseline replay uses `FILE_PLACER_SOURCE=<baseline>/src/main.ts` with
  `main.ts`, `order.ts` and `merge.ts` extracted from `e22bbf8` and the same installed
  toolchain. This override changes only the loaded implementation, not test logic.

### Evidence boundaries and dependencies

These tests invoke the real explorer patch/watch setup but do not run Obsidian's
full plugin loader. File objects, vault operations, drag manager, Obsidian DOM
extensions and Component lifecycle are doubles. Native DOM dispatch does not
establish physical drag behavior, rendering, cross-window timing, host event
ordering, filesystem durability, link maintenance or real modal behavior. The
pane tests use one synthetic document; popout behavior remains unverified.
Assertions count actual synthetic write/rename/save calls, not real disk writes.
Unobserved clear-and-restore changes between delivered events cannot be detected;
this is validation at observed hover/drop boundaries, not a transaction lock
against later changes or modal-confirmation races. Existing merge recovery and
link evidence above remains unchanged.

Installed Obsidian 1.14.4 declarations document cross-window `Node.instanceOf`,
owner `doc`, DOM listener registration and child unload semantics. They expose
no public drag-manager ordering guarantee. The old source comment asserting core
listener behavior now explicitly leaves it as a live check. No app access retry,
new recovery vault, personal-vault installation or minimum-version claim occurred.
[RUNTIME-SORTING.md](RUNTIME-SORTING.md) remains the sole live sorting evidence home.

JSDOM is pinned as a development-only dependency; no pre-existing locked package
entry changed. Its Node requirement is `^22.22.2 || ^24.15.0 || >=26.0.0`; local
execution uses Node 24.22.0 and npm 11.19.1. README development requirements now
match that constraint. Runtime dependencies, manifest and minimum version are
unchanged. The initial offline install found no cached package, then a normal
registry install succeeded without scripts; no accounts or paid services were used.

Final `npm run qa` passes **109/109 tests** (17 existing plus 92 drag-intent cases),
zero-warning lint, TypeScript, production build and package checks. One final
`npm run test:integration` passes **12/12** against unchanged sibling Pinit
`0aa0c84cdd2480d8ddb45a99d59d570ba32d69d5`. `main.js` was rebuilt from the candidate
source; JSDOM is absent from the production bundle. `git diff --check` passes.
No push, tag, release or submission was performed. These are local candidate
checks; all existing live sorting, drag, popout, recovery/link and minimum-version
gates remain open in their existing records.

## Four-fix quality REVIEW — 2026-10-29

agent decision 2026-10-28: accept this bounded local REVIEW only after independent source/contract review and fresh checks; preserve live/community gates because synthetic hosts and local packaging cannot establish them.

Reviewed ordered source identities, current target/destination/pane membership, hold reset, immediate pre-dispatch checks, default prevention and highlight cleanup. Actual synthetic merge/move/place composition and preserved Pinit lifecycle/sorting agree with the accepted contract. No new defect found. Rejected previews dispatch no File Placer action and stay unclaimed; core behavior and post-dispatch/modal races remain outside this contract. The sole shared suite stays at tests/integration/pinit.test.mjs; a fresh npm run test:integration passes 12/12 against sibling Pinit 0aa0c84 (implementation unchanged).

Fresh `npm run qa` passed **109/109 tests**, TypeScript, production build and package checks. Configured official lint passed with zero warnings. This QA ran once for this REVIEW; standalone results across all seven are **382 tests**, plus **12 shared cases**. The preceding 365-plus-12 figure was an arithmetic intake expectation; the 17 new graph cases account for the difference.

README installation/development requirements, manifest/package/lock/root-lock/version-map agreement, licenses/notices, dependency classification and production artifacts were checked against actual configuration. Current official [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin%20guidelines), [developer policies](https://docs.obsidian.md/community-directory/developer-policies), [submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins), [manifest schema](https://docs.obsidian.md/Reference/Manifest) and [submission instructions](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin) were rechecked. Declared minimums remain unverified runtime gates; local consistency is not hosted-scanner or community approval.

Existing live checklists and recovery protocols above remain their sole homes; no app-access retry, personal-vault installation, push, tag, release or submission occurred. Production assets are byte-identical to the starting candidate.

## Confirmation-intent repair — 2026-10-29

**agent decision 2026-10-28:** reject changed displayed intent and require a fresh
prompt because following mutable objects/settings contradicts what was confirmed.
One editing owner and an independent read-only reviewer cover this bounded repair.
Local Mac source/DOM tools fit; GPU work and asset credits add no useful evidence.
The drop-intent guard, sorting and merge/recovery algorithms remain unchanged.

### Contract

`askToMerge` captures source/target object identities, their paths, and the
normalized originals-folder path. The modal displays immutable full note paths,
short names and that destination. Immediately before merge dispatch, the current
object paths must equal the captured paths, vault lookups at those paths must
resolve to those objects, and the current setting must resolve to the same valid
destination. Different or invalid destinations, moved/renamed/deleted/replaced
notes, and a source archived by a prior merge reject with:
`File Placer: The merge confirmation is out of date. Choose the notes again.`
No merge dispatch, backup folder/snapshot creation, target processing, frontmatter
processing or archive rename occurs for those rejected confirmations.

A normalized-equivalent destination spelling is unchanged intent. The contract
captures a destination **path**, not an existing folder object's identity; folder
existence/name conflicts are still handled by the merge's existing checks. Changes
restored before confirmation are not a historical event log and cannot be detected.

Each modal consumes its pending action before closing and dispatching. `onClose`
invalidates it and releases plugin ownership; Cancel and host close use the same
path. Unload marks the plugin inactive, closes all pending prompts and prevents
late confirmation/request callbacks. Already consumed, canceled, closed or unloaded
callbacks silently do nothing. A rejected prompt is also consumed; a fresh prompt
can accept new paths/settings. Separate still-valid prompts encounter the existing
merge lock if another merge is running. No automatic retry is added.

No contents are frozen while the prompt is open: confirmation reads current note
texts and retains the existing exact snapshots, line-preservation checks, source
rereads, target `process` comparison and merge lock. Validation and dispatch have
no intervening await; `mergeNotes` captures its destination before its first await.
This does not lock paths/settings/contents across subsequent asynchronous host
operations, cancel an already dispatched merge on unload, or make recovery atomic.
Confirmation-disabled operation continues through the actual merge without a
modal; the previously accepted drop guard remains separate.

### Baseline, replay and local evidence

`tests/confirmation-intent.test.mjs` loads actual source and exercises the real
`askToMerge`, `MergeModal` lifecycle/button callbacks, `safely`, `merge` and
`mergeNotes`. The merge observer forwards to the real implementation. Native
JSDOM buttons deliver clicks through a Setting double; the Modal double invokes
`onOpen`/`onClose`, attaches/removes native elements and exposes exact displayed
text. Synthetic vault operations record every folder/create/process/frontmatter/
rename call and maintain file identity, paths and contents. Assertions require
zero effects before checking rejected dispatch, and exact full target text,
properties, snapshots, source text/archive identity and operation order on success.

- Before editing production code, the persisted **25-case baseline failed 20/25**
  against `02166ce02ca893d533b547743a87799c23b8ef55`; five positive controls passed.
  Full output: [confirmation-intent-baseline.txt](../tests/evidence/confirmation-intent-baseline.txt).
- Baseline source/target moves and renames, destination changes, closed callbacks
  and repeated/obsolete prompts performed actual synthetic writes. Baseline
  deletion/replacement already stopped within `mergeNotes`, but still dispatched;
  an invalid destination also dispatched and lacked choose-again feedback.
- Candidate focused suite: **25/25 pass**. It covers all those changes separately,
  unchanged confirmation, displayed paths, cancellation/external close/unload,
  repeated invocation before and after completion, retained second-prompt replay,
  fresh prompts after destination/source-path rejection, normalized destination,
  current-content reads, confirmation-disabled behavior and the merge lock.

Replay against the exact baseline without modifying the checkout (run from the
repository; the temporary source directory is disposable):

```sh
baseline_dir=$(mktemp -d /tmp/file-placer-confirmation-baseline.XXXXXX)
ln -s "$PWD/node_modules" "$baseline_dir/node_modules"
for source in main.ts merge.ts order.ts; do
  git show "02166ce02ca893d533b547743a87799c23b8ef55:src/$source" > "$baseline_dir/$source"
done
FILE_PLACER_SOURCE="$baseline_dir/main.ts" node --test tests/confirmation-intent.test.mjs
```

This source override changes only implementation selection, not assertions or
host behavior. The expected baseline exit is 1. The unchanged implementation's
five controls pass, distinguishing intended successful behavior from rejection.

### Boundaries and final checks

Installed Obsidian 1.14.4 declarations expose Modal `open`, `close`, `onOpen`,
`onClose` and ButtonComponent `onClick`; they do not guarantee modal coexistence
or event ordering. The retained-second-prompt test models two host-owned callbacks
with synthetic open modals, **not demonstrated live UI coexistence**. Direct
retained-callback tests intentionally bypass normal DOM removal to test ownership.
Escape/backdrop delivery, focus and actual rendering are not simulated. Vault,
file objects, lifecycle, Notice and JSON-flow-YAML frontmatter processing are
host doubles; no real disk durability, link maintenance or YAML formatting is
certified. Notices assert constructor text, not an observed application message.

Existing live sorting/drag/modal/recovery/link/popout/minimum-version checks stay
open in this record and [RUNTIME-SORTING.md](RUNTIME-SORTING.md). No new live-check
home, app-access retry or personal-vault installation was made. Local acceptance
is not community approval or a minimum-version certification.

Independent read-only review found no blocking contract or coverage defect and
separately ran the focused suite (**25/25 pass**). The documented baseline replay,
including temporary dependency resolution, reproduces **20 failures / 25 cases**
with the same five controls passing.

One final `npm run qa` passes **134/134 tests** (17 preservation/behavior, 92 drop
intent and 25 confirmation intent), zero-warning lint, TypeScript, production
build and package checks. One final `npm run test:integration` passes **12/12**
against unchanged clean Pinit `8d5374307df00ded6d7cc596dc0410f1ba7f54a7` on
`agent/2026-10-28`. No final-check failure required a repeated QA/integration run.
`main.js` is rebuilt from final source; dependencies, metadata and CSS are
unchanged. Working/staged diff checks pass. Nothing was pushed, tagged, released
or submitted. These results accept the bounded local candidate only.

## Confirmation and ownership REVIEW — 2026-10-29

agent decision 2026-10-28: accept only the bounded local REVIEW after independent source/contract review, fresh checks and local commits; keep existing live/community gates open because local evidence cannot establish them.

Reviewed `02166ce` → `9d525bf` with independent read-only source/test/API review. Displayed source/target identities and full paths plus normalized originals destination are captured, validated and dispatched synchronously before the first await. One-shot consumption precedes close; cancel/unload retire pending authority, and separate valid prompts retain the lock. Current-content reads, confirmation-disabled behavior, drop intent, sorting and recovery remain intact. No new defect found. Destination is a path contract; later mutations are not atomic and unload cannot cancel dispatched work. Retained callbacks do not establish live modal coexistence. The shared integration suite passed **12/12** against sibling Pinit `8d53743`; its implementation remained unchanged.

Fresh `npm run qa` passed **134/134 tests**, TypeScript, production build and package checks. Configured lint passed with zero warnings. Each of the seven QA commands ran once for this REVIEW; the fresh aggregate is **543 standalone tests plus 12 shared cases**. Five new graph cases account for the increase from the historical 538-plus-12 intake arithmetic. No final QA failed.

README installation/development instructions, manifest/package/lock/root-lock/version agreement, desktop flags, dependency classification, licenses/notices and assets were checked against source/build configuration. Current official [plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin%20guidelines), [developer policies](https://docs.obsidian.md/community-directory/developer-policies), [submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins), [manifest](https://docs.obsidian.md/Reference/Manifest) and [submission instructions](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin) were rechecked. Local consistency does not establish minimum-version compatibility, directory availability, hosted-review success or community approval.

Production assets are byte-identical to this REVIEW's starting candidate. Diff checks pass. Existing readiness/live protocols remain their sole homes, including explorer/modal/WebGL/xterm, popout, mobile where advertised, Linux and minimum versions as applicable. The three older live sorting/recovery deliverables remain blocked. No app-access retry, personal-vault installation, push, tag, release or submission occurred.


## Heading structure repair — 2026-10-29

**agent decision 2026-10-28:** use one bounded top-level ATX/fence scanner for
heading demotion, first-heading wrapper selection and line preservation, because
fixing only demotion makes legitimate output fail the production guard. Retain
level six and the existing whitespace/separator policy. Keep `src/main.ts`,
confirmation/drop intent, sorting, recovery, dependencies and metadata unchanged.
One editing owner and one parallel read-only reviewer cover this candidate.

### Supported contract and limits

The README Merge notes section owns the user-facing policy. The scanner recognizes
zero to three ASCII leading spaces, one to six opening hashes and ASCII space/tab
or end of line after them, including empty headings. It inserts one hash after
indentation for levels one through five; H6 stays H6. The first nonblank supported
H1 suppresses the source-name wrapper. Raw heading suffixes, including closing
hashes, are retained rather than parsed or normalized away.

Top-level backtick/tilde openers need at least three matching characters. Backtick
info strings containing any backtick are rejected; tilde info may contain them.
A closer must match the type, meet/exceed the opening length, have at most three
leading spaces and only spaces/tabs afterward. Code/fence text is copied literally.
Four-space/tab-indented lines, escaped hashes, missing separators, seven hashes
and non-ASCII/vertical whitespace separators do not become headings. Internal
LF/CRLF stays intact; new separators/wrappers/final newline use LF. The existing
source outer-blank and trailing-whitespace trimming and target trailing-whitespace
trimming remain, so merged text is not a byte-preserving transformation.

Primary syntax references checked: [CommonMark 0.31.2 ATX headings](https://spec.commonmark.org/0.31.2/#atx-headings)
and [fenced code blocks](https://spec.commonmark.org/0.31.2/#fenced-code-blocks).
They define these syntax boundaries, not live Obsidian rendering. This is not a
full block/inline parser: setext, list/quote containers, HTML/comments and multiline
inline-code context are outside the contract. Context inside those structures
may be interpreted as top-level syntax. No rendered hierarchy guarantee is made.

Preservation uses the same scanner with typed heading/literal keys. It ignores
outer whitespace and heading level only; empty headings have explicit keys and
closing hashes remain content. Ordinary lines cannot be replaced by same-word
headings or generated wrappers, nor can code heading hashes silently change.
Counts from each original are accumulated separately, resetting fence state per
original. Missing repeats, including empty headings across notes, reject. This
is a multiset check: it does not establish order, position, rendering or exact
formatting, and additional equal keys can satisfy counts. Incompatible contexts
(such as an unclosed target fence absorbing an appended heading) fail closed
before any folder/snapshot/write/rename; no synthetic closer is inserted.

### Persisted evidence and replay

Before production edits, `tests/heading-structure.test.mjs` persisted **91 cases**
against `9412dfadedf0a4f4ea14c695aaf94bb17a131d9c`: **46 fail / 45 pass**.
[Initial output](../tests/evidence/heading-structure-baseline.txt) includes the
three required exact-output cases and corresponding preservation probes. Both
indented/empty corrected outputs fail the old guard; the inline-span output
already passes its old guard but its transformation is wrong. Positive controls
cover already-supported syntax and ordinary-content loss rejection.

The final source replay additionally exercises real plugin merge actions through
the existing behavior fixture. **108 heading-selected cases: 57 fail / 51 pass**
(includes one retained heading/fence behavior test). [Replay output](../tests/evidence/heading-structure-baseline-replay.txt)
records the same assertions against exported original source; only source
selection changes. Output trailing whitespace is normalized for clean diffs.

```sh
baseline_dir=$(mktemp -d /tmp/file-placer-heading-baseline.XXXXXX)
ln -s "$PWD/node_modules" "$baseline_dir/node_modules"
for source in main.ts merge.ts order.ts; do
  git show "9412dfadedf0a4f4ea14c695aaf94bb17a131d9c:src/$source" > "$baseline_dir/$source"
done
FILE_PLACER_SOURCE="$baseline_dir/main.ts" node --test --test-reporter=tap --test-name-pattern=heading tests/heading-structure.test.mjs tests/behavior.test.mjs
```

Expected baseline exit is 1. Candidate focused suite with both complete files
passes **124/124**: 95 syntax/preservation, 12 new actual-action cases and all 17
retained behavior/recovery cases. Literal expected strings independently check
the output, not a second call to the transformer under test. The matrix includes
all six levels, four supported indents, tabs/EOL/empty/closing-hash suffixes,
LF/CRLF, invalid heading controls, same-line inline spans, genuine/invalid fence
openers and closers, unclosed fences, meaningful multiplicity and loss controls.

Actual `merge`/`mergeNotes` tests assert exact target text, exact original
snapshots (including CRLF and missing final newline), unchanged archived source
text/identity, create/create/process/rename ordering, conflicting property merge,
pre-write preservation rejection with zero writes and source edits detected both
before and after target write. Retained suites cover target edits, backup/write/
archive failures, restoration/retry, lock, sorting and confirmation/drop intent.

Vault/file objects, frontmatter serialization and UI notices are host doubles.
These are synthetic operation/text assertions, not filesystem durability, link
maintenance, live Markdown rendering or Obsidian lifecycle evidence. Existing
live sorting/drag/modal/popout/mobile/minimum/current-version and recovery/link
gates remain open in this record and RUNTIME-SORTING.md. No denied access was
retried and no installation in the personal vault was attempted.

Independent read-only review caught an intermediate suffix-regex mistake:
JavaScript dot excludes U+2028/U+2029 even inside an LF-delimited line. Four
persisted positive controls failed that candidate and passed the original
implementation. The scanner now accepts literal Unicode separators in heading
text and fence info; four added controls pass. The [intermediate failing output](../tests/evidence/heading-unicode-review-regression.txt)
is separate from original-source baseline evidence. This is why the final replay
has four more passing controls than the initial replay.

### Final local verification

Independent read-only review accepts the bounded candidate with no remaining
blocker after the Unicode correction. One final `npm run qa` exits 0:
**241/241 tests** (95 heading/preservation, 29 behavior/recovery, 92 drop intent,
25 confirmation intent), zero-warning lint, TypeScript, production build and
package checks. One final `npm run test:integration` exits 0: **12/12** against
unchanged clean Pinit `ddc675827e6000ba8639ff101e775a16e050f9f7`. Neither full
command failed or needed repetition. Node 24.22.0/npm 11.19.1; no dependencies
were installed or updated.

An independent in-memory esbuild production build using the checked-in build
options matches `main.js` byte for byte; its input inventory contains no JSDOM.
`main.js` SHA-256: `3e3bdaf644be35d8f35257c7600147c796d5c9bb9afe0f774b5b9e09719c3d34`.
CSS, notices, metadata and runtime dependencies are unchanged. Working/staged
diff checks pass. No push, tag, release, submission or app-access attempt occurred.
This is local candidate acceptance only; the existing live gates remain open.

## Rename order repair — 2026-10-29

agent decision 2026-10-28: retain the source slot during a same-parent rename and
remove colliding stale destination-name entries, because the existing rename
contract promises to keep the item's place. Keeping the first destination
occurrence would instead move the item when that stale entry precedes the source.
Only `onRename`'s same-parent name transition changes; `arrange`, cross-parent
removal, folder descendant-key remapping and asynchronous saving are unchanged.

For a source name present once in an otherwise unique saved list, the result
remains unique with the new name at the source's position relative to unaffected
entries. Unrelated missing names/preferences remain intact. This does not
normalize every malformed historical setting, select a policy for repeated source
names, resolve colliding folder-order keys, or redesign persistence. A source
absent from the saved list leaves the destination entry alone, as before.

### Baseline, replay and candidate

Persisted before production edits at `83db0de142931f9eae8b0e3e2bc5ef55cfcde346`:

- [Standalone baseline](../tests/evidence/rename-order-baseline.txt): **17 tests,
  8 fail / 9 pass**. Both stale-target sides fail across root/nested notes/folders;
  ordinary rename, cross-parent move and absent-source controls pass.
- [Shared baseline](../tests/evidence/rename-order-integration-baseline.txt):
  **28 tests, 16 fail / 12 pass**, using unchanged Pinit
  `ddc675827e6000ba8639ff101e775a16e050f9f7`. All new File Placer collision cases
  fail; all retained integration cases pass. Only trailing output whitespace
  was normalized in these captured logs.

Replay the final tests against the exported original source without switching
or modifying the working tree:

```sh
baseline_dir=$(mktemp -d /tmp/file-placer-rename-baseline.XXXXXX)
ln -s "$PWD/node_modules" "$baseline_dir/node_modules"
for source in main.ts merge.ts order.ts; do
  git show "83db0de142931f9eae8b0e3e2bc5ef55cfcde346:src/$source" > "$baseline_dir/$source"
done
FILE_PLACER_SOURCE="$baseline_dir/main.ts" node --test --test-reporter=tap tests/rename-order.test.mjs tests/integration/pinit.test.mjs
```

Expected exit 1: **45 tests, 24 fail / 21 pass**. Candidate focused command
without `FILE_PLACER_SOURCE` passes **45/45**. Literal expected arrays and exact
object identities check immediate sorting, cloned save/reload, unaffected live
neighbors, unrelated missing names and preferences. Folder cases preserve child
and deep-order remapping while leaving `Oldish` path-boundary siblings alone.
Cross-parent controls retain the destination's existing saved order. A second
ordinary rename retains source position after the collision repair.

The sole shared suite remains `tests/integration/pinit.test.mjs`: 16 new cases
keep the renamed note/root or folder/nested row unpinned so pins cannot hide a
position error. Both load/rename-handler orders, either plugin's unload/reload
from cloned saved state, inactive Pinit still in the registry, pin precedence,
parent reset and final ordinary sorting preserve exact identities/multiplicity.
No sibling source, dependency, metadata or CSS change is needed.

Two independent read-only reviewers accept the source-position policy and
integration with no blocking findings; each independently ran the focused tests.
The existing standalone suite retains new-item insertion, manual placement,
merge/recovery, heading, drop and confirmation contracts.

These are actual-source calls and installed wrappers with storage/explorer
**doubles**, not live Obsidian, full registered event dispatch or filesystem
persistence/durability evidence. Save timing/concurrency, malformed historical
settings and folder-key collisions are not newly certified. Live sorting,
popout, mobile, minimum/current-version, drag/modal and recovery/link gates stay
open in this record and [RUNTIME-SORTING.md](RUNTIME-SORTING.md). No blocked app
access was retried and nothing was installed in the personal vault.

### Final local verification

One final `npm run qa` exits 0: **258/258 tests**, zero-warning official lint,
TypeScript, production build and metadata/package checks. One final
`npm run test:integration` exits 0: **28/28** against unchanged clean Pinit
`ddc675827e6000ba8639ff101e775a16e050f9f7`. Neither full check failed or needed
repeating. Original-source replay reproduced **24 failures / 21 passes** across
the 45 focused cases. Node 24.22.0/npm 11.19.1; no installs or updates.

An in-memory esbuild production build using the checked-in options matches the
rebuilt `main.js` byte for byte; its input inventory contains no JSDOM.
SHA-256: `c7405ae8d768e5fef9ec56a4d8fcc89c347ec15cea4b43133bce6d8514f37ecc`.
Working/staged diff checks pass. Source, matching asset, regressions, baseline
evidence and docs belong to this local commit on `agent/2026-10-28`; no push,
tag, release or submission. Existing live gates remain open.
