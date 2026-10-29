# File Placer

Place notes and folders in your own order in Obsidian's file explorer. A purple line previews each drop. Hold over a note to merge it into another note, with confirmation and backups.

## Requirements and installation

Requires Obsidian **1.7.2 or newer** and the core **Files** plugin. Dragging needs a mouse or trackpad; touch-only drag support is not promised. Settings and saved ordering use portable Obsidian APIs.

This repository contains a local submission candidate, not a published community release. To try it in a test vault:

1. Run `npm ci` and `npm run qa` in this repository (Node.js 22.13+ or 24 recommended for development).
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

## Merge notes

Hold one Markdown note over another for about 700 ms, then drop on the purple outline. Confirm the dialog to merge the dragged **source** into the **target**. Confirmation is on by default and can be disabled in settings.

The target stays in place. Source headings move down one level, except level-six headings and headings inside fenced code blocks. If needed, a heading using the source's name is added. Source properties are combined with target properties; conflicting values become a deduplicated list. Unreadable source properties are retained as a YAML code block. Nonblank body lines are checked before writing; the merged formatting is not byte-for-byte identical.

Before changing either note, exact text snapshots of both are saved as `<name> (before merge).md.txt` in **Merged originals** (or a visible vault folder selected in settings). The `.txt` extension prevents Obsidian's automatic Markdown link updates from changing those snapshots. Existing snapshots get numbered names.

After the target is written, the source moves into the originals folder as a normal `.md` note. Obsidian handles links to that moved source according to its link-update preference; those links still point to the archived source, not the merged target. Merging is not a link redirection tool. Relative links and embeds copied into a different folder should be checked in the target.

Only one merge runs at a time. If either note changes before the target write, the merge stops without replacing that edit. A disk error after part of the operation may leave backups or appended text; inspect the target before retrying to avoid adding the source twice.

### Restore a merge

Open the originals folder in your file manager. Copy the `.md.txt` snapshots somewhere safe, then copy their contents back into the original note locations. Alternatively, rename copies to `.md` before opening them in Obsidian. Restore links as needed if the source moved. Do not remove backups until you have checked the restored notes.

## Settings and privacy

Settings include merge confirmation, the originals folder, and per-folder reset buttons. Order and preferences live in this plugin's `data.json`. No accounts, telemetry, network calls, or paid services are used. Disabling the plugin removes manual ordering and leaves all notes, snapshots, and saved ordering intact. Other enabled sorting plugins still apply.

Colors can be overridden with a CSS snippet using `--file-placer-hover` and `--file-placer-line`.

## Development and review

- `npm run dev`: rebuild while editing.
- `npm run lint`: official Obsidian ESLint rules and TypeScript-aware checks.
- `npm test`: merge preservation, conflict/failure handling, frontmatter, ordering, and settings regressions.
- `npm run test:integration`: tests the actual File Placer and Pinit source together in both load orders, disabling either plugin and re-enabling it. Requires the Pinit checkout at `../obsidian-pinit-to-top-or-bottom` (or set `PINIT_SOURCE` to its `src/main.ts`). This optional suite uses an explorer test double, not a live Obsidian window; standalone QA needs no sibling checkout.
- `npm run build`: strict TypeScript check and production bundle.
- `npm run qa`: all checks plus manifest/package/version and artifact validation.

File explorer sorting and drag handling use guarded internal APIs. Public API usage is checked against the declared minimum version; internal integration still needs the real-app checks in [docs/REVIEW.md](docs/REVIEW.md). Other file-explorer sorting plugins may conflict.

## License

MIT; see [LICENSE](LICENSE). Bundled monkey-around is ISC; its attribution and terms are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and embedded in `main.js`.
