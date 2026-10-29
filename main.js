/*!
# Third-party notices

The following libraries are bundled in main.js. Obsidian itself is supplied by the host app.

## monkey-around 3.0.0 (ISC)

Author: PJ Eby. Source: https://github.com/pjeby/monkey-around
The upstream package declares the ISC license in package.json.

Copyright PJ Eby

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE
OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.

*/
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => FilePlacerPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// node_modules/monkey-around/dist/index.mjs
function around(obj, factories) {
  const removers = Object.keys(factories).map((key) => around1(obj, key, factories[key]));
  return removers.length === 1 ? removers[0] : function() {
    removers.forEach((r) => r());
  };
}
function around1(obj, method, createWrapper) {
  const inherited = obj[method], hadOwn = obj.hasOwnProperty(method), original = hadOwn ? inherited : function() {
    return Object.getPrototypeOf(obj)[method].apply(this, arguments);
  };
  let current = createWrapper(original);
  if (inherited)
    Object.setPrototypeOf(current, inherited);
  Object.setPrototypeOf(wrapper, current);
  obj[method] = wrapper;
  return remove;
  function wrapper(...args) {
    if (current === original && obj[method] === wrapper)
      remove();
    return current.apply(this, args);
  }
  function remove() {
    if (obj[method] === wrapper) {
      if (hadOwn)
        obj[method] = original;
      else
        delete obj[method];
    }
    if (current === original)
      return;
    current = original;
    Object.setPrototypeOf(wrapper, inherited || Function);
  }
}

// src/order.ts
function placeNames(current, moving, anchor, after) {
  const rest = current.filter((name) => !moving.includes(name));
  let index = anchor === null ? 0 : rest.indexOf(anchor);
  if (index === -1) index = rest.length;
  else if (anchor !== null && after) index += 1;
  return [...rest.slice(0, index), ...moving, ...rest.slice(index)];
}
function arrange(items, nameOf2, order) {
  const rank = new Map(order.map((name, i) => [name, i]));
  const result = items.filter((item) => rank.has(nameOf2(item)));
  result.sort((a, b) => (rank.get(nameOf2(a)) ?? 0) - (rank.get(nameOf2(b)) ?? 0));
  if (result.length === items.length) return result;
  let previous = null;
  for (const item of items) {
    if (!rank.has(nameOf2(item))) result.splice(previous === null ? 0 : result.indexOf(previous) + 1, 0, item);
    previous = item;
  }
  return result;
}

