import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { load, Plugin, TFile, TFolder } from "./helpers.mjs";

// Actual plugin source, native DOM propagation/classes/attachment and controlled
// time. Obsidian's extensions, components, drag manager and vault remain doubles.
class Component {
  cleanups = [];
  registerDomEvent(el, type, callback, options) {
    el.addEventListener(type, callback, options);
    this.cleanups.push(() => el.removeEventListener(type, callback, options));
  }
  unload() { for (const cleanup of this.cleanups.splice(0)) cleanup(); }
}
class HostPlugin extends Plugin {
  removeChild(component) { component.unload(); return component; }
}
const { default: FilePlacer } = await load(process.env.FILE_PLACER_SOURCE ?? "src/main.ts", { Component, Plugin: HostPlugin });
const classes = ["file-placer-hover", "file-placer-line-top", "file-placer-line-bottom", "file-placer-into"];
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, kind = "merge", { real = false, multiple = false } = {}) {
  const dom = new JSDOM("<!doctype html><body></body>");
  const { window } = dom;
  globalThis.Node = window.Node;
  globalThis.Element = window.Element;
  Object.defineProperty(window.Node.prototype, "doc", { get() { return this.ownerDocument ?? this; } });
  window.Node.prototype.instanceOf = function(type) { return this instanceof window[type.name]; };
  window.Element.prototype.hasClass = function(name) { return this.classList.contains(name); };
  window.Element.prototype.removeClasses = function(names) { this.classList.remove(...names); };
  window.Element.prototype.toggleClass = function(name, enabled) { this.classList.toggle(name, enabled); };
  let now = 1000;
  t.mock.method(Date, "now", () => now);
  const files = new Map(), texts = new Map(), effects = [], calls = [];
  const root = new TFolder("/"); files.set(root.path, root);
  function add(path, folder = false, text = path + " body\n") {
    const file = folder ? new TFolder(path) : new TFile(path);
    file.parent = files.get(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/");
    file.parent.children.push(file); files.set(path, file);
    if (!folder) texts.set(file, text);
    return file;
  }
  const source = add("Source.md"), second = add("Second.md"), other = add("Other.md");
  const folder = add("Destination", true), target = add("Destination/Target.md");
  add("Destination/Last.md");
  const represented = kind === "merge" || kind === "place" ? target : folder;
  const pane = window.document.createElement("div");
  const wrapper = pane.appendChild(window.document.createElement("div"));
  const row = wrapper.appendChild(window.document.createElement("div"));
  row.className = represented instanceof TFolder ? "nav-folder-title" : "nav-file-title";
  row.dataset.path = represented.path;
  const label = row.appendChild(window.document.createElement("span"));
  window.document.body.append(pane);
  class Explorer {
    containerEl = pane;
    getSortedFolderItems(folder) { return folder.children.map(file => ({ file })); }
    requestSort() {}
  }
  const leaves = [{ view: new Explorer() }];
  const manager = { draggable: multiple ? { type: "files", files: [source, second] } : { type: "file", file: source }, setAction() {} };
  const app = {
    workspace: { getLeavesOfType: () => leaves }, dragManager: manager,
    vault: {
      getAbstractFileByPath: path => files.get(path) ?? null,
      read: async file => texts.get(file),
      createFolder: async path => { effects.push(["mkdir", path]); return add(path, true); },
      create: async (path, text) => { effects.push(["create", path]); return add(path, false, text); },
      process: async (file, fn) => { effects.push(["write", file]); texts.set(file, fn(texts.get(file))); },
    },
    fileManager: {
      renameFile: async (file, path) => {
        effects.push(["rename", file, path]);
        files.delete(file.path); file.parent.children.splice(file.parent.children.indexOf(file), 1);
        file.path = path; file.parent = files.get(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/");
        file.parent.children.push(file); files.set(path, file);
      },
      processFrontMatter: async () => { effects.push(["frontmatter"]); },
    },
  };
  const plugin = new FilePlacer(app);
  plugin.settings.askBeforeMerge = false;
  const save = plugin.saveData.bind(plugin);
  plugin.saveData = async value => { effects.push(["save"]); await save(value); };
  if (!real) {
    plugin.askToMerge = (...args) => calls.push(["merge", ...args]);
    plugin.moveInto = async (...args) => { calls.push(["into", ...args]); };
    plugin.place = async (...args) => { calls.push(["place", ...args]); };
  }
  plugin.patchFileExplorer();
  t.after(() => { plugin.onunload(); dom.window.close(); });
  function event(type, { y = 20, x = 20, prevented = false, node = label, relatedTarget = null, direct = false } = {}) {
    const evt = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, relatedTarget });
    Object.defineProperty(evt, "dataTransfer", { value: { dropEffect: "none" } });
    if (prevented) evt.preventDefault();
    node.dispatchEvent(evt);
    // Simulate a callback already retained by a host dispatch after listener removal.
    if (direct) plugin[type === "drop" ? "onDrop" : "onDragOver"](evt);
    return evt;
  }
  function preview({ held = kind !== "place", y = 20 } = {}) {
    event("dragover", { y });
    if (held) { now += 700; event("dragover", { y }); }
    assert.equal(row.classList.contains(held ? "file-placer-into" : "file-placer-line-bottom"), true, "real hover displays expected preview");
  }
  function clean() { for (const cls of classes) assert.equal(row.classList.contains(cls), false, cls); }
  return { plugin, app, manager, files, texts, effects, calls, root, source, second, other, folder, target, represented,
    pane, row, label, wrapper, leaves, add, event, preview, clean, advance: ms => { now += ms; } };
}

