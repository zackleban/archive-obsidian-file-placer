// Filesystem preparation/comparison only. This script never drives Obsidian,
// performs a merge, restores files, or claims an observed link destination.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureFiles, sourcePath, targetPath, sourceText, targetText } from "./fixtures/merge-recovery.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(repo, "../obsidian-plugin-test-vaults");
const [command, argument] = process.argv.slice(2);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

if (command === "prepare") {
  assert.match(argument ?? "", /^[a-z0-9][a-z0-9-]*$/, "Use a new run name containing lowercase letters, digits and hyphens.");
  await mkdir(root, { recursive: true });
  const run = join(root, argument);
  await mkdir(run); // Refuse to overwrite a previous drill or its evidence.
  for (const mode of ["links-on", "links-off"]) {
    const vault = join(run, mode);
    const plugin = join(vault, ".obsidian/plugins/file-placer");
    await mkdir(plugin, { recursive: true });
    for (const [path, text] of Object.entries(fixtureFiles)) {
      const destination = join(vault, path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, text, { flag: "wx" });
    }
    for (const name of ["main.js", "manifest.json", "styles.css"]) {
      await copyFile(join(repo, name), join(plugin, name));
    }
    await writeFile(join(vault, ".obsidian/community-plugins.json"), "[]\n", { flag: "wx" });
    console.log(`Prepared ${vault}; plugin disabled. Set the named link preference in the app before testing.`);
  }
} else if (command === "verify-originals" || command === "verify-snapshots") {
  assert.ok(argument, "Supply the disposable vault path.");
  const vault = await realpath(resolve(argument));
  const allowed = await realpath(root);
  assert.ok(vault.startsWith(allowed + sep), "Only disposable test vaults are allowed.");
  const expected = command === "verify-originals"
    ? { [sourcePath]: sourceText, [targetPath]: targetText }
    : {
      "Merged originals/Source (before merge).md.txt": sourceText,
      "Merged originals/Target (before merge).md.txt": targetText,
    };
  for (const [path, text] of Object.entries(expected)) {
    const actualPath = await realpath(join(vault, path));
    assert.ok(actualPath.startsWith(vault + sep), "Fixture files must remain inside the disposable vault.");
    const actual = await readFile(actualPath);
    const original = Buffer.from(text, "utf8");
    assert.deepEqual(actual, original, `${path} differs from the pre-merge fixture`);
    console.log(`Exact bytes: ${path}; ${actual.length} bytes; SHA-256 ${digest(actual)}`);
  }
} else {
  throw Error("Usage: node tests/recovery-drill.mjs prepare <new-run-name> | verify-originals <disposable-vault> | verify-snapshots <disposable-vault>");
}
