# File Placer

Drag notes and folders to any spot in the file explorer. A purple line shows where they land. Hold still over a note to
merge the two without losing a line.

## Use

- Drag any note or folder in the file explorer. The row under the mouse goes light purple, and a darker purple line
  shows where the item lands: on top of the row while the mouse moves up, under it while it moves down.
- Under an open folder's name is the top of what's inside it.
- Drop on another folder's rows and the item moves there, into the spot the line shows.
- Hold still over a folder for a moment (the row gets a purple outline) and drop to move into it.
- Hold still over a note for a moment (purple outline) and drop to merge the dragged note into it.
- Each folder keeps the order you place things in, whatever sort order is picked. New notes show up next to where the
  normal sort would put them.
- Right-click a placed folder, **Back to normal sort**, to drop its placed order. Settings, File Placer lists every
  placed folder with the same button.
- Works with Pinit to Top or Bottom: pinned items keep their pins.

## Merging

Nothing is deleted. The note you drop on stays where it is and gets the dragged note added under it:

- under a `## <dragged note's name>` heading (or the dragged note's own `#` heading), with its headings one level down;
  code blocks are left alone;
- properties are combined; when both notes have a different value for the same property, it becomes a list of both;
- before saving, every line of both notes is checked to be in the result; if one is missing, nothing changes.

The dragged note, untouched, and a copy of the other note as it was (`<name> (before merge)`) go into the
**Merged originals** folder (changeable in settings). Links to the dragged note follow it there. A pop-up asks before
each merge; it can be turned off in settings.

## Colours

Set in `styles.css`; a CSS snippet can override them:

```
body {
	--file-placer-hover: rgba(139, 92, 246, 0.16);
	--file-placer-line: #4c1d95;
}
```

## Install by hand

Copy `main.js`, `manifest.json` and `styles.css` into `<your vault>/.obsidian/plugins/file-placer/`, then turn it on
under Settings, Community plugins.

## Build

```
npm install
npm run build
```

`npm run dev` rebuilds on every save.

## How it works

Obsidian's file explorer sorts each folder's children with an internal method, `getSortedFolderItems`. The plugin
wraps it (with `monkey-around`, so other plugins that wrap it keep working) and shows the placed order. For the drag,
it listens before the file explorer does and claims the drop only where it shows a line or an outline; Obsidian's own
drop handling skips a drop that was already claimed, so everything else (like dropping on empty space) works as usual.
Neither is public API: checked against Obsidian 1.14.5. If a later Obsidian removes the sort method, the plugin shows
a notice and does nothing.

## Licence

MIT. See `LICENSE`.