for (const kind of ["merge", "into", "place"]) {
  test(`${kind}: unchanged preview dispatches exactly once and clears highlight`, async t => {
    const f = fixture(t, kind); f.preview();
    assert.equal(f.event("drop").defaultPrevented, true);
    await settle(); f.clean();
    assert.deepEqual(f.calls, [kind === "merge" ? [kind, f.source, f.target] : kind === "into"
      ? [kind, [f.source], f.folder] : [kind, [f.source], f.folder, f.target, true]]);
    assert.equal(f.event("drop").defaultPrevented, false);
    assert.equal(f.calls.length, 1);
  });
  const mutations = {
    "reused row path": f => { f.row.dataset.path = f.other.path; },
    "changed source": f => { f.manager.draggable.file = f.other; },
    "cleared drag": f => { f.manager.draggable = null; },
    "multiple sources": f => { f.manager.draggable = { type: "files", files: [f.source, f.second] }; },
    "removed source": f => { f.files.delete(f.source.path); },
    "replaced source identity": f => { f.files.set(f.source.path, new TFile(f.source.path)); },
    "renamed source": f => { f.files.delete(f.source.path); f.source.path = "Renamed.md"; f.files.set(f.source.path, f.source); },
    "removed target": f => { f.files.delete(f.represented.path); },
    "replaced target identity": f => { const file = f.represented instanceof TFolder ? new TFolder(f.represented.path) : new TFile(f.represented.path); file.parent = f.represented.parent; f.files.set(file.path, file); },
    "renamed target with updated row": f => { f.files.delete(f.represented.path); f.represented.path += "-renamed"; f.files.set(f.represented.path, f.represented); f.row.dataset.path = f.represented.path; },
    "detached pane": f => { f.pane.remove(); },
    "retired attached pane before layout callback": f => { f.leaves.length = 0; },
    "drag ended": f => { f.event("dragend"); },
    "new drag started without a new hover": f => { f.event("dragstart"); },
    "unloaded retained callback": f => { f.plugin.onunload(); },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    test(`${kind}: ${name} rejects cached action without claiming or side effects`, async t => {
      const f = fixture(t, kind); f.preview(); mutate(f);
      const evt = f.event("drop", { direct: true }); await settle();
      assert.deepEqual(f.calls, [], "no cached action selected");
      assert.deepEqual(f.effects, [], "no write/save/rename");
      assert.equal(evt.defaultPrevented, false, "left to core host"); f.clean();
    });
  }
  test(`${kind}: default-prevented drop clears preview without dispatch`, async t => {
    const f = fixture(t, kind); f.preview();
    assert.equal(f.event("drop", { prevented: true }).defaultPrevented, true);
    await settle(); assert.deepEqual(f.calls, []); f.clean();
    f.preview(); assert.equal(f.event("drop").defaultPrevented, true);
    assert.equal(f.calls.length, 1);
  });
}

for (const kind of ["merge", "into"]) {
  for (const change of ["row", "source", "clear", "leave", "prevented hover", "target identity"]) {
    test(`${kind}: ${change} requires a fresh hold, with 699/700ms controls`, t => {
      const f = fixture(t, kind); f.preview();
      if (change === "row") f.row.dataset.path = kind === "merge" ? f.other.path : f.add("Other folder", true).path;
      if (change === "source") f.manager.draggable.file = f.second;
      if (change === "clear") { f.manager.draggable = null; f.event("dragover"); f.manager.draggable = { type: "file", file: f.source }; }
      if (change === "leave") f.event("dragleave");
      if (change === "prevented hover") f.event("dragover", { prevented: true });
      if (change === "target identity") {
        const replacement = kind === "merge" ? new TFile(f.represented.path) : new TFolder(f.represented.path);
        replacement.parent = f.represented.parent; f.files.set(replacement.path, replacement);
      }
      f.event("dragover");
      assert.equal(f.row.classList.contains("file-placer-into"), false, "old hold cannot transfer");
      f.advance(699); f.event("dragover"); assert.equal(f.row.classList.contains("file-placer-into"), false);
      f.advance(1); f.event("dragover"); assert.equal(f.row.classList.contains("file-placer-into"), true);
      const expected = f.files.get(f.row.dataset.path);
      f.event("drop");
      assert.deepEqual(f.calls, [[kind, ...(kind === "merge" ? [f.manager.draggable.file, expected] : [[f.manager.draggable.file], expected])]]);
    });
  }
}

