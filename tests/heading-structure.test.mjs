import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { load } from "./helpers.mjs";
const source = process.env.FILE_PLACER_SOURCE ?? "src/main.ts";
const { asSection, mergeBodies, keepsEveryLine } = await load(join(dirname(source), "merge.ts"));

// Exact expected text is independent of the implementation and keeps its existing
// outer-blank trimming / LF separator policy. Internal CRLF is preserved.
for (const [name, input, output] of [
  ["indented H1", "  # Heading\nBody", "  ## Heading\nBody"],
  ["inline triple-backtick span", "```inline```\n# Heading", "## Source\n\n```inline```\n## Heading"],
  ["empty H1", "#\nBody", "##\nBody"],
]) {
  test(`heading structure baseline: ${name}`, () => assert.equal(asSection(input, "Source"), output));
  test(`heading preservation baseline: ${name}`, () => assert.equal(keepsEveryLine(output, [input]), true));
}

for (const eol of ["\n", "\r\n"]) {
  const label = eol === "\n" ? "LF" : "CRLF";
  for (let indent = 0; indent <= 3; indent++) {
    for (const tail of [" Heading ###  ", "\tHeading", "", " \t"]) {
      test(`heading structure ${label}: indent ${indent}, tail ${JSON.stringify(tail)}`, () => {
        const lines = Array.from({length: 6}, (_, i) => `${" ".repeat(indent)}${"#".repeat(i + 1)}${tail}`);
        const input = [...lines, "Body"].join(eol);
        const expected = [...lines.map((line, i) => i < 5 ? `${" ".repeat(indent)}#${line.slice(indent)}` : line), "Body"].join(eol);
        assert.equal(asSection(input, "Source"), expected);
        assert.equal(keepsEveryLine(expected, [input]), true);
      });
    }
  }
  for (const invalid of ["    # Code", "\t# Code", " #no-space", "####### Too many", "\\# Escaped", "#\u00a0NBSP", "#\vVT", "#\fFF", "#\rbare CR"]) {
    test(`heading structure ${label}: invalid ${JSON.stringify(invalid)}`, () => {
      const body = `${invalid}${eol}# Later`;
      const expected = `## Source\n\n${invalid}${eol}## Later`;
      assert.equal(asSection(body, "Source"), expected);
      assert.equal(keepsEveryLine(expected, [body]), true);
      assert.equal(keepsEveryLine("## Source\n\n## Later", [body]), false);
    });
  }
  for (const [name, lines, moved] of [
    ["backtick block and longer indented closer", ["  ```md", "# literal", "   ````\t ", "# Later"], ["  ```md", "# literal", "   ````\t ", "## Later"]],
    ["tilde info can contain backticks", ["~~~a`b", "# literal", "~~~", "# Later"], ["~~~a`b", "# literal", "~~~", "## Later"]],
    ["short wrong type and content closers stay inside", ["````", "```", "# short", "~~~~", "# type", "```` tail", "# tail", "````", "# Later"], ["````", "```", "# short", "~~~~", "# type", "```` tail", "# tail", "````", "## Later"]],
    ["four-space and NBSP closers stay inside", ["~~~", "    ~~~", "# indent", "~~~\u00a0", "# nbsp", "~~~", "# Later"], ["~~~", "    ~~~", "# indent", "~~~\u00a0", "# nbsp", "~~~", "## Later"]],
    ["unclosed block", ["```", "# literal", "## literal too"], ["```", "# literal", "## literal too"]],
    ["backtick in info rejects opening", ["```lang`x", "# Later"], ["```lang`x", "## Later"]],
    ["inline span after prose", ["Text ```inline```", "# Later"], ["Text ```inline```", "## Later"]],
    ["indented fence is ordinary text", ["    ```", "# Later"], ["    ```", "## Later"]],
  ]) {
    test(`heading structure ${label}: ${name}`, () => {
      const input = lines.join(eol);
      const expected = `## Source\n\n${moved.join(eol)}`;
      assert.equal(asSection(input, "Source"), expected);
      assert.equal(keepsEveryLine(expected, [input]), true);
    });
  }
  test(`heading structure ${label}: first nonblank H1 and outer whitespace`, () => {
    assert.equal(asSection(`${eol} \t${eol}   #${eol}Body  ${eol}${eol}`, "Source"), `   ##${eol}Body`);
    assert.equal(asSection(`## Heading${eol}Body`, "Source"), `## Source\n\n### Heading${eol}Body`);
    assert.equal(asSection(" \t\r\n", "Source"), "## Source");
  });
}

for (const [name, merged, originals, expected] of [
  ["empty heading demotion", "##", ["#"], true],
  ["whitespace empty heading cannot vanish", "Body", ["# \t\nBody"], false],
  ["empty headings retain multiplicity", "##\n##", ["#\n#"], true],
  ["duplicate empty heading cannot vanish", "##", ["#\n#"], false],
  ["empty headings counted across originals", "##", ["#", "#"], false],
  ["ordinary repeats counted across originals", "Keep", ["Keep", "Keep"], false],
  ["missing ordinary line", "## Heading", ["# Heading\nKeep"], false],
  ["heading cannot stand in for ordinary text", "## Keep\n## Keep", ["Keep\n# Keep"], false],
  ["ordinary text cannot stand in for heading", "Keep\nKeep", ["Keep\n# Keep"], false],
  ["closing hashes are retained syntax", "## Heading", ["# Heading ###"], false],
  ["fenced heading stays literal", "```\n## Code\n```", ["```\n# Code\n```"], false],
  ["indented code heading stays literal", "## Code", ["    # Code"], false],
  ["invalid heading hashes are content", "## text", ["####### text"], false],
  ["ordinary hash-only text is content", "##", ["#######"], false],
  ["fence state resets between original documents", "```\n# literal\n```\n## Heading", ["```\n# literal", "```\n# Heading"], false],
  ["unclosed target rejects changed heading context", "```\n\n## Heading\nBody\n", ["```", "# Heading\nBody"], false],
]) test(`heading preservation: ${name}`, () => assert.equal(keepsEveryLine(merged, originals), expected));

test("heading preservation: real merge keeps repeated headings and ordinary lines separately", () => {
  const target = "# Keep\nKeep\n#\nKeep";
  const from = "  # Keep\nKeep\n#\n#\n```inline```\n# Later";
  const expected = "# Keep\nKeep\n#\nKeep\n\n  ## Keep\nKeep\n##\n##\n```inline```\n## Later\n";
  assert.equal(mergeBodies(target, from, "Source"), expected);
  assert.equal(keepsEveryLine(expected, [target, from]), true);
  assert.equal(keepsEveryLine(expected.replace("Keep\n##\n##", "Keep\n##"), [target, from]), false);
});

// Unicode line/paragraph separators are literal characters in this LF/CRLF
// contract. JavaScript dot must not accidentally reject their enclosing line.
for (const character of ["\u2028", "\u2029"]) {
  for (const eol of ["\n", "\r\n"]) {
    test(`heading structure: literal U+${character.codePointAt(0).toString(16)} ${JSON.stringify(eol)}`, () => {
      const heading = `# A${character}B${eol}Body`;
      assert.equal(asSection(heading, "Source"), `## A${character}B${eol}Body`);
      const fenced = ["```lang" + character + "x", "# literal", "```", "# Later"].join(eol);
      const expected = "## Source\n\n" + ["```lang" + character + "x", "# literal", "```", "## Later"].join(eol);
      assert.equal(asSection(fenced, "Source"), expected);
      assert.equal(keepsEveryLine(expected, [fenced]), true);
    });
  }
}
