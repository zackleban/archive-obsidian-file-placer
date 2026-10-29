import test from "node:test";
import assert from "node:assert/strict";
import { load, TFile, TFolder, notices } from "./helpers.mjs";
import { sourcePath, targetPath, sourceText, targetText, fixtureFiles } from "./fixtures/merge-recovery.mjs";
const { asSection, mergeBodies, keepsEveryLine, splitNote, mergeProperties } = await load("src/merge.ts");
const { arrange, placeNames } = await load("src/order.ts");
const { default: FilePlacer } = await load("src/main.ts");

test("headings move down but nested short fences and code stay intact", () => {
  const source = "# Title\n\n````md\n```\n# code heading\n````\n## End";
  assert.equal(asSection(source, "Other"), "## Title\n\n````md\n```\n# code heading\n````\n### End");
  assert.ok(keepsEveryLine(mergeBodies("Keep\nKeep", source, "Title"), ["Keep\nKeep", source]));
  assert.equal(keepsEveryLine("Keep", ["Keep\nKeep"]), false);
});
test("frontmatter preserves CRLF and empty blocks", () => {
  assert.deepEqual(splitNote("---\r\nx: 1\r\n---\r\nBody"), {head:"---\r\nx: 1\r\n---\r\n", frontmatter:"x: 1",body:"Body"});
  assert.equal(splitNote("---\n---\nBody").frontmatter, "");
  assert.equal(splitNote("---\nunclosed").head, "");
});
test("property conflicts deduplicate and special keys do not mutate prototypes", () => {
  const target = { tags: ["a"], status: "open" };
  mergeProperties(target, JSON.parse('{"tags":["a","b"],"status":"done","__proto__":{"polluted":true},"constructor":"value"}'));
  assert.deepEqual(target.tags, ["a","b"]);
  assert.deepEqual(target.status, ["open","done"]);
  assert.equal(Object.getPrototypeOf(target), Object.prototype);
  assert.deepEqual(target.__proto__, {polluted:true});
  assert.equal(target.constructor, "value");
});
test("placed order moves selections without duplication and keeps new notes adjacent", () => {
  assert.deepEqual(placeNames(["a","b","c","d"], ["a","b"], "c", true), ["c","a","b","d"]);
  assert.deepEqual(placeNames(["a"], ["b"], null, false), ["b","a"]);
  assert.deepEqual(arrange(["a","new","b","c"], x => x, ["c","a","b"]), ["c","a","new","b"]);
});
function fixture(initial = { "Source.md": "# Source\nsource line\n", "Target.md": "target line\n" }, paths = ["Source.md", "Target.md"]) {
  const files = new Map(); const texts = new Map();
  const root = new TFolder("/"); files.set("/",root);
  const add = (path,text) => {const f = new TFile(path); f.parent=root; root.children.push(f); files.set(path,f); texts.set(f,text); return f;};
  for (const [path, text] of Object.entries(initial)) add(path, text);
  const [source, target] = paths.map(path => files.get(path));
  const vault={
    getAbstractFileByPath:path=>files.get(path), read:async f=>texts.get(f),
    createFolder:async path=>{const f=new TFolder(path); files.set(path,f); return f;},
    create:async (path,text)=>{if(files.has(path))throw Error("exists"); return add(path,text);},
    process:async (f,fn)=>{texts.set(f,fn(texts.get(f)));},
  };
  const app={vault,workspace:{getLeavesOfType:()=>[]},fileManager:{
    renameFile:async(f,path)=>{files.delete(f.path);f.path=path;files.set(path,f);},
    processFrontMatter:async()=>{},
  }};
  const plugin=new FilePlacer(app);
  return {plugin,app,vault,files,texts,source,target};
}
test("merge keeps exact snapshots and archives source after successful write", async()=>{
  const {plugin,texts,files,source,target}=fixture();
  await plugin.merge(source,target);
  assert.equal(source.path,"Merged originals/Source.md");
  assert.equal(texts.get(files.get("Merged originals/Source (before merge).md.txt")),"# Source\nsource line\n");
  assert.equal(texts.get(files.get("Merged originals/Target (before merge).md.txt")),"target line\n");
  assert.match(texts.get(target),/target line\n\n## Source\nsource line/);
});
test("concurrent target edits abort without overwriting or moving source",async()=>{
  const {plugin,vault,texts,source,target}=fixture();
  vault.process=async(f,fn)=>{texts.set(f,"new editor content");texts.set(f,fn(texts.get(f)));};
  await assert.rejects(plugin.merge(source,target),/target changed/);
  assert.equal(texts.get(target),"new editor content"); assert.equal(source.path,"Source.md");
});
test("failed backup and target write leave original source in place",async()=>{
  for(const failure of ["create","process"]){
    const {plugin,vault,texts,source,target}=fixture();
    vault[failure]=async()=>{throw Error("disk full");};
    await assert.rejects(plugin.merge(source,target),/disk full/);
    assert.equal(source.path,"Source.md"); assert.equal(texts.get(target),"target line\n");
  }
});
// Exercise the same error boundary used by the merge UI. Capture expected console
// errors so a passing test does not look like an unhandled failure in QA output.
async function failedMerge(t, plugin, source, target, message) {
  notices.length = 0;
  const logged = t.mock.method(console, "error", () => {});
  try {
    await plugin.safely(() => plugin.merge(source, target));
    assert.deepEqual(notices, [`File Placer: ${message}`]);
    assert.equal(logged.mock.callCount(), 1);
    assert.equal(logged.mock.calls[0].arguments[1].message, message);
    assert.equal(plugin.merging, false);
  } finally {
    logged.mock.restore();
  }
}
function snapshots({ files, texts }) {
  return Object.fromEntries([...files].filter(([path]) => path.endsWith(".md.txt"))
    .map(([path, file]) => [path, texts.get(file)]));
}
const initialSnapshots = {
  "Merged originals/Target (before merge).md.txt": targetText,
  "Merged originals/Source (before merge).md.txt": sourceText,
};
function recoveryFixture() {
  const state = fixture(fixtureFiles, [sourcePath, targetPath]);
  // Simulate the public API callback with the fixture's JSON-compatible YAML.
  // Real YAML formatting and link maintenance remain live-app checks.
  state.app.fileManager.processFrontMatter = async (file, change) => {
    const parts = splitNote(state.texts.get(file));
    const properties = JSON.parse(parts.frontmatter);
    change(properties);
    state.texts.set(file, `---\n${JSON.stringify(properties)}\n---\n${parts.body}`);
  };
  return state;
}
test("second snapshot failure retains the first exact snapshot and both originals, with a visible error", async t => {
  const state = recoveryFixture();
  const { plugin, vault, files, texts, source, target } = state;
  const create = vault.create;
  const created = [];
  vault.create = async (path, text) => {
    created.push(path);
    if (created.length === 2) throw Error("source snapshot: disk full");
    return create(path, text);
  };
  await failedMerge(t, plugin, source, target, "source snapshot: disk full");
  assert.deepEqual(created, Object.keys(initialSnapshots));
  assert.deepEqual(snapshots(state), { [created[0]]: targetText });
  assert.equal(texts.get(source), sourceText);
  assert.equal(texts.get(target), targetText);
  assert.equal(files.get(sourcePath), source);
  assert.equal(source.path, sourcePath);
  assert.equal(files.has("Merged originals/Source.md"), false);
  assert.equal(files.size, Object.keys(fixtureFiles).length + 3); // root, originals folder, one snapshot
});
test("archive failure after writing target preserves source and exact snapshots, with a visible error", async t => {
  const state = recoveryFixture();
  const { plugin, app, files, texts, source, target } = state;
  let attempted = 0;
  app.fileManager.renameFile = async (file, path) => {
    attempted++;
    assert.equal(file, source);
    assert.equal(path, "Merged originals/Source.md");
    assert.ok(keepsEveryLine(splitNote(texts.get(target)).body,
      [splitNote(targetText).body, splitNote(sourceText).body]));
    assert.deepEqual(JSON.parse(splitNote(texts.get(target)).frontmatter),
      { status: ["target", "source"], tags: ["shared", "target", "source"] });
    throw Error("archive rename: permission denied");
  };
  await failedMerge(t, plugin, source, target, "archive rename: permission denied");
  assert.equal(attempted, 1); // No automatic retry.
  assert.deepEqual(snapshots(state), initialSnapshots);
  assert.equal(texts.get(source), sourceText);
  assert.equal(source.path, sourcePath);
  assert.equal(files.get(sourcePath), source);
  assert.equal(files.has("Merged originals/Source.md"), false);
  assert.equal(splitNote(texts.get(target)).body, mergeBodies(splitNote(targetText).body, splitNote(sourceText).body, "Source"));
  for (const [path, text] of Object.entries(fixtureFiles)) {
    if (path !== targetPath) assert.equal(texts.get(files.get(path)), text);
  }
});
test("restore successful and partially failed merges exactly before a deliberate retry", async t => {
  for (const failArchive of [false, true]) {
    const state = recoveryFixture();
    const { plugin, app, vault, files, texts, source, target } = state;
    const rename = app.fileManager.renameFile;
    if (failArchive) {
      app.fileManager.renameFile = async () => { throw Error("archive unavailable"); };
      await failedMerge(t, plugin, source, target, "archive unavailable");
      app.fileManager.renameFile = rename;
    } else {
      await plugin.merge(source, target);
      assert.equal(source.path, "Merged originals/Source.md");
      assert.equal(files.has(sourcePath), false);
    }
    const firstMergedText = texts.get(target);
    assert.deepEqual(snapshots(state), initialSnapshots);
    // README procedure: return the archived source if it moved, then copy the
    // immutable snapshot contents to the original paths. No automatic rollback.
    if (source.path !== sourcePath) await rename(source, sourcePath);
    await vault.process(target, () => texts.get(files.get("Merged originals/Target (before merge).md.txt")));
    await vault.process(source, () => texts.get(files.get("Merged originals/Source (before merge).md.txt")));
    assert.equal(files.get(sourcePath), source);
    assert.equal(files.get(targetPath), target);
    assert.equal(texts.get(source), sourceText); // Including CRLF.
    assert.equal(texts.get(target), targetText); // Including absent final newline.
    assert.deepEqual(snapshots(state), initialSnapshots);
    notices.length = 0;
    await plugin.merge(source, target); // Explicit retry only after exact restoration.
    assert.equal(texts.get(target), firstMergedText); // No duplicate appended section.
    assert.equal(source.path, "Merged originals/Source.md");
    assert.equal(texts.get(source), sourceText);
    assert.deepEqual(notices, ['Merged "Source" into "Target".']);
    assert.deepEqual(snapshots(state), {
      ...initialSnapshots,
      "Merged originals/Target (before merge) 1.md.txt": targetText,
      "Merged originals/Source (before merge) 1.md.txt": sourceText,
    });
    assert.equal(plugin.merging, false);
  }
});
test("merge lock rejects a second operation and clears after completion",async()=>{
  const {plugin,vault,source,target}=fixture();
  let release; const gate=new Promise(resolve=>{release=resolve;}); const read=vault.read;
  vault.read=async f=>{await gate;return read(f);};
  const first=plugin.merge(source,target);
  await assert.rejects(plugin.merge(source,target),/still running/);
  release(); await first;
  assert.equal(plugin.merging,false);
});
test("invalid backup paths, same-note merges and duplicate move names are rejected",async()=>{
  const {plugin,source,target}=fixture();
  for(const path of ["../outside","/absolute",".obsidian/backups","safe/../bad","C:/bad"]){
    plugin.settings.mergedFolder=path;
    await assert.rejects(plugin.merge(source,target),/visible folder path/);
  }
  await assert.rejects(plugin.merge(source,source),/different Markdown/);
  const folder=new TFolder("dest");
  assert.equal(plugin.canHold([new TFile("one/Same.md"),new TFile("two/Same.md")],folder),false);
});
test("corrupt merge preference defaults to confirmation and root special folder names work",async()=>{
  const {plugin}=fixture();plugin.saved={askBeforeMerge:"false",order:JSON.parse('{"__proto__":["a.md"]}')};
  await plugin.loadSettings();
  assert.equal(plugin.settings.askBeforeMerge,true);
  assert.equal(Object.getPrototypeOf(plugin.settings.order),null);
  assert.deepEqual(plugin.settings.order.__proto__,["a.md"]);
});

test("frontmatter at end of file stays separated from the appended section",async()=>{
  const {plugin,texts,source,target}=fixture();texts.set(target,'---\nx: 1\n---');
  await plugin.merge(source,target);assert.match(texts.get(target),/---\n## Source/);
});

test("closed explorer panes release their registered listeners",()=>{
  const {plugin,app}=fixture();const el={doc:{},contains:()=>false};
  app.workspace.getLeavesOfType=()=>[{view:{containerEl:el}}];
  plugin.watchExplorers();const component=plugin.watched.get(el);assert.ok(component);
  app.workspace.getLeavesOfType=()=>[];plugin.watchExplorers();
  assert.equal(plugin.watched.size,0);assert.equal(component.unloaded,true);
});

test("inactive Pinit pins do not override placement while its registry entry remains",()=>{
  const {plugin,app}=fixture();
  const folder=new TFolder("/");
  const items=["a.md","b.md","c.md"].map(path=>({file:new TFile(path)}));
  plugin.settings.order={"/":["c.md","b.md","a.md"]};
  app.plugins={plugins:{"pinit-to-top-or-bottom":{
    settings:{top:["a.md"],bottom:["c.md"]},getActivePins:()=>null,
  }}};
  assert.deepEqual(plugin.arrange(folder,items).map(item=>item.file.path),["c.md","b.md","a.md"]);
});

test("older Pinit versions keep pin priority through the settings fallback",()=>{
  const {plugin,app}=fixture();
  const folder=new TFolder("/");
  const items=["a.md","b.md","c.md"].map(path=>({file:new TFile(path)}));
  plugin.settings.order={"/":["c.md","b.md","a.md"]};
  app.plugins={plugins:{"pinit-to-top-or-bottom":{settings:{top:["a.md"],bottom:["c.md"]}}}};
  assert.deepEqual(plugin.arrange(folder,items).map(item=>item.file.path),["a.md","b.md","c.md"]);
});