test("placement preserves upward direction and ordered multiple-source arguments", t => {
  const f = fixture(t, "place", { multiple: true }); f.preview();
  f.event("dragover", { y: 10 });
  assert.equal(f.row.classList.contains("file-placer-line-top"), true);
  f.event("drop", { y: 10 });
  assert.deepEqual(f.calls, [["place", [f.source, f.second], f.folder, f.target, false]]);
});
for (const kind of ["into", "place"]) {
  for (const change of ["reverse", "replace", "remove"]) {
    test(`${kind}: in-place selection array ${change} is rejected`, t => {
      const f = fixture(t, kind, { multiple: true }); f.preview();
      if (change === "reverse") f.manager.draggable.files.reverse();
      if (change === "replace") f.manager.draggable.files[1] = f.other;
      if (change === "remove") f.manager.draggable.files.pop();
      assert.equal(f.event("drop").defaultPrevented, false);
      assert.deepEqual(f.calls, []); f.clean();
    });
  }
  test(`${kind}: new destination collision is rejected before event claiming`, t => {
    const f = fixture(t, kind); f.preview(); f.add("Destination/Source.md");
    assert.equal(f.event("drop").defaultPrevented, false); assert.deepEqual(f.calls, []); f.clean();
  });
}
test("open-folder placement preserves first-inside order and rejects changed expansion", t => {
  const f = fixture(t, "into"); f.preview({ held: false });
  f.wrapper.classList.add("is-collapsed");
  assert.equal(f.event("drop").defaultPrevented, false); assert.deepEqual(f.calls, []); f.clean();
  f.wrapper.classList.remove("is-collapsed"); f.preview({ held: false }); f.event("drop");
  assert.deepEqual(f.calls, [["place", [f.source], f.folder, null, false]]);
});
test("placement rejects replaced destination identity", t => {
  const f = fixture(t, "place"); f.preview();
  f.files.set(f.folder.path, new TFolder(f.folder.path));
  assert.equal(f.event("drop").defaultPrevented, false); assert.deepEqual(f.calls, []); f.clean();
});
test("placement rejects a changed target parent even while row and target identity stay the same", t => {
  const f = fixture(t, "place"); f.preview();
  f.target.parent = f.add("Replacement destination", true);
  assert.equal(f.event("drop").defaultPrevented, false); assert.deepEqual(f.calls, []); f.clean();
});
test("fresh intent after stale rejection remains usable without a modal", async t => {
  const f = fixture(t, "merge", { real: true }); f.preview();
  f.row.dataset.path = f.other.path;
  assert.equal(f.event("drop").defaultPrevented, false); await settle();
  assert.deepEqual(f.effects, []); f.clean();
  f.preview(); assert.equal(f.event("drop").defaultPrevented, true); await settle();
  assert.equal(f.source.path, "Merged originals/Source.md");
  assert.match(f.texts.get(f.other), /Source\.md body/);
  assert.equal(f.texts.get(f.target), "Destination/Target.md body\n");
  assert.deepEqual(f.effects.map(e => e[0]), ["mkdir", "create", "create", "write", "rename"]);
});
for (const kind of ["merge", "into", "place"]) {
  test(`${kind}: cleared drag has no actual mutation even with confirmation disabled`, async t => {
    const f = fixture(t, kind, { real: true }); f.preview(); f.manager.draggable = null;
    const evt = f.event("drop"); await settle();
    assert.deepEqual(f.effects, []); assert.equal(evt.defaultPrevented, false); f.clean();
    assert.equal(f.source.path, "Source.md"); assert.equal(f.texts.get(f.target), "Destination/Target.md body\n");
  });
}
test("valid placement moves in selection order and saves exact destination order", async t => {
  const f = fixture(t, "place", { real: true, multiple: true }); f.preview(); f.event("drop"); await settle();
  assert.deepEqual(f.effects.map(e => [e[0], e[2]]), [["rename", "Destination/Source.md"], ["rename", "Destination/Second.md"], ["save", undefined]]);
  assert.deepEqual(f.plugin.saved.order, { Destination: ["Target.md", "Source.md", "Second.md", "Last.md"] });
});
test("closed panes release native listeners and retained callbacks cannot revive previews", t => {
  const f = fixture(t); f.preview();
  const component = f.plugin.watched.get(f.pane);
  assert.equal(component.cleanups.length, 6);
  f.leaves.length = 0; f.plugin.watchExplorers(); f.clean();
  assert.equal(component.cleanups.length, 0); assert.equal(f.plugin.watched.size, 0);
  f.event("dragover", { direct: true }); f.advance(700); f.event("dragover", { direct: true });
  f.clean(); assert.equal(f.event("drop", { direct: true }).defaultPrevented, false); assert.deepEqual(f.calls, []);
});
test("valid held multi-file move dispatches once in selection order", t => {
  const f = fixture(t, "into", { multiple: true }); f.preview();
  assert.equal(f.event("drop").defaultPrevented, true); f.clean();
  assert.deepEqual(f.calls, [["into", [f.source, f.second], f.folder]]);
});
test("valid held multi-file move performs only the ordered renames", async t => {
  const f = fixture(t, "into", { real: true, multiple: true }); f.preview();
  assert.equal(f.event("drop").defaultPrevented, true); await settle(); f.clean();
  assert.deepEqual(f.effects.map(e => [e[0], e[2]]), [["rename", "Destination/Source.md"], ["rename", "Destination/Second.md"]]);
  assert.deepEqual(f.plugin.settings.order, {});
});
test("in-place multi-selection change resets into-folder hold", t => {
  const f = fixture(t, "into", { multiple: true }); f.preview();
  f.manager.draggable.files.reverse(); f.event("dragover");
  assert.equal(f.row.classList.contains("file-placer-into"), false);
  f.advance(699); f.event("dragover"); assert.equal(f.row.classList.contains("file-placer-into"), false);
  f.advance(1); f.event("dragover"); assert.equal(f.row.classList.contains("file-placer-into"), true);
  f.event("drop"); assert.deepEqual(f.calls, [["into", [f.second, f.source], f.folder]]);
});
for (const kind of ["merge", "into", "place"]) {
  test(`${kind}: stale rejection allows a fresh preview of the new source`, t => {
    const f = fixture(t, kind); f.preview(); f.manager.draggable.file = f.second;
    assert.equal(f.event("drop").defaultPrevented, false); assert.deepEqual(f.calls, []); f.clean();
    f.preview(); assert.equal(f.event("drop").defaultPrevented, true); f.clean();
    assert.deepEqual(f.calls, [kind === "merge" ? [kind, f.second, f.target] : kind === "into"
      ? [kind, [f.second], f.folder] : [kind, [f.second], f.folder, f.target, true]]);
  });
}
test("ordinary placement stays placement when time passes without a held preview", t => {
  const f = fixture(t, "place"); f.preview(); f.advance(1000); f.event("drop");
  assert.deepEqual(f.calls, [["place", [f.source], f.folder, f.target, true]]);
});
test("unchanged source selection permits a recreated manager wrapper", t => {
  const f = fixture(t); f.preview(); f.manager.draggable = { type: "files", files: [f.source] };
  f.event("drop"); assert.deepEqual(f.calls, [["merge", f.source, f.target]]);
});
test("folder self-move and same-name selection retain their protections", t => {
  const f = fixture(t, "into");
  const child = f.add("Destination/Nested", true);
  f.manager.draggable = { type: "folder", file: f.folder }; f.row.dataset.path = child.path;
  f.event("dragover"); f.advance(700); f.event("dragover"); f.clean();
  assert.equal(f.event("drop").defaultPrevented, false); assert.deepEqual(f.calls, []);
  f.row.dataset.path = f.folder.path;
  f.manager.draggable = { type: "files", files: [f.source, f.add("Destination/Source.md")] };
  f.event("dragover"); f.advance(700); f.event("dragover"); f.clean();
  assert.equal(f.event("drop").defaultPrevented, false); assert.deepEqual(f.calls, []);
});
test("unload releases listeners and retained hover callbacks cannot recreate intent", t => {
  const f = fixture(t); f.preview(); const component = f.plugin.watched.get(f.pane);
  f.plugin.onunload(); f.clean(); assert.equal(component.cleanups.length, 0);
  f.event("dragover", { direct: true }); f.advance(700); f.event("dragover", { direct: true });
  f.clean(); assert.equal(f.event("drop", { direct: true }).defaultPrevented, false); assert.deepEqual(f.calls, []);
});
test("row moved to another watched pane cannot dispatch its old preview", t => {
  const f = fixture(t); f.preview();
  const otherPane = f.pane.ownerDocument.createElement("div");
  f.pane.ownerDocument.body.append(otherPane);
  f.leaves.push({ view: { containerEl: otherPane, requestSort() {} } }); f.plugin.watchExplorers();
  otherPane.append(f.wrapper);
  assert.equal(f.event("drop").defaultPrevented, false); assert.deepEqual(f.calls, []); f.clean();
  f.preview(); f.event("drop"); assert.deepEqual(f.calls, [["merge", f.source, f.target]]);
});
