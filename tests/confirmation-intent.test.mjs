import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { load, TFile, TFolder, notices } from "./helpers.mjs";

// Actual MergeModal/Setting callbacks and actual merge operations. Only the host
// lifecycle, DOM extensions and in-memory vault are doubled; no merge stub.
const dom = new JSDOM("<!doctype html><body></body>");
const { document, HTMLElement } = dom.window;
HTMLElement.prototype.setText = function(text) { this.textContent = text; };
HTMLElement.prototype.empty = function() { this.replaceChildren(); };
HTMLElement.prototype.createEl = function(tag, options = {}) {
  const el = this.appendChild(document.createElement(tag)); el.textContent = options.text ?? ""; return el;
};
const modals = [], callbacks = new WeakMap();
class Modal {
  constructor(app) {
    this.app = app; this.containerEl = document.createElement("div");
    this.titleEl = this.containerEl.createEl("h2"); this.contentEl = this.containerEl.createEl("div");
    modals.push(this);
  }
  open() { document.body.append(this.containerEl); this.opened = true; this.onOpen(); }
  close() { this.opened = false; this.onClose(); this.containerEl.remove(); }
}
class Setting {
  constructor(container) { this.container = container; }
  addButton(configure) {
    const el = this.container.createEl("button");
    const button = {
      setButtonText(text) { el.textContent = text; return button; },
      setCta() { return button; },
      onClick(fn) { callbacks.set(el, fn); el.addEventListener("click", fn); return button; },
    };
    configure(button); return this;
  }
}
const { default: FilePlacer } = await load(process.env.FILE_PLACER_SOURCE ?? "src/main.ts", { Modal, Setting });
const sourceText = '---\r\n{"status":"source","tags":["shared","source"]}\r\n---\r\n# Source\r\nrepeat\r\nrepeat\r\n';
const targetText = '---\n{"status":"target","tags":["shared","target"]}\n---\ntarget line';
const mergedText = '---\n{"status":["target","source"],"tags":["shared","target","source"]}\n---\ntarget line\n\n## Source\r\nrepeat\r\nrepeat\n';
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture(t) {
  modals.length = 0; notices.length = 0;
  t.mock.method(console, "error", () => {});
  const files = new Map(), texts = new Map(), effects = [], dispatches = [];
  const root = new TFolder("/"); files.set("/", root);
  function add(path, text) {
    const file = text === undefined ? new TFolder(path) : new TFile(path);
    file.parent = files.get(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/");
    file.parent.children.push(file); files.set(path, file);
    if (text !== undefined) texts.set(file, text);
    return file;
  }
  add("From"); add("Into"); add("Elsewhere");
  const source = add("From/Source.md", sourceText), target = add("Into/Target.md", targetText);
  function relocate(file, path) {
    files.delete(file.path); file.parent.children.splice(file.parent.children.indexOf(file), 1);
    file.path = path; file.parent = files.get(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/");
    file.parent.children.push(file); files.set(path, file);
  }
  const app = {
    workspace: { getLeavesOfType: () => [] },
    vault: {
      getAbstractFileByPath: path => files.get(path) ?? null,
      read: async file => texts.get(file),
      createFolder: async path => { effects.push(["mkdir", path]); return add(path); },
      create: async (path, text) => {
        effects.push(["create", path, text]); assert.equal(files.has(path), false); return add(path, text);
      },
      process: async (file, change) => { effects.push(["process", file.path]); texts.set(file, change(texts.get(file))); },
    },
    fileManager: {
      processFrontMatter: async (file, change) => {
        effects.push(["frontmatter", file.path]);
        const match = /^---\r?\n(.*?)\r?\n---\r?\n([\s\S]*)$/.exec(texts.get(file));
        const properties = JSON.parse(match[1]); change(properties);
        texts.set(file, `---\n${JSON.stringify(properties)}\n---\n${match[2]}`);
      },
      renameFile: async (file, path) => { effects.push(["rename", file.path, path]); relocate(file, path); },
    },
  };
  const plugin = new FilePlacer(app);
  const merge = plugin.merge.bind(plugin);
  plugin.merge = (...args) => { dispatches.push(args); return merge(...args); };
  t.after(() => { plugin.onunload(); for (const modal of modals) modal.close(); });
  function prompt(from = source, into = target) {
    plugin.askToMerge(from, into);
    const modal = modals.at(-1);
    const button = text => [...modal.contentEl.querySelectorAll("button")].find(el => el.textContent === text);
    const mergeButton = button("Merge"), cancelButton = button("Cancel");
    return { modal, mergeButton, confirm: callbacks.get(mergeButton), cancel: () => cancelButton.click() };
  }
  function snapshot() {
    return { entries: [...files], paths: [...files.values()].map(file => [file, file.path]), texts: [...texts] };
  }
  function assertMerged(folder = "Merged originals", beforeSource = sourceText, beforeTarget = targetText, result = mergedText) {
    assert.equal(texts.get(target), result);
    assert.equal(texts.get(source), beforeSource);
    assert.equal(source.path, `${folder}/Source.md`);
    assert.equal(files.get(source.path), source);
    assert.equal(files.get("Into/Target.md"), target);
    assert.equal(files.has("From/Source.md"), false);
    assert.deepEqual(Object.fromEntries([...files].filter(([path]) => path.endsWith(".md.txt")).map(([path, file]) => [path, texts.get(file)])), {
      [`${folder}/Target (before merge).md.txt`]: beforeTarget,
      [`${folder}/Source (before merge).md.txt`]: beforeSource,
    });
    assert.deepEqual(effects.map(([kind]) => kind), ["mkdir", "create", "create", "process", "frontmatter", "rename"]);
    assert.equal(plugin.merging, false);
  }
  return { plugin, app, files, texts, source, target, effects, dispatches, relocate, add, prompt, snapshot, assertMerged };
}

const mutations = {
  "source renamed": f => f.relocate(f.source, "From/Renamed.md"),
  "source moved with same basename": f => f.relocate(f.source, "Elsewhere/Source.md"),
  "target renamed": f => f.relocate(f.target, "Into/Renamed.md"),
  "target moved with same basename": f => f.relocate(f.target, "Elsewhere/Target.md"),
  "source deleted": f => f.files.delete(f.source.path),
  "target deleted": f => f.files.delete(f.target.path),
  "source replaced at same path": f => f.add(f.source.path, "replacement source"),
  "target replaced at same path": f => f.add(f.target.path, "replacement target"),
  "originals folder changed": f => { f.plugin.settings.mergedFolder = "Other originals"; },
  "originals folder made invalid": f => { f.plugin.settings.mergedFolder = "../outside"; },
};
for (const [name, mutate] of Object.entries(mutations)) {
  test(`single prompt: ${name} rejects before dispatch or writes`, async t => {
    const f = fixture(t), p = f.prompt();
    const displayed = p.modal.containerEl.textContent;
    mutate(f); const before = f.snapshot();
    assert.equal(p.modal.containerEl.textContent, displayed, "prompt still represents initial intent");
    p.mergeButton.click(); await settle();
    // Check writes first so baseline proves real mutations, not only dispatch.
    assert.deepEqual(f.effects, [], "no folder, snapshot, target, properties or archive operation");
    assert.deepEqual(f.snapshot(), before, "all synthetic contents/identities/paths unchanged");
    assert.deepEqual(f.dispatches, [], "rejected before merge dispatch");
    assert.match(notices.join("\n"), /[Cc]hoose the notes again/);
    assert.equal(p.modal.opened, false);
    const noticesBefore = [...notices]; p.confirm(); await settle();
    assert.deepEqual(notices, noticesBefore, "rejected prompt is consumed");
    assert.deepEqual(f.effects, []);
  });
}

test("unchanged native confirmation preserves exact snapshots, body, properties and archive", async t => {
  const f = fixture(t), p = f.prompt();
  assert.match(p.modal.titleEl.textContent, /Merge "Source" into "Target"/);
  assert.match(p.modal.contentEl.textContent, /Merged originals/);
  p.mergeButton.click(); await settle(); f.assertMerged();
  assert.deepEqual(f.dispatches, [[f.source, f.target]]);
  assert.deepEqual(notices, ['Merged "Source" into "Target".']);
});

test("prompt displays full immutable source and target paths", t => {
  const f = fixture(t), p = f.prompt();
  assert.ok(p.modal.contentEl.textContent.includes("From/Source.md"));
  assert.ok(p.modal.contentEl.textContent.includes("Into/Target.md"));
});

for (const close of ["cancel", "external close", "unload"]) {
  test(`${close}: retained button callback cannot dispatch or write`, async t => {
    const f = fixture(t), p = f.prompt(), before = f.snapshot();
    if (close === "cancel") p.cancel();
    else if (close === "external close") p.modal.close();
    else f.plugin.onunload();
    p.confirm(); p.mergeButton.click(); await settle();
    assert.deepEqual(f.effects, []); assert.deepEqual(f.snapshot(), before);
    assert.deepEqual(f.dispatches, []); assert.deepEqual(notices, []);
    assert.equal(p.modal.opened, false);
  });
}

test("consumed confirmation stays single-use after the first merge completes", async t => {
  const f = fixture(t), p = f.prompt(); p.mergeButton.click(); await settle(); f.assertMerged();
  const before = f.snapshot(), effects = [...f.effects]; notices.length = 0;
  p.confirm(); p.mergeButton.click(); await settle();
  assert.deepEqual(f.effects, effects); assert.deepEqual(f.snapshot(), before);
  assert.equal(f.dispatches.length, 1); assert.deepEqual(notices, []);
});

test("consumed confirmation stays single-use while its merge awaits reads", async t => {
  const f = fixture(t), p = f.prompt();
  let release; const gate = new Promise(resolve => { release = resolve; });
  const read = f.app.vault.read; f.app.vault.read = async file => { await gate; return read(file); };
  p.mergeButton.click(); p.confirm(); p.confirm();
  try { assert.equal(f.dispatches.length, 1); assert.deepEqual(notices, []); }
  finally { release(); await settle(); }
  f.assertMerged();
});

test("retained second prompt cannot merge an already archived source again (synthetic coexistence)", async t => {
  const f = fixture(t), first = f.prompt(), second = f.prompt();
  first.mergeButton.click(); await settle(); f.assertMerged();
  const before = f.snapshot(); f.effects.length = 0; f.dispatches.length = 0; notices.length = 0;
  second.confirm(); await settle();
  assert.deepEqual(f.effects, []); assert.deepEqual(f.snapshot(), before); assert.deepEqual(f.dispatches, []);
  assert.match(notices.join("\n"), /[Cc]hoose the notes again/);
});

test("fresh prompt after rejected destination change merges into the newly displayed folder", async t => {
  const f = fixture(t), stale = f.prompt(); f.plugin.settings.mergedFolder = "Other originals";
  stale.mergeButton.click(); await settle();
  assert.deepEqual(f.effects, []); assert.deepEqual(f.dispatches, []);
  const fresh = f.prompt(); assert.ok(fresh.modal.contentEl.textContent.includes("Other originals"));
  fresh.mergeButton.click(); await settle(); f.assertMerged("Other originals");
});

test("fresh prompt after rejected source move uses current path and keeps exact contents", async t => {
  const f = fixture(t), stale = f.prompt(); f.relocate(f.source, "Elsewhere/Source.md");
  stale.mergeButton.click(); await settle(); assert.deepEqual(f.effects, []);
  const fresh = f.prompt(); assert.ok(fresh.modal.contentEl.textContent.includes("Elsewhere/Source.md"));
  fresh.mergeButton.click(); await settle(); f.assertMerged();
  assert.equal(f.files.has("Elsewhere/Source.md"), false);
});

test("normalized-equivalent destination setting still accepts unchanged displayed intent", async t => {
  const f = fixture(t); f.plugin.settings.mergedFolder = "Backups/Originals"; f.add("Backups");
  const p = f.prompt(); f.plugin.settings.mergedFolder = " Backups\\Originals ";
  p.mergeButton.click(); await settle(); f.assertMerged("Backups/Originals");
});

test("contents edited while prompt is open are read at confirmation", async t => {
  const f = fixture(t), p = f.prompt();
  const latestSource = sourceText.replace("repeat\r\nrepeat", "latest source"), latestTarget = targetText + "\nlatest target";
  f.texts.set(f.source, latestSource); f.texts.set(f.target, latestTarget);
  p.mergeButton.click(); await settle();
  f.assertMerged("Merged originals", latestSource, latestTarget,
    mergedText.replace("target line\n\n", "target line\nlatest target\n\n").replace("repeat\r\nrepeat", "latest source"));
});

test("confirmation-disabled behavior still runs actual merge without a modal", async t => {
  const f = fixture(t); f.plugin.settings.askBeforeMerge = false;
  f.plugin.askToMerge(f.source, f.target); await settle();
  assert.equal(modals.length, 0); f.assertMerged(); assert.equal(f.dispatches.length, 1);
});

test("unload rejects a late request even with confirmation disabled", async t => {
  const f = fixture(t); f.plugin.settings.askBeforeMerge = false; f.plugin.onunload();
  f.plugin.askToMerge(f.source, f.target); await settle();
  assert.deepEqual(f.effects, []); assert.deepEqual(f.dispatches, []); assert.equal(modals.length, 0);
});

test("separate valid prompts retain the existing merge lock", async t => {
  const f = fixture(t), first = f.prompt(), second = f.prompt();
  let release; const gate = new Promise(resolve => { release = resolve; });
  const read = f.app.vault.read; f.app.vault.read = async file => { await gate; return read(file); };
  first.mergeButton.click(); second.mergeButton.click(); await settle();
  try { assert.match(notices.join("\n"), /Another merge is still running/); assert.deepEqual(f.effects, []); }
  finally { release(); await settle(); }
  f.assertMerged();
});
