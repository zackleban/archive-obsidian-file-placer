// Placed order inside one folder: the children's names, top to bottom.

// Puts `moving` at the anchor (before it, or after it), or first when there is no anchor.
export function placeNames(current: string[], moving: string[], anchor: string | null, after: boolean): string[] {
	const rest = current.filter((name) => !moving.includes(name));
	let index = anchor === null ? 0 : rest.indexOf(anchor);
	if (index === -1) index = rest.length;
	else if (anchor !== null && after) index += 1;
	return [...rest.slice(0, index), ...moving, ...rest.slice(index)];
}

// Orders `items` (already in the normal sort) by the placed names. Items that were never
// placed, like a new note, stay right after the item they follow in the normal sort.
export function arrange<T>(items: T[], nameOf: (item: T) => string, order: string[]): T[] {
	const rank = new Map(order.map((name, i) => [name, i]));
	const result = items.filter((item) => rank.has(nameOf(item)));
	result.sort((a, b) => (rank.get(nameOf(a)) ?? 0) - (rank.get(nameOf(b)) ?? 0));
	if (result.length === items.length) return result;
	let previous: T | null = null;
	for (const item of items) {
		if (!rank.has(nameOf(item))) result.splice(previous === null ? 0 : result.indexOf(previous) + 1, 0, item);
		previous = item;
	}
	return result;
}
