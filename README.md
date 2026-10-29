# File Placer

Place notes and folders in your own order in Obsidian's file explorer. A purple line previews each drop. Hold over a note to merge it into another note, with confirmation and backups.

## Requirements and installation

Requires Obsidian **1.7.2 or newer** and the core **Files** plugin. Dragging needs a mouse or trackpad; touch-only drag support is not promised. Settings and saved ordering use portable Obsidian APIs.

This repository contains a local submission candidate, not a published community release. To try it in a test vault:

1. Run `npm ci` and `npm run qa` in this repository. Development is tested on Node.js 24.22.0; the locked DOM-test dependency requires Node `^22.22.2 || ^24.15.0 || >=26.0.0`.
2. Create `<vault>/<config-dir>/plugins/file-placer/`. The config directory is normally `.obsidian`.
3. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
4. Reload Obsidian and enable **File Placer** under **Settings → Community plugins**.

## Place files

- Drag a note or folder. The line appears above the hovered row when moving upward and below it when moving downward.
- Below an open folder's name means the first position inside that folder.
- Drop among another folder's children to move the selection into that folder.
- Hold still over a folder for about 700 ms, then drop on its purple outline to move into it.
- Each folder remembers its order. New items remain beside their neighbors in the ordinary sort order.
- Right-click a folder and choose **Back to normal sort**, or reset it in the plugin settings. The settings also include the vault root.
- Pinit to Top or Bottom pins take precedence over manual placement. With both current local candidates installed, disabling Pinit immediately restores the placed order; re-enabling it restores saved pins. Install both updated candidates for this cleanup fix; older Pinit versions still use the settings compatibility fallback.

A move never overwrites another file with the same name. A folder cannot move inside itself. The plugin claims only drops with a valid preview; other drops use Obsidian's normal behavior.

A preview belongs to the current ordered source selection, represented target and destination. Changing a source or target path/identity, reusing a row, changing its applicable folder placement, or ending the drag invalidates that preview. A changed selection or target needs a fresh 700 ms hold before offering merge or move-into-folder again. Placement keeps the direction shown by its line; waiting without a new held preview does not turn the drop into a merge.

