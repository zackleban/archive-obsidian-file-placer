import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { load, TFile, TFolder } from "../helpers.mjs";

// Opt in to testing the actual sibling source; standalone checkouts need no other plugin.
const pinitSource = process.env.PINIT_SOURCE ?? "../obsidian-pinit-to-top-or-bottom/src/main.ts";
const { default: FilePlacer } = await load(process.env.FILE_PLACER_SOURCE ?? "src/main.ts");
const { default: Pinit } = await load(resolve(pinitSource));

for (const first of ["placer", "pinit"]) {
  for (const disabled of ["placer", "pinit"]) {
    test(`sorting survives ${first} loading first and ${disabled} disabling first`, () => {
      const folder = new TFolder("/");
      const items = ["a.md", "b.md", "c.md", "d.md", "e.md"].map(path => {
        const file = new TFile(path);
        file.parent = folder;
        return { file, el: { toggleClass() {}, removeClass() {} } };
      });
      folder.children = items.map(item => item.file);
      class Explorer {
        containerEl = { doc: {}, contains: () => false };
        fileItems = Object.fromEntries(items.map(item => [item.file.path, item]));
        shown = [];
        getSortedFolderItems() { return [...items]; }
        requestSort() { this.shown = this.getSortedFolderItems(folder).map(item => item.file.name); }
      }
      const view = new Explorer();
      const app = { workspace: { getLeavesOfType: () => [{ view }] }, plugins: { plugins: {} } };
      const placer = new FilePlacer(app);
      placer.settings.order = { "/": ["e.md", "d.md", "c.md", "b.md", "a.md"] };
      const pinit = new Pinit(app);
      pinit.settings = { top: ["b.md", "a.md"], bottom: ["d.md"] };
      app.plugins.plugins["pinit-to-top-or-bottom"] = pinit;
      const plugins = { placer, pinit };
      try {
        plugins[first].patchFileExplorer();
        plugins[first === "placer" ? "pinit" : "placer"].patchFileExplorer();
        assert.deepEqual(view.shown, ["b.md", "a.md", "e.md", "c.md", "d.md"]);
        plugins[disabled].onunload();
        // Unload must restore sorting even before the host removes its registry entry.
        assert.deepEqual(view.shown, disabled === "pinit"
          ? ["e.md", "d.md", "c.md", "b.md", "a.md"]
          : ["b.md", "a.md", "c.md", "e.md", "d.md"]);
        assert.deepEqual(pinit.settings, { top: ["b.md", "a.md"], bottom: ["d.md"] });
        const replacement = disabled === "pinit" ? new Pinit(app) : new FilePlacer(app);
        replacement.settings = structuredClone(plugins[disabled].settings);
        plugins[disabled] = replacement;
        if (disabled === "pinit") app.plugins.plugins["pinit-to-top-or-bottom"] = replacement;
        replacement.patchFileExplorer();
        assert.deepEqual(view.shown, ["b.md", "a.md", "e.md", "c.md", "d.md"]);
        replacement.onunload();
        plugins[disabled === "placer" ? "pinit" : "placer"].onunload();
        assert.deepEqual(view.shown, ["a.md", "b.md", "c.md", "d.md", "e.md"]);
      } finally {
        plugins.placer.onunload();
        plugins.pinit.onunload();
      }
    });
  }
}

function assertItems(actual, expected, supplied) {
  assert.equal(actual.length, supplied.length, "sorting preserves item count");
  for (const item of supplied) assert.equal(actual.filter(value => value === item).length, 1, "each input identity appears once");
  expected.forEach((item, index) => assert.equal(actual[index], item, `identity at index ${index}`));
}

