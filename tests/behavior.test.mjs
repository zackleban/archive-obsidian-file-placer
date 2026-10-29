import test from "node:test";
import assert from "node:assert/strict";
import { load, TFile, TFolder } from "./helpers.mjs";
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
function fixture() {
  const files = new Map(); const texts = new Map();
  const root = new TFolder("/"); files.set("/",root);
  const add = (path,text) => {const f = new TFile(path); f.parent=root; root.children.push(f); files.set(path,f); texts.set(f,text); return f;};
  const source=add("Source.md","# Source\nsource line\n"); const target=add("Target.md","target line\n");
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
