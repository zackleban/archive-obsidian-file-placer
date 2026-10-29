import test from "node:test";
import assert from "node:assert/strict";
import { load, TFile, TFolder } from "./helpers.mjs";

const { default: FilePlacer } = await load(process.env.FILE_PLACER_SOURCE ?? "src/main.ts");
const tick = () => new Promise(resolve => setImmediate(resolve));
const pathIn = (parent, name) => parent === "/" ? name : `${parent}/${name}`;
const snapshot = value => structuredClone(value);

function assertItems(actual, expected, supplied) {
  assert.equal(actual.length, supplied.length);
  for (const item of supplied) assert.equal(actual.filter(value => value === item).length, 1);
  expected.forEach((item, index) => assert.equal(actual[index], item, `identity at ${index}`));
}

async function fixture(parent, kind, names) {
  const folder = new TFolder(parent);
  const source = new (kind === "folder" ? TFolder : TFile)(pathIn(parent, kind === "folder" ? "Old" : "Old.md"));
  const peers = ["Before.md", "Middle.md", "After.md"].map(name => new TFile(pathIn(parent, name)));
  folder.children = [peers[0], source, peers[1], peers[2]];
  for (const file of folder.children) file.parent = folder;
  const items = folder.children.map(file => ({ file }));
  const app = { workspace: { getLeavesOfType: () => [] } };
  const plugin = new FilePlacer(app);
  plugin.saved = {
    order: {
      [parent]: names,
      Unrelated: ["Missing.md", "Still missing.md"],
      ...(kind === "folder" ? {
        [source.path]: ["z.md", "Missing-child.md", "a.md"],
        [source.path + "/Deep"]: ["two.md", "one.md"],
        [source.path + "ish"]: ["Boundary.md"],
      } : {}),
    },
    mergedFolder: "Custom originals", askBeforeMerge: false,
  };
  await plugin.loadSettings();
  return { plugin, app, folder, source, items };
}

for (const parent of ["/", "Nested/Parent"]) {
  for (const kind of ["note", "folder"]) {
    for (const collision of ["before", "after", "none"]) {
      test(`rename order ${kind} in ${parent}: stale destination ${collision}`, async () => {
        const oldName = kind === "folder" ? "Old" : "Old.md";
        const newName = kind === "folder" ? "Renamed" : "Renamed.md";
        const names = ["Before.md", "Missing-before.md", oldName, "Middle.md", "Missing-after.md", "After.md"];
        if (collision === "before") names.splice(1, 0, newName);
        if (collision === "after") names.splice(5, 0, newName);
        const { plugin, app, folder, source, items } = await fixture(parent, kind, names);
        const original = snapshot(plugin.settings);
        const oldPath = source.path;
        source.path = pathIn(parent, newName);
        const expected = snapshot(original);
        expected.order[parent] = ["Before.md", "Missing-before.md", newName, "Middle.md", "Missing-after.md", "After.md"];
        if (kind === "folder") {
          for (const suffix of ["", "/Deep"]) {
            expected.order[source.path + suffix] = expected.order[oldPath + suffix];
            delete expected.order[oldPath + suffix];
          }
        }
        plugin.onRename(source, oldPath);
        // Synchronous sort and exact identity checks precede async save completion.
        const ordinary = [items[3], items[2], items[0], items[1]];
        assertItems(plugin.arrange(folder, ordinary), items, ordinary);
        assert.deepEqual(snapshot(plugin.settings), expected);
        assert.equal(new Set(plugin.settings.order[parent]).size, plugin.settings.order[parent].length);
        await tick();
        assert.deepEqual(plugin.saved, expected);
        const reloaded = new FilePlacer(app);
        reloaded.saved = snapshot(plugin.saved);
        await reloaded.loadSettings();
        assert.deepEqual(snapshot(reloaded.settings), expected);
        assertItems(reloaded.arrange(folder, ordinary), items, ordinary);
        assert.deepEqual(ordinary, [items[3], items[2], items[0], items[1]], "sorting does not mutate input");
        // A saved order without the stale target remains stable through a second rename.
        const nextOldPath = source.path;
        source.path = pathIn(parent, "Again" + (kind === "note" ? ".md" : ""));
        reloaded.onRename(source, nextOldPath);
        assertItems(reloaded.arrange(folder, ordinary), items, ordinary);
      });
    }
    test(`rename order cross-parent ${kind} from ${parent} preserves move policy`, async () => {
      const oldName = kind === "folder" ? "Old" : "Old.md";
      const { plugin, app, source, folder, items } = await fixture(parent, kind, ["Before.md", oldName, "Missing.md", "Middle.md", "After.md"]);
      const oldPath = source.path;
      const destination = parent === "/" ? "Destination" : "/";
      plugin.settings.order[destination] = ["Destination-peer.md", oldName, "Destination-missing.md"];
      const expected = snapshot(plugin.settings);
      expected.order[parent] = ["Before.md", "Missing.md", "Middle.md", "After.md"];
      source.path = pathIn(destination, oldName);
      source.parent = new TFolder(destination);
      if (kind === "folder") for (const suffix of ["", "/Deep"]) {
        expected.order[source.path + suffix] = expected.order[oldPath + suffix];
        delete expected.order[oldPath + suffix];
      }
      plugin.onRename(source, oldPath);
      await tick();
      assert.deepEqual(snapshot(plugin.settings), expected);
      assert.deepEqual(plugin.saved, expected);
      const reloaded = new FilePlacer(app);
      reloaded.saved = snapshot(plugin.saved);
      await reloaded.loadSettings();
      const remaining = [items[0], items[2], items[3]];
      assertItems(reloaded.arrange(folder, [...remaining].reverse()), remaining, remaining);
      const peer = { file: new TFile(pathIn(destination, "Destination-peer.md")) };
      assertItems(reloaded.arrange(source.parent, [items[1], peer]), [peer, items[1]], [items[1], peer]);
    });
  }
}

test("rename order absent source leaves existing destination and unrelated missing entries alone", async () => {
  const { plugin, source } = await fixture("/", "note", ["Renamed.md", "Missing.md", "Before.md"]);
  const before = snapshot(plugin.settings);
  const saved = snapshot(plugin.saved);
  source.path = "Renamed.md";
  plugin.onRename(source, "Old.md");
  await tick();
  assert.deepEqual(snapshot(plugin.settings), before);
  assert.deepEqual(plugin.saved, saved);
});