for (const kind of ["note", "folder"]) {
  for (const first of ["placer", "pinit"]) {
    for (const disabled of ["placer", "pinit"]) {
      test(`${kind} rename collisions: ${first} first, ${disabled} disable/re-enable`, async () => {
        const root = new TFolder("/");
        const folder = kind === "folder" ? new TFolder("Old") : root;
        folder.parent = kind === "folder" ? root : null;
        const oldPath = kind === "folder" ? "Old" : "Old.md";
        const newPath = kind === "folder" ? "Moved" : "Renamed.md";
        const prefix = kind === "folder" ? "Old/" : "";
        const newPrefix = kind === "folder" ? "Moved/" : "";
        const names = ["a.md", "b.md", "c.md", "d.md", "e.md"];
        if (kind === "note") names[1] = "Old.md";
        const items = names.map(name => {
          const file = new TFile(prefix + name);
          file.parent = folder;
          return { file, el: { toggleClass() {}, removeClass() {} } };
        });
        folder.children = items.map(item => item.file);
        const renamed = kind === "folder" ? folder : items[1].file;
        const source = items[1].file.path;
        const destination = kind === "folder" ? "Moved/b.md" : newPath;
        const finalBottom = newPrefix + "d.md";
        class Explorer {
          containerEl = { doc: {}, contains: () => false };
          fileItems = Object.fromEntries(items.map(item => [item.file.path, item]));
          shown = [];
          getSortedFolderItems() { return [...items]; }
          requestSort() { this.shown = this.getSortedFolderItems(folder); }
        }
        const view = new Explorer();
        const app = {
          workspace: { getLeavesOfType: () => [{ view }] },
          vault: { getAbstractFileByPath: path => view.fileItems[path]?.file ?? null },
          plugins: { plugins: {} },
        };
        const placer = new FilePlacer(app);
        placer.settings.order = { [folder.path]: [...names].reverse() };
        const pinit = new Pinit(app);
        pinit.saved = {
          top: [source, destination, "Missing-top.md"],
          bottom: [items[3].file.path, finalBottom, "Missing-bottom.md"],
        };
        // Folder rename additionally creates a top/bottom descendant collision.
        if (kind === "folder") {
          pinit.saved.top.push("Moved/c.md");
          pinit.saved.bottom.push("Old/c.md");
        }
        await pinit.loadSettings();
        const plugins = { placer, pinit };
        app.plugins.plugins["pinit-to-top-or-bottom"] = pinit;
        try {
          plugins[first].patchFileExplorer();
          plugins[first === "placer" ? "pinit" : "placer"].patchFileExplorer();
          renamed.path = newPath;
          if (kind === "folder") for (const item of items) item.file.path = "Moved/" + item.file.name;
          view.fileItems = Object.fromEntries(items.map(item => [item.file.path, item]));
          // Match either registration order, invoking both actual rename handlers.
          for (const name of [first, first === "placer" ? "pinit" : "placer"]) {
            if (name === "pinit") pinit.onRename(newPath, oldPath);
            else placer.onRename(renamed, oldPath);
          }
          await new Promise(resolve => setImmediate(resolve));
          const expectedPins = {
            top: [destination, "Missing-top.md", ...(kind === "folder" ? ["Moved/c.md"] : [])],
            bottom: [finalBottom, "Missing-bottom.md"],
          };
          const combined = kind === "folder"
            ? [items[1], items[2], items[4], items[0], items[3]]
            : [items[1], items[4], items[2], items[0], items[3]];
          assertItems(view.shown, combined, items);
          assert.deepEqual(pinit.settings, expectedPins);
          assert.deepEqual(pinit.saved, expectedPins);
          assert.deepEqual(placer.saved.order, { [folder.path]: items.map(item => item.file.name).reverse() });
          plugins[disabled].onunload();
          assertItems(view.shown, disabled === "pinit"
            ? [...items].reverse()
            : kind === "folder"
              ? [items[1], items[2], items[0], items[4], items[3]]
              : [items[1], items[0], items[2], items[4], items[3]], items);
          const replacement = disabled === "pinit" ? new Pinit(app) : new FilePlacer(app);
          replacement.saved = structuredClone(plugins[disabled].saved);
          await replacement.loadSettings();
          plugins[disabled] = replacement;
          if (disabled === "pinit") app.plugins.plugins["pinit-to-top-or-bottom"] = replacement;
          replacement.patchFileExplorer();
          assert.deepEqual(plugins.pinit.settings, expectedPins);
          assertItems(view.shown, combined, items);
          replacement.onunload();
          plugins[disabled === "placer" ? "pinit" : "placer"].onunload();
          assertItems(view.shown, items, items);
        } finally {
          plugins.placer.onunload();
          plugins.pinit.onunload();
        }
      });
    }
  }
}

