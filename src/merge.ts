// Merging one note into another without losing a line. Plain text work, kept apart from
// Obsidian so it can be checked on its own.

const FRONTMATTER = /^---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

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
	const lines = body.split("\n");
	const first = lines.find((line) => line.trim() !== "");
	let fence: string | null = null;
	const moved = lines.map((line) => {
		const marker = FENCE.exec(line)?.[1];
		if (marker) {
			if (fence === null) fence = marker;
			else if (marker[0] === fence[0] && marker.length >= fence.length && line.slice(line.indexOf(marker) + marker.length).trim() === "") fence = null;
			return line;
		}
		return fence === null ? line.replace(/^(#{1,5})(?=[ \t])/, "#$1") : line;
	});
	const text = moved.join("\n").replace(/^(?:[ \t]*\r?\n)+/, "").trimEnd();
	if (first !== undefined && /^#[ \t]/.test(first)) return text;
	return text ? `## ${title}\n\n${text}` : `## ${title}`;
}

export function mergeBodies(targetBody: string, sourceBody: string, sourceTitle: string): string {
	const top = targetBody.trimEnd();
	const section = asSection(sourceBody, sourceTitle);
	return `${top ? `${top}\n\n` : ""}${section}\n`;
}

// True when every non-blank line of the originals is still in the merged text (headings
// count by their words, so a heading moved one level down still counts).
export function keepsEveryLine(merged: string, originals: string[]): boolean {
	const have = lineCounts(merged);
	for (const [line, count] of lineCounts(originals.join("\n"))) {
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

function lineCounts(text: string): Map<string, number> {
	const counts = new Map<string, number>();
	for (const line of text.split("\n")) {
		const key = line.replace(/^#{1,6}[ \t]+/, "").trim();
		if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

const isEmpty = (value: unknown) => value === undefined || value === null || value === "";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value]);
