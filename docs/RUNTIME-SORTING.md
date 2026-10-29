# Shared desktop sorting runtime record

Date: 2026-10-28. **Status: blocked; desktop sorting is not verified.**

This is the single runtime record for File Placer and Pinit to Top or Bottom.
Neither the passing automated tests nor the prepared fixture establishes a live
Obsidian pass. No live defect was reproduced, so no source fix or new regression
test is justified by this attempt.

## Environment and attempted access

- Installed bundle: `/Applications/Obsidian.app`.
- `/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' /Applications/Obsidian.app/Contents/Info.plist` returned **1.14.5**. This is installed-bundle metadata; the running app version could not be observed.
- Candidates: File Placer 1.0.1 at `f64499b`, Pinit 2.1.1 at `3241182`, both on `agent/2026-10-28`.
- Disposable fixture: `/Users/maxogalactic/side-projects/obsidian-plugin-test-vaults/live-sorting-2026-10-28/vault`; separate `profile` directory alongside it.
- Synthetic files only: root `a.md` through `e.md`, `Pinned folder/one.md`, `Pinned folder/two.md`, and an empty `Destination` folder. The three installation files for each candidate were copied into this fixture's `.obsidian/plugins/<id>/`. Its community-plugin enable list is empty; no plugin was enabled in a running app.
- Direct execution of the installed Obsidian binary with the isolated profile exited **134**, without diagnostic text. No crash cause is established.
- Launch through `open -n -a /Applications/Obsidian.app` with the same profile failed with **NSOSStatusErrorDomain -10827, `kLSNoExecutableErr`** (reported executable missing). This does not establish that the bundle is actually missing its executable.
- Computer Use `cua.getApp("Obsidian")` returned **“Computer Use was not approved to use Obsidian”**. No further app-control route was attempted after that denial.

The personal vault was not used for runtime tests or plugin installation. No
personal app profile was copied. The synthetic fixture is retained for resumption;
it is preparation, not observed runtime evidence.

## Required installed-desktop scenarios

Every observed result below is **blocked / not run**, for the access failures above.
The steps and expected results are a resumption protocol, not a completed test log.
Record actual running app version and observed orders when access is available.

| Scenario and steps | Expected result | Observed result |
| --- | --- | --- |
| With Files open, enable File Placer then Pinit; repeat in reverse load order. Place root files in `e,d,c,b,a` order; pin `b,a` to top and `d` to bottom. Inspect root file rows separately from folder rows. | File rows `b,a,e,c,d` in both load orders; top/bottom pins override placement of unpinned files. | Blocked / not run. |
| Reload the synthetic vault after saving those placements and pins, in each load order. | Saved order and pins survive; file rows remain `b,a,e,c,d`. | Blocked / not run. |
| Disable/re-enable Pinit while File Placer remains enabled, in each load order. | Disabling shows `e,d,c,b,a` without pin styling; enabling restores `b,a,e,c,d`. | Blocked / not run. |
| Disable/re-enable File Placer while Pinit remains enabled, in each load order. | Disabling shows `b,a,c,e,d` with normal ascending name sorting for unpinned files; enabling restores `b,a,e,c,d`. | Blocked / not run. |
| Unload both, in both unload orders. | Ordinary ascending file order `a,b,c,d,e`; no pin or placement styles or active plugin handlers remain. | Blocked / not run. |
| Start with Files closed, enable both, then open Files; repeat with a genuinely deferred Files leaf before revealing it. | No error while absent/deferred; wrappers and drag listeners attach once when the real explorer loads. | Blocked / not run. |
| Move Files into a detached window; place an unpinned item and pin top/bottom there; cancel a drag, change windows, close/reopen Files, then disable/re-enable each plugin. | Same sorting in both windows; cancellation/unload clears preview styles; closed views release handlers; repeated layout changes do not duplicate handlers or actions. | Blocked / not run. |
| Pin `Pinned folder` and children, assign a child placement, rename it to `Renamed folder`, then move it into `Destination`. | Folder and descendant pins follow both path changes; placed child order follows the folder; no old paths remain in saved settings. | Blocked / not run. |
| Delete a pinned synthetic child, then its pinned parent folder. Inspect saved pins and placement lists. | Deleted paths and descendants are removed without affecting other items. | Blocked / not run. |

Agent decision — 2026-10-28: retain the existing deterministic five-file example
from the shared integration suite and add synthetic folders for rename/move checks,
so eventual live results can be compared directly with existing evidence. Keep this
attempt blocked instead of substituting another host double for the required app.

## Automated evidence, separate from runtime

Fresh commands completed successfully on 2026-10-28:

| Repository | Command | Result |
| --- | --- | --- |
| File Placer | `npm run qa` | Exit 0; lint, 14 tests, TypeScript, production build, package/artifact checks pass. |
| File Placer | `npm run test:integration` | Exit 0; four shared cases pass against actual sibling plugin source with an explorer/host double. |
| Pinit | `npm run qa` | Exit 0; lint, six tests, TypeScript, production build, package/artifact checks pass. |

Rebuilding produced no tracked artifact changes. The shared mock suite remains
only in [tests/integration/pinit.test.mjs](../tests/integration/pinit.test.mjs).
It exercises both load orders, either plugin's disable/re-enable, and ordinary
sorting after unload, but does not validate real DOM events, popouts or deferred
views. Its passing result cannot close any blocked row above.

## Compatibility and remaining work

Official [lifecycle guidance](https://docs.obsidian.md/plugins/guides/lifecycle-management)
and [submission requirements](https://docs.obsidian.md/community-directory/submission-requirements-for-plugins)
were rechecked on 2026-10-28. They require resource cleanup and an appropriate
minimum app version; this attempt does not establish compatibility or directory
acceptance. The existing declared minimum remains 1.7.2; no minimum-version app
was exercised. Mobile and minimum-version runtime coverage remain blocked/open in
the existing checklists, as do unrelated drag/merge checks.

Resume this same record when the installed app can be launched and controlled in
the disposable vault. Observe every required row, fix only reproduced defects,
add focused regressions to the existing suites, rerun QA and shared integration,
and then update both checklists. Merge recovery remains the next job. Nothing was
pushed, tagged, released or submitted. This attempt is not a completed lane job.