At drop, File Placer rechecks the preview and current move conflicts before claiming the event. A stale preview clears without dispatching a File Placer merge, move or placement, even with merge confirmation disabled. File Placer leaves that drop unclaimed for the core host; this does **not** promise that Obsidian will do nothing. An already default-prevented drop is left prevented and dispatches no File Placer action. Missing drag-manager state is rejected rather than guessed. Live explorer event ordering, including when the host clears its drag state, remains unverified in [docs/REVIEW.md](docs/REVIEW.md#drop-intent-repair--2026-10-29).

## Merge notes

Hold one Markdown note over another for about 700 ms, then drop on the purple outline. Confirm the dialog to merge the dragged **source** into the **target**. Confirmation is on by default and can be disabled in settings.

The dialog shows the source and target paths and the originals folder. Confirming uses those same note identities, paths and destination. If either note was renamed, moved, deleted or replaced, or the destination setting now resolves to a different or invalid path, File Placer rejects the confirmation before starting a merge or creating backups and asks you to choose the notes again. Open a fresh dialog to use the new intent. Equivalent spellings of the same destination are allowed.

Each dialog can be confirmed only once. Canceling or closing it, or disabling File Placer, makes retained callbacks inactive; disabling also closes pending dialogs. A prompt left over after another merge archives its source is obsolete. With confirmation disabled, the current drop-intent checks and merge safeguards still apply without opening a dialog.

Note contents are read when you confirm, so edits made while the dialog is open are included. Existing concurrent-edit checks still protect edits detected during the merge. Confirmation validation is immediate before dispatch; it does not make later asynchronous filesystem operations atomic or provide automatic rollback.

The target stays in place. Supported source ATX headings move down one level, capped at level six. Opening hashes must have zero to three leading spaces, one to six hashes, and a space, tab or end of line afterward; empty headings count. The first nonblank line supplies the section heading if it is a supported H1, including an indented or empty H1. Otherwise File Placer adds `## <source name>`.

Top-level backtick and tilde fences protect their contents. Backtick opening info strings cannot contain backticks, so a same-line triple-backtick code span does not open a block. Closers need the same marker type, at least the opening length, zero to three leading spaces and only trailing spaces/tabs. Four-space/tab-indented lines and invalid heading markers remain literal. Heading indentation, suffix text (including closing hashes), and internal LF/CRLF line endings are retained. Existing outer blank-line/trailing-whitespace trimming remains; added wrappers, section separators and the final newline use LF. Exact originals are saved separately.

This is a bounded line scanner, not a full Markdown parser. It does not resolve setext headings, list/blockquote containers, HTML/comment blocks or multiline inline-code context. Those structures may contain lines interpreted by the top-level rules; their rendered hierarchy is not guaranteed. An unclosed fence in the target can change the appended section's context; if the preservation check cannot reconcile it, the merge stops before creating backups or writing notes. Close that fence before retrying.

The preservation safeguard counts repeated nonblank lines and empty headings across both originals. It ignores outer whitespace and supported heading levels, keeps closing-hash suffixes, and counts literal/code lines separately from headings. It is a content multiset check, not proof of line order, rendering or exact formatting; extra matching lines can satisfy a count. Source properties are combined with target properties; conflicting values become a deduplicated list. Unreadable source properties are retained as a YAML code block.

Before changing either note, exact text snapshots of both are saved as `<name> (before merge).md.txt` in **Merged originals** (or a visible vault folder selected in settings). The `.txt` extension prevents Obsidian's automatic Markdown link updates from changing those snapshots. Existing snapshots get numbered names.

After the target is written, the source moves into the originals folder as a normal `.md` note. This archived source and the merged target are different files. File Placer asks Obsidian to move the source; it never redirects inbound links to the merged target. Links that Obsidian updates for that move refer to the archived source. If links are not updated, their old paths can become unresolved or resolve differently. Turning **Automatically update internal links** off can prompt for a decision; record the response as well as the setting when testing.

File Placer copies body link and embed text without rebasing paths. For example, `./Peer.md` copied from `Source/Source.md` to `Target/Target.md` still says `./Peer.md`; its relative-path meaning has changed. A same-named file can mask a wrong destination. Check the opened note's full path and the embed's content, including self-links and heading links. Obsidian's resolver and move-time updates determine the final result; real-app outcomes with automatic updates on/off remain **unverified** in [docs/REVIEW.md](docs/REVIEW.md#merge-recovery-follow-up--2026-10-28).

Only one merge runs at a time. If either note changes before the target write, the merge stops without replacing that edit. A disk error after part of the operation may leave backups or appended text; inspect the target before retrying to avoid adding the source twice.

### Restore a merge

The steps below have an automated host-double regression for a successful merge and an archive failure after the target write. The live Obsidian drill is still blocked; this is not a verified whole-vault undo. Snapshots contain the two notes' text, not their original folder paths, inbound notes, attachments, or plugin settings.

1. Stop merging and editing these notes. Record the original source/target paths, current source path, and the matching snapshot pair. The target snapshot is created first. Numbered snapshot names avoid overwrites, but do not constitute a transaction ID; after a partial failure, matching pairs can have different suffixes. Use the contents and your pre-merge record to identify them.
2. Copy the snapshots and the current source/target/inbound notes outside the vault before recovery, preserving their bytes. Keep the originals as `.md.txt`. Opening renamed `.md` copies inside Obsidian exposes them to link rewriting and is unnecessary for restoration.
3. Inspect the failure stage. If the second snapshot failed, the plugin has not written either note; retain the first snapshot and both current originals. If the target was written but archival failed, the source may still be at its original path: restore the target from its snapshot and compare the source to its snapshot. Inspect the actual files after any error; a rejected host operation is not a guarantee that it made no changes.
4. After a successful archive, use Obsidian to move the archived source back to its recorded original path before restoring text. Do not overwrite an occupied path. Preserve conflicting files and resolve which one is the original first. Allow link-update prompts to finish, recording each choice. Moving the archived source back can help reverse links that followed it; it is not a promise that every inbound link is restored.
5. Close the test vault to avoid active editor/link writes. Using the file manager or a byte-preserving copy tool, copy the contents of each identified `.md.txt` snapshot over its corresponding original `.md` path. Keep the `.md` filenames at those paths. Do not replace original text with the merged target or the archived source's possibly rewritten text. Preserve any later edits separately rather than losing them during restoration.
6. Compare both restored files with the snapshots byte for byte (including line endings and final newline), reopen the vault, and compare again after it settles. Inspect inbound links and copied links/embeds separately. Only these two note texts are protected by the snapshots; use your own backup to restore other notes changed by link maintenance.
7. Retry only deliberately, after both original texts and paths are verified and the cause of the error is resolved. Retrying against an already merged target appends the source again. Keep all snapshots and recovery copies until both notes and their links have been checked.

For a repeatable synthetic drill and exact-byte comparison commands, see [docs/REVIEW.md](docs/REVIEW.md#merge-recovery-follow-up--2026-10-28). No automatic retry or rollback is performed.

## Settings and privacy

Settings include merge confirmation, the originals folder, and per-folder reset buttons. Order and preferences live in this plugin's `data.json`. No accounts, telemetry, network calls, or paid services are used. Disabling the plugin removes manual ordering and leaves all notes, snapshots, and saved ordering intact. Other enabled sorting plugins still apply.

Colors can be overridden with a CSS snippet using `--file-placer-hover` and `--file-placer-line`.

## Development and review

- `npm run dev`: rebuild while editing.
- `npm run lint`: official Obsidian ESLint rules and TypeScript-aware checks.
- `npm test`: merge preservation, conflict/failure handling, frontmatter, ordering, settings and actual-source drag/confirmation-intent regressions. Drag and confirmation tests use native JSDOM events with controlled time or Modal/Setting lifecycle doubles and synthetic vault operations; JSDOM is development-only.
- `npm run test:integration`: tests the actual File Placer and Pinit source together in both load orders, disabling either plugin and re-enabling it. Requires the Pinit checkout at `../obsidian-pinit-to-top-or-bottom` (or set `PINIT_SOURCE` to its `src/main.ts`). This optional suite uses an explorer test double, not a live Obsidian window; standalone QA needs no sibling checkout.
- `npm run build`: strict TypeScript check and production bundle.
- `npm run qa`: all checks plus manifest/package/version and artifact validation.

File explorer sorting and drag handling use guarded internal APIs. Public API usage is checked against the declared minimum version; internal integration still needs the real-app checks in [docs/REVIEW.md](docs/REVIEW.md). Other file-explorer sorting plugins may conflict.

## License

MIT; see [LICENSE](LICENSE). Bundled monkey-around is ISC; its attribution and terms are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and embedded in `main.js`.
