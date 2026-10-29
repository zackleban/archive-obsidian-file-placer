// Merging one note into another without losing a line. Plain text work, kept apart from
// Obsidian so it can be checked on its own.

const FRONTMATTER = /^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;
const FENCE = /^ {0,3}(`{3,}|~{3,})([\s\S]*)$/;
const ATX = /^( {0,3})(#{1,6})(?=[ \t]|$)([\s\S]*)$/;

export interface NoteParts {
	// The frontmatter block exactly as written, "---" lines included; "" when there is none.
	head: string;
	// The YAML between the "---" lines, or null when there is no frontmatter.
	frontmatter: string | null;
	body: string;
}

export function splitNote(text: string): NoteParts {
	const match = FRONTMATTER.exec(text);
	if (!match) return { head: "", frontmatter: null, body: text };
	return { head: match[0], frontmatter: match[1] ?? "", body: text.slice(match[0].length) };
}

// The dropped note as a section of the note it was dropped on: its headings go one level
// down (never inside code blocks), under a "## <title>" heading unless it starts with its own "#" one.
export function asSection(body: string, title: string): string {
	const lines = scanLines(body);
	const first = lines.find(({ text }) => text.trim() !== "");
	const moved = lines.map(({ text, heading }) => {
		if (!heading || heading[2].length === 6) return text;
		const indent = heading[1].length;
		return text.slice(0, indent) + "#" + text.slice(indent);
	});
	const text = moved.join("\n").replace(/^(?:[ \t]*\r?\n)+/, "").trimEnd();
	if (first?.heading?.[2].length === 1) return text;
	return text ? `## ${title}\n\n${text}` : `## ${title}`;
}

export function mergeBodies(targetBody: string, sourceBody: string, sourceTitle: string): string {
	const top = targetBody.trimEnd();
	const section = asSection(sourceBody, sourceTitle);
	return `${top ? `${top}\n\n` : ""}${section}\n`;
}

// A multiset safeguard, not a Markdown equivalence proof: ignore outer whitespace
// and supported heading levels, but retain empty headings, literal syntax and counts.
export function keepsEveryLine(merged: string, originals: string[]): boolean {
	const have = lineCounts(merged);
	const needed = new Map<string, number>();
	// Each original is its own document, including any unclosed fence.
	for (const original of originals) {
		for (const [line, count] of lineCounts(original)) needed.set(line, (needed.get(line) ?? 0) + count);
	}
	for (const [line, count] of needed) {
		if ((have.get(line) ?? 0) < count) return false;
	}
	return true;
}

// Adds the dropped note's properties to the target's. Nothing is dropped: when both notes
// have a different value for the same property, it becomes a list of both.
export function mergeProperties(target: Record<string, unknown>, source: Record<string, unknown>) {
	for (const [key, value] of Object.entries(source)) {
		const before = Object.prototype.hasOwnProperty.call(target, key) ? target[key] : undefined;
		if (isEmpty(value) || same(before, value)) continue;
		if (isEmpty(before)) {
			Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
			continue;
		}
		const all = [...asList(before), ...asList(value)];
		Object.defineProperty(target, key, { value: all.filter((item, i) => all.findIndex((other) => same(item, other)) === i), writable: true, enumerable: true, configurable: true });
	}
}

// Deliberately bounded top-level ATX/fence scanner, shared by demotion and the
// safeguard. It does not parse list/quote containers, HTML or multiline inline code.
function scanLines(text: string) {
	let fence: string | null = null;
	return text.split("\n").map((text) => {
		const line = text.replace(/\r$/, ""); // Syntax only; keep original CRLF bytes.
		const marker = FENCE.exec(line);
		let heading: RegExpExecArray | null = null;
		if (fence !== null) {
			if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && /^[ \t]*$/.test(marker[2])) fence = null;
		} else if (marker && (marker[1][0] === "~" || !marker[2].includes("`"))) {
			fence = marker[1];
		} else {
			heading = ATX.exec(line);
		}
		return { text, heading };
	});
}

function lineCounts(text: string): Map<string, number> {
	const counts = new Map<string, number>();
	for (const { text: line, heading } of scanLines(text)) {
		if (!heading && !line.trim()) continue;
		// Typed keys prevent a heading/wrapper from replacing ordinary content.
		// An empty heading still has a key; closing hashes are retained as written.
		const key = heading ? `heading:${heading[3].trim()}` : `text:${line.trim()}`;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

const isEmpty = (value: unknown) => value === undefined || value === null || value === "";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]);