// src/merge.ts
var FRONTMATTER = /^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;
var FENCE = /^ {0,3}(`{3,}|~{3,})([\s\S]*)$/;
var ATX = /^( {0,3})(#{1,6})(?=[ \t]|$)([\s\S]*)$/;
function splitNote(text) {
  const match = FRONTMATTER.exec(text);
  if (!match) return { head: "", frontmatter: null, body: text };
  return { head: match[0], frontmatter: match[1] ?? "", body: text.slice(match[0].length) };
}
function asSection(body, title) {
  const lines = scanLines(body);
  const first = lines.find(({ text: text2 }) => text2.trim() !== "");
  const moved = lines.map(({ text: text2, heading }) => {
    if (!heading || heading[2].length === 6) return text2;
    const indent = heading[1].length;
    return text2.slice(0, indent) + "#" + text2.slice(indent);
  });
  const text = moved.join("\n").replace(/^(?:[ \t]*\r?\n)+/, "").trimEnd();
  if (first?.heading?.[2].length === 1) return text;
  return text ? `## ${title}

${text}` : `## ${title}`;
}
function mergeBodies(targetBody, sourceBody, sourceTitle) {
  const top = targetBody.trimEnd();
  const section = asSection(sourceBody, sourceTitle);
  return `${top ? `${top}

` : ""}${section}
`;
}
function keepsEveryLine(merged, originals) {
  const have = lineCounts(merged);
  const needed = /* @__PURE__ */ new Map();
  for (const original of originals) {
    for (const [line, count] of lineCounts(original)) needed.set(line, (needed.get(line) ?? 0) + count);
  }
  for (const [line, count] of needed) {
    if ((have.get(line) ?? 0) < count) return false;
  }
  return true;
}
function mergeProperties(target, source) {
  for (const [key, value] of Object.entries(source)) {
    const before = Object.prototype.hasOwnProperty.call(target, key) ? target[key] : void 0;
    if (isEmpty(value) || same(before, value)) continue;
    if (isEmpty(before)) {
      Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
      continue;
    }
    const all = [...asList(before), ...asList(value)];
    Object.defineProperty(target, key, { value: all.filter((item, i) => all.findIndex((other) => same(item, other)) === i), writable: true, enumerable: true, configurable: true });
  }
}
function scanLines(text) {
  let fence = null;
  return text.split("\n").map((text2) => {
    const line = text2.replace(/\r$/, "");
    const marker = FENCE.exec(line);
    let heading = null;
    if (fence !== null) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && /^[ \t]*$/.test(marker[2])) fence = null;
    } else if (marker && (marker[1][0] === "~" || !marker[2].includes("`"))) {
      fence = marker[1];
    } else {
      heading = ATX.exec(line);
    }
    return { text: text2, heading };
  });
}
function lineCounts(text) {
  const counts = /* @__PURE__ */ new Map();
  for (const { text: line, heading } of scanLines(text)) {
    if (!heading && !line.trim()) continue;
    const key = heading ? `heading:${heading[3].trim()}` : `text:${line.trim()}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
var isEmpty = (value) => value === void 0 || value === null || value === "";
var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
var asList = (value) => Array.isArray(value) ? value : [value];

// src/main.ts
var FILE_EXPLORER = "file-explorer";
var ROW = ".nav-file-title, .nav-folder-title";
var PINIT = "pinit-to-top-or-bottom";
var HOVER_CLASS = "file-placer-hover";
var LINE_CLASS = { up: "file-placer-line-top", down: "file-placer-line-bottom" };
var INTO_CLASS = "file-placer-into";
var SHOWN_CLASSES = [HOVER_CLASS, LINE_CLASS.up, LINE_CLASS.down, INTO_CLASS];
var HOLD_MS = 700;
var STILL_PX = 3;
var DEFAULT_MERGED_FOLDER = "Merged originals";
var parentOf = (path) => path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/";
var nameOf = (path) => path.slice(path.lastIndexOf("/") + 1);
var isAtOrUnder = (path, base) => path === base || path.startsWith(base + "/");
var childPath = (folder, name) => folder.isRoot() ? name : `${folder.path}/${name}`;
var isNote = (file) => file instanceof import_obsidian.TFile && file.extension === "md";
var strings = (value) => Array.isArray(value) ? value.filter((p) => typeof p === "string") : [];
var FilePlacerPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { order: {}, mergedFolder: DEFAULT_MERGED_FOLDER, askBeforeMerge: true };
    this.unpatch = null;
    this.unsupported = false;
    this.merging = false;
    this.unloaded = false;
    this.mergePrompts = /* @__PURE__ */ new Set();
    this.watched = /* @__PURE__ */ new Map();
    this.plan = null;
    this.shownEl = null;
    // Hold time belongs to a represented intent, not a reusable row node.
    this.mouse = { x: NaN, y: NaN, at: 0, direction: "down", intent: null };
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new FilePlacerSettingTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof import_obsidian.TFolder && this.settings.order[file.path]) this.addResetItem(menu, file.path);
      })
    );
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.onRename(file, oldPath)));
    this.registerEvent(this.app.vault.on("delete", (file) => this.onDelete(file.path)));
    this.app.workspace.onLayoutReady(() => {
      if (this.unloaded) return;
      this.patchFileExplorer();
      this.registerEvent(this.app.workspace.on("layout-change", () => this.patchFileExplorer()));
    });
  }
  onunload() {
    this.unloaded = true;
    for (const modal of this.mergePrompts) modal.close();
    this.mergePrompts.clear();
    this.endDrag();
    for (const component of this.watched.values()) this.removeChild(component);
    this.watched.clear();
    this.unpatch?.();
    this.unpatch = null;
    this.forEachExplorer((view) => view.requestSort());
  }
  async place(files, folder, anchor, after) {
    const order = placeNames(this.namesIn(folder), files.map((f) => f.name), anchor?.name ?? null, after);
    await this.moveInto(files, folder);
    this.settings.order[folder.path] = order;
    await this.saveSettings();
  }
  // Nothing is deleted: the note dropped on keeps its place and gets the dragged note added under
  // it, and both originals, untouched, go to the merged originals folder.
  async merge(source, target) {
    if (this.merging) throw new Error("Another merge is still running. Try again when it finishes.");
    if (source === target || !isNote(source) || !isNote(target)) throw new Error("Choose two different Markdown notes.");
    this.merging = true;
    try {
      await this.mergeNotes(source, target);
    } finally {
      this.merging = false;
    }
  }
  async mergeNotes(source, target) {
    const { vault, fileManager } = this.app;
    if (vault.getAbstractFileByPath(source.path) !== source || vault.getAbstractFileByPath(target.path) !== target) {
      throw new Error("A note was moved or deleted. Choose the notes again.");
    }
    const folderPath = this.mergedFolder();
    const [sourceText, targetText] = await Promise.all([vault.read(source), vault.read(target)]);
    const from = splitNote(sourceText);
    const into = splitNote(targetText);
    let sourceBody = from.body;
    let properties = null;
    if (from.frontmatter !== null) {
      try {
        const parsed = (0, import_obsidian.parseYaml)(from.frontmatter);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) properties = parsed;
      } catch {
        properties = null;
      }
      if (!properties && from.frontmatter.trim()) sourceBody = "```yaml\n" + from.frontmatter + "\n```\n\n" + sourceBody;
    }
    if (properties && into.frontmatter?.trim()) {
      const parsed = (0, import_obsidian.parseYaml)(into.frontmatter);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The target has invalid properties. Fix its YAML before merging.");
    }
    const body = mergeBodies(into.body, sourceBody, source.basename);
    if (!keepsEveryLine(body, [into.body, sourceBody])) {
      new import_obsidian.Notice("File Placer: the merge would have lost a line, so nothing was changed.");
      return;
    }
    const folder = await this.ensureFolder(folderPath);
    await vault.create(this.freePath(folder, `${target.basename} (before merge)`, "md.txt"), targetText);
    await vault.create(this.freePath(folder, `${source.basename} (before merge)`, "md.txt"), sourceText);
    if (await vault.read(source) !== sourceText) throw new Error("The source changed during the merge. Originals were kept; retry with the latest note.");
    await vault.process(target, (current) => {
      if (current !== targetText) throw new Error("The target changed during the merge. Originals were kept; retry with the latest note.");
      return into.head + (into.head && !into.head.endsWith("\n") ? "\n" : "") + body;
    });
    if (properties) {
      const added = properties;
      await fileManager.processFrontMatter(target, (frontmatter) => mergeProperties(frontmatter, added));
    }
    if (await vault.read(source) !== sourceText) throw new Error("The source changed. Merged text and backups were kept; the source was not moved.");
    await fileManager.renameFile(source, this.freePath(folder, source.basename));
    new import_obsidian.Notice(`Merged "${source.basename}" into "${target.basename}".`);
  }
  async resetOrder(path) {
    delete this.settings.order[path];
    await this.saveSettings();
  }
  mergedFolder() {
    const raw = this.settings.mergedFolder.trim() || DEFAULT_MERGED_FOLDER;
    const parts = raw.replace(/\\/g, "/").split("/");
    if (raw.startsWith("/") || parts.some((part) => !part || part.startsWith(".") || /[:*?"<>|]/.test(part))) {
      throw new Error("Choose a visible folder path inside the vault for merged originals.");
    }
    return (0, import_obsidian.normalizePath)(raw);
  }
  async loadSettings() {
    const data = await this.loadData();
    const order = /* @__PURE__ */ Object.create(null);
    for (const [path, names] of Object.entries(data?.order ?? {})) order[path] = strings(names);
    this.settings = {
      order,
      mergedFolder: typeof data?.mergedFolder === "string" ? data.mergedFolder : DEFAULT_MERGED_FOLDER,
      askBeforeMerge: typeof data?.askBeforeMerge === "boolean" ? data.askBeforeMerge : true
    };
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.forEachExplorer((view) => view.requestSort());
  }
  patchFileExplorer() {
    if (this.unloaded) return;
    this.watchExplorers();
    if (this.unpatch || this.unsupported) return;
    const leaf = this.app.workspace.getLeavesOfType(FILE_EXPLORER).find((l) => !l.isDeferred);
    if (!leaf) return;
    const proto = Object.getPrototypeOf(leaf.view);
    if (typeof proto.getSortedFolderItems !== "function" || typeof proto.requestSort !== "function") {
      this.unsupported = true;
      new import_obsidian.Notice("File Placer: this version of Obsidian's file explorer is not supported.");
      return;
    }
    const arrangeItems = this.arrange.bind(this);
    this.unpatch = around(proto, {
      getSortedFolderItems(original) {
        return function(folder) {
          return arrangeItems(folder, original.call(this, folder));
        };
      }
    });
    this.forEachExplorer((view) => view.requestSort());
  }
  // Capture and preventDefault coordinate claimed drops with the core explorer.
  // Actual host listener/drag-manager ordering remains a live check in docs/REVIEW.md.
  watchExplorers() {
    const live = /* @__PURE__ */ new Set();
    for (const leaf of this.app.workspace.getLeavesOfType(FILE_EXPLORER)) {
      const el = leaf.view.containerEl;
      if (leaf.isDeferred) continue;
      live.add(el);
      if (this.watched.has(el)) continue;
      const component = this.addChild(new import_obsidian.Component());
      this.watched.set(el, component);
      component.registerDomEvent(el, "dragstart", (evt) => {
        this.endDrag();
        this.resetMouse(evt.clientX, evt.clientY);
      }, true);
      component.registerDomEvent(el.doc, "dragend", () => this.endDrag(), true);
      component.registerDomEvent(el, "dragenter", (evt) => this.onDragOver(evt), true);
      component.registerDomEvent(el, "dragover", (evt) => this.onDragOver(evt), true);
      component.registerDomEvent(el, "dragleave", (evt) => {
        const related = evt.relatedTarget;
        if (!(related?.instanceOf(Node) && el.contains(related))) this.show(null);
      }, true);
      component.registerDomEvent(el, "drop", (evt) => this.onDrop(evt), true);
    }
    for (const [el, component] of this.watched) {
      if (live.has(el)) continue;
      this.removeChild(component);
      this.watched.delete(el);
      if (this.shownEl && el.contains(this.shownEl)) this.endDrag();
    }
  }
  arrange(folder, items) {
    const order = this.settings.order[folder.path];
    if (!order) return items;
    const pinit = this.app.plugins?.plugins[PINIT];
    const pins = typeof pinit?.getActivePins === "function" ? pinit.getActivePins() : pinit?.settings;
    const top = new Set(strings(pins?.top));
    const bottom = new Set(strings(pins?.bottom));
    const pinned = (item) => top.has(item.file.path) || bottom.has(item.file.path);
    return [
      ...items.filter((item) => top.has(item.file.path)),
      ...arrange(items.filter((item) => !pinned(item)), (item) => item.file.name, order),
      ...items.filter((item) => bottom.has(item.file.path) && !top.has(item.file.path))
    ];
  }
  onDragOver(evt) {
    if (evt.defaultPrevented || this.unloaded || this.unsupported || !this.unpatch) {
      this.endDrag();
      return;
    }
    const plan = this.planFor(evt);
    this.show(plan);
    if (!plan) {
      const row = this.rowAt(evt);
      if (row && this.draggedFiles()?.some((f) => f.path === row.dataset.path)) evt.preventDefault();
      return;
    }
    evt.preventDefault();
    if (evt.dataTransfer) evt.dataTransfer.dropEffect = "move";
    this.dragManager()?.setAction(
      plan.kind === "merge" ? `Merge into ${plan.target.basename}` : plan.kind === "into" ? `Move into ${plan.folder.name}` : "Place here"
    );
  }
  onDrop(evt) {
    const plan = !evt.defaultPrevented && this.plan && this.isCurrent(this.plan, evt) ? this.plan : null;
    this.endDrag();
    if (!plan) return;
    evt.preventDefault();
    if (plan.kind === "merge") void this.safely(() => {
      this.askToMerge(plan.source, plan.target);
      return Promise.resolve();
    });
    else if (plan.kind === "into") void this.safely(() => this.moveInto(plan.files, plan.folder));
    else void this.safely(() => this.place(plan.files, plan.folder, plan.anchor, plan.after));
  }
  planFor(evt) {
    const intent = this.intentFor(evt);
    if (!intent) return null;
    const held = this.track(evt, intent);
    return this.operationFor(intent, held, this.mouse.direction);
  }
  // Snapshot mutable paths and the selection array. Also require the row to belong
  // to a currently watched, live explorer (including detached-window documents).
  intentFor(evt) {
    if (this.unloaded || this.unsupported || !this.unpatch) return null;
    const files = this.draggedFiles();
    const row = this.rowAt(evt);
    if (!files || !row?.isConnected) return null;
    const owner = this.app.workspace.getLeavesOfType(FILE_EXPLORER).find((leaf) => !leaf.isDeferred && this.watched.has(leaf.view.containerEl) && leaf.view.containerEl.contains(row))?.view.containerEl;
    if (!owner) return null;
    const current = (file2) => this.app.vault.getAbstractFileByPath(file2.path) === file2;
    const file = this.app.vault.getAbstractFileByPath(row.dataset.path ?? "");
    if (!file?.parent || !current(file.parent) || files.includes(file) || !files.every(current)) return null;
    const identity = (file2) => ({ file: file2, path: file2.path });
    return {
      row,
      owner,
      files: files.map(identity),
      target: identity(file),
      parent: identity(file.parent),
      openFolder: file instanceof import_obsidian.TFolder && file.children.length > 0 && !row.parentElement?.hasClass("is-collapsed")
    };
  }
  sameIntent(a, b) {
    const same2 = (a2, b2) => a2.file === b2.file && a2.path === b2.path;
    return !!a && a.row === b.row && a.owner === b.owner && a.openFolder === b.openFolder && same2(a.target, b.target) && same2(a.parent, b.parent) && a.files.length === b.files.length && a.files.every((file, i) => same2(file, b.files[i]));
  }
  isCurrent(plan, evt) {
    const intent = this.intentFor(evt);
    if (!intent || !this.sameIntent(plan.intent, intent)) return false;
    const current = this.operationFor(intent, plan.kind !== "place", plan.kind === "place" ? plan.side : this.mouse.direction);
    if (!current || current.kind !== plan.kind) return false;
    return plan.kind !== "place" || current.kind === "place" && current.folder === plan.folder && current.anchor === plan.anchor && current.after === plan.after;
  }
  operationFor(intent, held, side) {
    const { row } = intent;
    const file = intent.target.file;
    const files = intent.files.map(({ file: file2 }) => file2);
    if (held && files.length === 1 && isNote(files[0]) && isNote(file)) return { kind: "merge", intent, row, source: files[0], target: file };
    if (held && file instanceof import_obsidian.TFolder && this.canHold(files, file)) return { kind: "into", intent, row, files, folder: file };
    if (side === "down" && file instanceof import_obsidian.TFolder && intent.openFolder) {
      return this.canHold(files, file) ? { kind: "place", intent, row, side, files, folder: file, anchor: null, after: false } : null;
    }
    const folder = intent.parent.file;
    return folder instanceof import_obsidian.TFolder && this.canHold(files, folder) ? { kind: "place", intent, row, side, files, folder, anchor: file, after: side === "down" } : null;
  }
  rowAt(evt) {
    const target = evt.target;
    return target?.instanceOf(Element) ? target.closest(ROW) : null;
  }
  // Follows the mouse: the line sits on top of the row while it moves up and under it while it
  // moves down. Returns true after holding still over the same intent for HOLD_MS.
  track(evt, intent) {
    if (Number.isNaN(this.mouse.x)) this.resetMouse(evt.clientX, evt.clientY);
    const mouse = this.mouse;
    const now = Date.now();
    const dx = evt.clientX - mouse.x;
    const dy = evt.clientY - mouse.y;
    if (Math.abs(dy) >= STILL_PX) mouse.direction = dy < 0 ? "up" : "down";
    if (Math.abs(dx) >= STILL_PX || Math.abs(dy) >= STILL_PX) Object.assign(mouse, { x: evt.clientX, y: evt.clientY, at: now });
    if (!this.sameIntent(mouse.intent, intent)) Object.assign(mouse, { intent, at: now });
    return now - mouse.at >= HOLD_MS;
  }
  resetMouse(x, y) {
    this.mouse = { x, y, at: Date.now(), direction: "down", intent: null };
  }
  endDrag() {
    this.show(null);
    this.mouse.x = NaN;
  }
  show(plan) {
    this.plan = plan;
    const el = plan?.row ?? null;
    if (this.shownEl && this.shownEl !== el) this.shownEl.removeClasses(SHOWN_CLASSES);
    this.shownEl = el;
    if (!plan) {
      this.mouse.x = NaN;
      this.mouse.intent = null;
      return;
    }
    const wanted = [HOVER_CLASS, plan.kind === "place" ? LINE_CLASS[plan.side] : INTO_CLASS];
    for (const cls of SHOWN_CLASSES) plan.row.toggleClass(cls, wanted.includes(cls));
  }
  // A folder can't go inside itself, and a move never replaces something with the same name.
  canHold(files, folder) {
    return new Set(files.map((file) => file.name)).size === files.length && files.every(
      (f) => !(f instanceof import_obsidian.TFolder && isAtOrUnder(folder.path, f.path)) && (f.parent === folder || !folder.children.some((child) => child.name === f.name))
    );
  }
  draggedFiles() {
    const dragged = this.dragManager()?.draggable;
    if (!dragged) return null;
    if ((dragged.type === "file" || dragged.type === "folder") && dragged.file) return [dragged.file];
    if (dragged.type === "files" && dragged.files && dragged.files.length > 0) return dragged.files;
    return null;
  }
  dragManager() {
    return this.app.dragManager ?? null;
  }
  async moveInto(files, folder) {
    if (!this.canHold(files, folder)) throw new Error("The move conflicts with an existing name or would put a folder inside itself.");
    for (const file of files) {
      if (file.parent !== folder) await this.app.fileManager.renameFile(file, childPath(folder, file.name));
    }
  }
  // The folder's children as the file explorer shows them now.
  namesIn(folder) {
    let items = [];
    this.forEachExplorer((view) => items = view.getSortedFolderItems(folder));
    return items.length > 0 ? items.map((item) => item.file.name) : folder.children.map((child) => child.name);
  }
  askToMerge(source, target) {
    if (this.unloaded) return;
    if (!this.settings.askBeforeMerge) {
      void this.safely(() => this.merge(source, target));
      return;
    }
    const sourcePath = source.path;
    const targetPath = target.path;
    const folder = this.mergedFolder();
    const merge = () => void this.safely(() => {
      if (this.unloaded) return Promise.resolve();
      let sameFolder = false;
      try {
        sameFolder = this.mergedFolder() === folder;
      } catch {
      }
      if (!sameFolder || source.path !== sourcePath || target.path !== targetPath || this.app.vault.getAbstractFileByPath(sourcePath) !== source || this.app.vault.getAbstractFileByPath(targetPath) !== target) {
        throw new Error("The merge confirmation is out of date. Choose the notes again.");
      }
      return this.merge(source, target);
    });
    const modal = new MergeModal(this.app, sourcePath, targetPath, folder, merge, () => this.mergePrompts.delete(modal));
    this.mergePrompts.add(modal);
    modal.open();
  }
  async ensureFolder(path) {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian.TFolder) return existing;
    if (existing) throw new Error("The merged originals path is a file. Choose a folder instead.");
    const parent = parentOf(path);
    if (parent !== "/") await this.ensureFolder(parent);
    return this.app.vault.createFolder(path);
  }
  freePath(folder, base, extension = "md") {
    for (let n = 0; ; n++) {
      const path = childPath(folder, `${n === 0 ? base : `${base} ${n}`}.${extension}`);
      if (!this.app.vault.getAbstractFileByPath(path)) return path;
    }
  }
  async safely(run) {
    try {
      await run();
    } catch (error) {
      console.error("File Placer:", error);
      new import_obsidian.Notice(`File Placer: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  addResetItem(menu, path) {
    menu.addItem(
      (item) => item.setSection("action").setTitle("Back to normal sort").setIcon("arrow-down-up").onClick(() => this.resetOrder(path))
    );
  }
  forEachExplorer(callback) {
    for (const leaf of this.app.workspace.getLeavesOfType(FILE_EXPLORER)) {
      if (leaf.isDeferred) continue;
      const view = leaf.view;
      if (typeof view.requestSort === "function") callback(view);
    }
  }
  // Renaming keeps an item's place; moving it out of a folder drops it from that folder's order.
  // Renaming or moving a folder carries the placed order of everything inside it.
  onRename(file, oldPath) {
    let changed = false;
    const oldName = nameOf(oldPath);
    const list = this.settings.order[parentOf(oldPath)];
    const i = list ? list.indexOf(oldName) : -1;
    if (list && i !== -1) {
      if (parentOf(oldPath) === parentOf(file.path)) {
        this.settings.order[parentOf(oldPath)] = list.flatMap((name, index) => index === i ? [file.name] : name === file.name ? [] : [name]);
      } else list.splice(i, 1);
      changed = true;
    }
    if (file instanceof import_obsidian.TFolder) {
      for (const key of Object.keys(this.settings.order)) {
        if (!isAtOrUnder(key, oldPath)) continue;
        this.settings.order[file.path + key.slice(oldPath.length)] = this.settings.order[key];
        delete this.settings.order[key];
        changed = true;
      }
    }
    if (changed) void this.safely(() => this.saveSettings());
  }
  onDelete(path) {
    let changed = false;
    const list = this.settings.order[parentOf(path)];
    if (list?.includes(nameOf(path))) {
      this.settings.order[parentOf(path)] = list.filter((name) => name !== nameOf(path));
      changed = true;
    }
    for (const key of Object.keys(this.settings.order)) {
      if (!isAtOrUnder(key, path)) continue;
      delete this.settings.order[key];
      changed = true;
    }
    if (changed) void this.safely(() => this.saveSettings());
  }
};
var MergeModal = class extends import_obsidian.Modal {
  constructor(app, sourcePath, targetPath, folder, onMerge, onDismiss) {
    super(app);
    this.sourcePath = sourcePath;
    this.targetPath = targetPath;
    this.folder = folder;
    this.onMerge = onMerge;
    this.onDismiss = onDismiss;
    this.pending = true;
  }
  onOpen() {
    const from = nameOf(this.sourcePath).replace(/\.md$/, "");
    const into = nameOf(this.targetPath).replace(/\.md$/, "");
    this.titleEl.setText(`Merge "${from}" into "${into}"?`);
    this.contentEl.createEl("p", { text: `Source: ${this.sourcePath}` });
    this.contentEl.createEl("p", { text: `Target: ${this.targetPath}` });
    this.contentEl.createEl("p", {
      text: `"${into}" stays where it is and gets all of "${from}" added under it, with its headings one level down.`
    });
    this.contentEl.createEl("p", {
      text: `Exact text backups of both notes are saved in "${this.folder}" before merging. "${from}" moves there after the target is saved. Nothing is deleted.`
    });
    new import_obsidian.Setting(this.contentEl).addButton((button) => button.setButtonText("Cancel").onClick(() => this.close())).addButton(
      (button) => button.setButtonText("Merge").setCta().onClick(() => {
        if (!this.pending) return;
        this.pending = false;
        this.close();
        this.onMerge();
      })
    );
  }
  onClose() {
    this.pending = false;
    this.onDismiss();
    this.contentEl.empty();
  }
};
var FilePlacerSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    this.renderSettings();
  }
  renderSettings() {
    const { containerEl } = this;
    const settings = this.plugin.settings;
    containerEl.empty();
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Drag any note or folder in the file explorer. A purple line shows where it lands: on top of the row while you move up, under it while you move down. Hold still over a note to merge the two; hold still over a folder to move into it."
    });
    new import_obsidian.Setting(containerEl).setName("Ask before merging").setDesc("Confirm each merge before changing notes.").addToggle(
      (toggle) => toggle.setValue(settings.askBeforeMerge).onChange(async (value) => {
        settings.askBeforeMerge = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Merged originals folder").setDesc("Exact copies of both notes are saved here before merging; the source moves here afterwards.").addText(
      (text) => text.setPlaceholder(DEFAULT_MERGED_FOLDER).setValue(settings.mergedFolder).onChange(async (value) => {
        settings.mergedFolder = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Placed folders").setHeading();
    const folders = Object.keys(settings.order).sort();
    if (folders.length === 0) {
      containerEl.createEl("p", { cls: "setting-item-description", text: "Nothing placed yet." });
      return;
    }
    for (const path of folders) {
      new import_obsidian.Setting(containerEl).setName(path === "/" ? "Vault root" : path).addButton(
        (button) => button.setButtonText("Back to normal sort").onClick(async () => {
          await this.plugin.resetOrder(path);
          this.renderSettings();
        })
      );
    }
  }
};