for (const kind of ["note", "folder"]) {
  for (const collision of ["before", "after"]) {
    for (const first of ["placer", "pinit"]) {
      for (const disabled of ["placer", "pinit"]) {
        test(`File Placer source position: ${kind}, stale ${collision}, ${first} first, ${disabled} reload`, async () => {
          const parent = new TFolder(kind === "note" ? "/" : "Nested/Parent");
          const pathIn = name => parent.isRoot() ? name : `${parent.path}/${name}`;
          const oldName = kind === "note" ? "Old.md" : "Old";
          const newName = kind === "note" ? "Renamed.md" : "Renamed";
          const names = ["a.md", "b.md", oldName, "d.md", "e.md", "f.md"];
          const items = names.map(name => {
            const file = new (name === oldName && kind === "folder" ? TFolder : TFile)(pathIn(name));
            file.parent = parent;
            return { file, el: { toggleClass() {}, removeClass() {} } };
          });
          parent.children = items.map(item => item.file);
          const renamed = items[2].file;
          const oldPath = renamed.path;
          const normal = [items[0], items[1], items[3], items[4], items[5], items[2]];
          class Explorer {
            containerEl = { doc: {}, contains: () => false };
            fileItems = Object.fromEntries(items.map(item => [item.file.path, item]));
            shown = [];
            getSortedFolderItems() { return [...normal]; }
            requestSort() { this.shown = this.getSortedFolderItems(parent); }
          }
          const view = new Explorer();
          const app = {
            workspace: { getLeavesOfType: () => [{ view }] },
            vault: { getAbstractFileByPath: path => view.fileItems[path]?.file ?? null },
            plugins: { plugins: {} },
          };
          const placer = new FilePlacer(app);
          const order = ["f.md", "b.md", "Missing.md", oldName, "d.md", "e.md", "a.md"];
          order.splice(collision === "before" ? 1 : 6, 0, newName);
          placer.saved = {
            order: { [parent.path]: order, Unrelated: ["Absent.md"], ...(kind === "folder" ? {
              [oldPath]: ["z.md", "Child-missing.md", "a.md"],
              [oldPath + "/Deep"]: ["two.md", "one.md"],
              [oldPath + "ish"]: ["Boundary.md"],
            } : {}) },
            mergedFolder: "Custom originals", askBeforeMerge: false,
          };
          await placer.loadSettings();
          const pinit = new Pinit(app);
          pinit.saved = { top: [pathIn("e.md"), "Missing-top.md"], bottom: [pathIn("a.md"), "Missing-bottom.md"] };
          await pinit.loadSettings();
          const expectedPins = structuredClone(pinit.settings);
          const plugins = { placer, pinit };
          app.plugins.plugins["pinit-to-top-or-bottom"] = pinit;
          const placed = [items[5], items[1], items[2], items[3], items[4], items[0]];
          const combined = [items[4], items[5], items[1], items[2], items[3], items[0]];
          const pinnedNormal = [items[4], items[1], items[3], items[5], items[2], items[0]];
          try {
            plugins[first].patchFileExplorer();
            plugins[first === "placer" ? "pinit" : "placer"].patchFileExplorer();
            renamed.path = pathIn(newName);
            view.fileItems = Object.fromEntries(items.map(item => [item.file.path, item]));
            const expected = structuredClone(placer.settings);
            expected.order[parent.path] = ["f.md", "b.md", "Missing.md", newName, "d.md", "e.md", "a.md"];
            if (kind === "folder") for (const suffix of ["", "/Deep"]) {
              expected.order[renamed.path + suffix] = expected.order[oldPath + suffix];
              delete expected.order[oldPath + suffix];
            }
            for (const name of [first, first === "placer" ? "pinit" : "placer"]) {
              if (name === "pinit") pinit.onRename(renamed.path, oldPath);
              else placer.onRename(renamed, oldPath);
            }
            assertItems(view.getSortedFolderItems(parent), combined, items);
            assert.deepEqual(structuredClone(placer.settings), expected);
            await new Promise(resolve => setImmediate(resolve));
            assertItems(view.shown, combined, items);
            assert.deepEqual(placer.saved, expected);
            assert.deepEqual(pinit.settings, expectedPins);
            assert.deepEqual(pinit.saved, expectedPins);
            plugins[disabled].onunload();
            assertItems(view.shown, disabled === "pinit" ? placed : pinnedNormal, items);
            const replacement = disabled === "pinit" ? new Pinit(app) : new FilePlacer(app);
            replacement.saved = structuredClone(plugins[disabled].saved);
            await replacement.loadSettings();
            plugins[disabled] = replacement;
            if (disabled === "pinit") app.plugins.plugins["pinit-to-top-or-bottom"] = replacement;
            replacement.patchFileExplorer();
            assert.deepEqual(structuredClone(plugins.placer.settings), expected);
            assertItems(view.shown, combined, items);
            // Reset affects only this parent; pins and descendant/other settings remain.
            await plugins.placer.resetOrder(parent.path);
            delete expected.order[parent.path];
            assert.deepEqual(plugins.placer.saved, expected);
            assertItems(view.shown, pinnedNormal, items);
            replacement.onunload();
            plugins[disabled === "placer" ? "pinit" : "placer"].onunload();
            assertItems(view.shown, normal, items);
          } finally {
            plugins.placer.onunload();
            plugins.pinit.onunload();
          }
        });
      }
    }
  }
}
