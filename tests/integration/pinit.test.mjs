import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { load, TFile, TFolder } from "../helpers.mjs";

// Opt in to testing the actual sibling source; standalone checkouts need no other plugin.
const pinitSource = process.env.PINIT_SOURCE ?? "../obsidian-pinit-to-top-or-bottom/src/main.ts";
const { default: FilePlacer } = await load("src/main.ts");
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
