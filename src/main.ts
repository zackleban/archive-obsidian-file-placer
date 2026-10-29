import { App, Component, Menu, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TFolder, View, normalizePath, parseYaml } from "obsidian";
import { around } from "monkey-around";
import { arrange, placeNames } from "./order";
import { keepsEveryLine, mergeBodies, mergeProperties, splitNote } from "./merge";

const FILE_EXPLORER = "file-explorer";
const ROW = ".nav-file-title, .nav-folder-title";
const PINIT = "pinit-to-top-or-bottom";

type Direction = "up" | "down";

const HOVER_CLASS = "file-placer-hover";
const LINE_CLASS: Record<Direction, string> = { up: "file-placer-line-top", down: "file-placer-line-bottom" };
const INTO_CLASS = "file-placer-into";
const SHOWN_CLASSES = [HOVER_CLASS, LINE_CLASS.up, LINE_CLASS.down, INTO_CLASS];

// Holding the mouse still this long over a note merges into it; over a folder, moves into it.
const HOLD_MS = 700;
// Moves smaller than this don't count, so a shaky hand doesn't flip the line.
const STILL_PX = 3;

type Plan =
	| { kind: "place"; row: HTMLElement; side: Direction; files: TAbstractFile[]; folder: TFolder; anchor: TAbstractFile | null; after: boolean }
	| { kind: "into"; row: HTMLElement; files: TAbstractFile[]; folder: TFolder }
	| { kind: "merge"; row: HTMLElement; source: TFile; target: TFile };

interface FilePlacerSettings {
	// Folder path ("/" for the vault root) to its children's names, in the order they were placed.
	order: Record<string, string[]>;
	mergedFolder: string;
	askBeforeMerge: boolean;
}

const DEFAULT_MERGED_FOLDER = "Merged originals";

// Obsidian's file explorer and drag internals; not in the public API (checked against 1.14.5).
// Each folder's children are sorted by getSortedFolderItems, so wrapping it shows the placed order.
interface FileExplorerItem {
	file: TAbstractFile;
	el?: HTMLElement;
}

interface FileExplorerView extends View {
	getSortedFolderItems(folder: TFolder): FileExplorerItem[];
	requestSort(): void;
}

interface DragManager {
	draggable: { type: string; file?: TAbstractFile; files?: TAbstractFile[] } | null;
	setAction(action: string | null): void;
}

interface PinSettings {
	top?: unknown;
	bottom?: unknown;
}

interface InternalApp extends App {
	dragManager?: DragManager;
	plugins?: { plugins: Record<string, { settings?: PinSettings; getActivePins?: () => PinSettings | null } | undefined> };
}

const parentOf = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "/");
const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
const isAtOrUnder = (path: string, base: string) => path === base || path.startsWith(base + "/");
const childPath = (folder: TFolder, name: string) => (folder.isRoot() ? name : `${folder.path}/${name}`);
const isNote = (file: TAbstractFile): file is TFile => file instanceof TFile && file.extension === "md";
const strings = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((p): p is string => typeof p === "string") : [];

export default class FilePlacerPlugin extends Plugin {
	settings: FilePlacerSettings = { order: {}, mergedFolder: DEFAULT_MERGED_FOLDER, askBeforeMerge: true };
	private unpatch: (() => void) | null = null;
	private unsupported = false;
	private merging = false;
	private unloaded = false;
	private watched = new Map<HTMLElement, Component>();
	private plan: Plan | null = null;
	private shownEl: HTMLElement | null = null;
	// The mouse during a drag: where it last moved, when, which way, and the row it is over.
	private mouse = { x: NaN, y: NaN, at: 0, direction: "down" as Direction, row: null as HTMLElement | null };

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new FilePlacerSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFolder && this.settings.order[file.path]) this.addResetItem(menu, file.path);
			})
		);
		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.onRename(file, oldPath)));
		this.registerEvent(this.app.vault.on("delete", (file) => this.onDelete(file.path)));

		this.app.workspace.onLayoutReady(() => {
			if (this.unloaded) return;
			this.patchFileExplorer();
			// The file explorer can load later (a deferred sidebar tab, or re-enabled core plugin).
			this.registerEvent(this.app.workspace.on("layout-change", () => this.patchFileExplorer()));
		});
	}

	onunload() {
		this.unloaded = true;
		this.endDrag();
		for (const component of this.watched.values()) this.removeChild(component);
		this.watched.clear();
		this.unpatch?.();
		this.unpatch = null;
		this.forEachExplorer((view) => view.requestSort());
	}

	async place(files: TAbstractFile[], folder: TFolder, anchor: TAbstractFile | null, after: boolean) {
		const order = placeNames(this.namesIn(folder), files.map((f) => f.name), anchor?.name ?? null, after);
		await this.moveInto(files, folder);
		this.settings.order[folder.path] = order;
		await this.saveSettings();
	}

	// Nothing is deleted: the note dropped on keeps its place and gets the dragged note added under
	// it, and both originals, untouched, go to the merged originals folder.
	async merge(source: TFile, target: TFile) {
		if (this.merging) throw new Error("Another merge is still running. Try again when it finishes.");
		if (source === target || !isNote(source) || !isNote(target)) throw new Error("Choose two different Markdown notes.");
		this.merging = true;
		try {
			await this.mergeNotes(source, target);
		} finally {
			this.merging = false;
		}
	}

	private async mergeNotes(source: TFile, target: TFile) {
		const { vault, fileManager } = this.app;
		if (vault.getAbstractFileByPath(source.path) !== source || vault.getAbstractFileByPath(target.path) !== target) {
			throw new Error("A note was moved or deleted. Choose the notes again.");
		}
		const folderPath = this.mergedFolder();
		const [sourceText, targetText] = await Promise.all([vault.read(source), vault.read(target)]);
		const from = splitNote(sourceText);
		const into = splitNote(targetText);

		let sourceBody = from.body;
		let properties: Record<string, unknown> | null = null;
		if (from.frontmatter !== null) {
			try {
				const parsed: unknown = parseYaml(from.frontmatter);
				if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) properties = parsed as Record<string, unknown>;
			} catch {
				properties = null;
			}
			// Properties that can't be read go into the note as they were written.
			if (!properties && from.frontmatter.trim()) sourceBody = "```yaml\n" + from.frontmatter + "\n```\n\n" + sourceBody;
		}

		if (properties && into.frontmatter?.trim()) {
			const parsed: unknown = parseYaml(into.frontmatter);
			if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The target has invalid properties. Fix its YAML before merging.");
		}

		const body = mergeBodies(into.body, sourceBody, source.basename);
		if (!keepsEveryLine(body, [into.body, sourceBody])) {
			new Notice("File Placer: the merge would have lost a line, so nothing was changed.");
			return;
		}

		// Plain-text snapshots cannot be rewritten by automatic Markdown link updates.
		const folder = await this.ensureFolder(folderPath);
		await vault.create(this.freePath(folder, `${target.basename} (before merge)`, "md.txt"), targetText);
		await vault.create(this.freePath(folder, `${source.basename} (before merge)`, "md.txt"), sourceText);
		if (await vault.read(source) !== sourceText) throw new Error("The source changed during the merge. Originals were kept; retry with the latest note.");
		await vault.process(target, (current) => {
			if (current !== targetText) throw new Error("The target changed during the merge. Originals were kept; retry with the latest note.");
			return into.head + (into.head && !into.head.endsWith("\n") ? "\n" : "") + body;
		});
		if (properties) {
			const added = properties;
			await fileManager.processFrontMatter(target, (frontmatter: Record<string, unknown>) => mergeProperties(frontmatter, added));
		}
		// Rename last: a failed write must never move the source out from under the user.
		// Link maintenance may edit the moved note; the exact source snapshot stays untouched.
		if (await vault.read(source) !== sourceText) throw new Error("The source changed. Merged text and backups were kept; the source was not moved.");
		await fileManager.renameFile(source, this.freePath(folder, source.basename));
		new Notice(`Merged "${source.basename}" into "${target.basename}".`);
	}

	async resetOrder(path: string) {
		delete this.settings.order[path];
		await this.saveSettings();
	}

	mergedFolder(): string {
		const raw = this.settings.mergedFolder.trim() || DEFAULT_MERGED_FOLDER;
		const parts = raw.replace(/\\/g, "/").split("/");
		if (raw.startsWith("/") || parts.some((part) => !part || part.startsWith(".") || /[:*?"<>|]/.test(part))) {
			throw new Error("Choose a visible folder path inside the vault for merged originals.");
		}
		return normalizePath(raw);
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<FilePlacerSettings> | null;
		const order: Record<string, string[]> = Object.create(null) as Record<string, string[]>;
		for (const [path, names] of Object.entries(data?.order ?? {})) order[path] = strings(names);
		this.settings = {
			order,
			mergedFolder: typeof data?.mergedFolder === "string" ? data.mergedFolder : DEFAULT_MERGED_FOLDER,
			askBeforeMerge: typeof data?.askBeforeMerge === "boolean" ? data.askBeforeMerge : true,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.forEachExplorer((view) => view.requestSort());
	}

	private patchFileExplorer() {
		if (this.unloaded) return;
		this.watchExplorers();
		if (this.unpatch || this.unsupported) return;
		const leaf = this.app.workspace.getLeavesOfType(FILE_EXPLORER).find((l) => !l.isDeferred);
		if (!leaf) return;

		const proto = Object.getPrototypeOf(leaf.view) as FileExplorerView;
		if (typeof proto.getSortedFolderItems !== "function" || typeof proto.requestSort !== "function") {
			this.unsupported = true;
			new Notice("File Placer: this version of Obsidian's file explorer is not supported.");
			return;
		}

		const arrangeItems = this.arrange.bind(this);
		this.unpatch = around(proto, {
			getSortedFolderItems(original) {
				return function (this: FileExplorerView, folder: TFolder) {
					return arrangeItems(folder, original.call(this, folder));
				};
			},
		});
		this.forEachExplorer((view) => view.requestSort());
	}

	// Listens in the capture phase, so it runs before the file explorer's own drop handling,
	// which skips any drag event whose default was already prevented.
	private watchExplorers() {
		const live = new Set<HTMLElement>();
		for (const leaf of this.app.workspace.getLeavesOfType(FILE_EXPLORER)) {
			const el = leaf.view.containerEl;
			if (leaf.isDeferred) continue;
			live.add(el);
			if (this.watched.has(el)) continue;
			const component = this.addChild(new Component());
			this.watched.set(el, component);
			component.registerDomEvent(el, "dragstart", (evt) => this.resetMouse(evt.clientX, evt.clientY), true);
			component.registerDomEvent(el.doc, "dragend", () => this.endDrag(), true);
			component.registerDomEvent(el, "dragenter", (evt) => this.onDragOver(evt), true);
			component.registerDomEvent(el, "dragover", (evt) => this.onDragOver(evt), true);
			component.registerDomEvent(el, "dragleave", (evt) => {
				const related = evt.relatedTarget as Node | null;
				if (!(related?.instanceOf(Node) && el.contains(related))) this.show(null);
			}, true);
			component.registerDomEvent(el, "drop", (evt) => this.onDrop(evt), true);
		}
		for (const [el, component] of this.watched) {
			if (live.has(el)) continue;
			this.removeChild(component);
			this.watched.delete(el);
			if (this.shownEl && el.contains(this.shownEl)) this.endDrag();
		}
	}

	private arrange(folder: TFolder, items: FileExplorerItem[]): FileExplorerItem[] {
		const order = this.settings.order[folder.path];
		if (!order) return items;
		// Items pinned by Pinit to Top or Bottom keep their pins.
		const pinit = (this.app as InternalApp).plugins?.plugins[PINIT];
		// New Pinit versions expose only active pins; retain compatibility with older ones.
		const pins = typeof pinit?.getActivePins === "function" ? pinit.getActivePins() : pinit?.settings;
		const top = new Set(strings(pins?.top));
		const bottom = new Set(strings(pins?.bottom));
		const pinned = (item: FileExplorerItem) => top.has(item.file.path) || bottom.has(item.file.path);
		return [
			...items.filter((item) => top.has(item.file.path)),
			...arrange(items.filter((item) => !pinned(item)), (item) => item.file.name, order),
			...items.filter((item) => bottom.has(item.file.path) && !top.has(item.file.path)),
		];
	}

	private onDragOver(evt: DragEvent) {
		if (evt.defaultPrevented || this.unsupported || !this.unpatch) return;
		const plan = this.planFor(evt);
		this.show(plan);
		if (!plan) {
			// Still over the item being dragged: show nothing, and keep Obsidian's own folder highlight off too.
			const row = this.rowAt(evt);
			if (row && this.draggedFiles()?.some((f) => f.path === row.dataset.path)) evt.preventDefault();
			return;
		}
		evt.preventDefault();
		if (evt.dataTransfer) evt.dataTransfer.dropEffect = "move";
		this.dragManager()?.setAction(
			plan.kind === "merge" ? `Merge into ${plan.target.basename}` : plan.kind === "into" ? `Move into ${plan.folder.name}` : "Place here"
		);
	}

	private onDrop(evt: DragEvent) {
		const plan = !evt.defaultPrevented && this.rowAt(evt) === this.plan?.row ? this.plan : null;
		this.endDrag();
		if (!plan) return;
		evt.preventDefault();
		if (plan.kind === "merge") void this.safely(() => { this.askToMerge(plan.source, plan.target); return Promise.resolve(); });
		else if (plan.kind === "into") void this.safely(() => this.moveInto(plan.files, plan.folder));
		else void this.safely(() => this.place(plan.files, plan.folder, plan.anchor, plan.after));
	}

	private planFor(evt: DragEvent): Plan | null {
		const files = this.draggedFiles();
		const row = this.rowAt(evt);
		if (!files || !row) return null;
		const file = this.app.vault.getAbstractFileByPath(row.dataset.path ?? "");
		if (!file || !file.parent || files.includes(file)) return null;
		const held = this.track(evt, row);

		if (held && files.length === 1 && isNote(files[0]) && isNote(file)) return { kind: "merge", row, source: files[0], target: file };
		if (held && file instanceof TFolder && this.canHold(files, file)) return { kind: "into", row, files, folder: file };

		const side = this.mouse.direction;
		// Under an open folder's name is the top of what's inside it.
		if (side === "down" && file instanceof TFolder && file.children.length > 0 && !row.parentElement?.hasClass("is-collapsed")) {
			return this.canHold(files, file) ? { kind: "place", row, side, files, folder: file, anchor: null, after: false } : null;
		}
		const folder = file.parent;
		return this.canHold(files, folder) ? { kind: "place", row, side, files, folder, anchor: file, after: side === "down" } : null;
	}

	private rowAt(evt: DragEvent): HTMLElement | null {
		const target = evt.target as Node | null;
		return target?.instanceOf(Element) ? target.closest<HTMLElement>(ROW) : null;
	}

	// Follows the mouse: the line sits on top of the row while it moves up and under it while it
	// moves down. Returns true once the mouse has held still over the same row for HOLD_MS.
	private track(evt: DragEvent, row: HTMLElement): boolean {
		if (Number.isNaN(this.mouse.x)) this.resetMouse(evt.clientX, evt.clientY);
		const mouse = this.mouse;
		const now = Date.now();
		const dx = evt.clientX - mouse.x;
		const dy = evt.clientY - mouse.y;
		if (Math.abs(dy) >= STILL_PX) mouse.direction = dy < 0 ? "up" : "down";
		if (Math.abs(dx) >= STILL_PX || Math.abs(dy) >= STILL_PX) Object.assign(mouse, { x: evt.clientX, y: evt.clientY, at: now });
		if (row !== mouse.row) Object.assign(mouse, { row, at: now });
		return now - mouse.at >= HOLD_MS;
	}

	private resetMouse(x: number, y: number) {
		this.mouse = { x, y, at: Date.now(), direction: "down", row: null };
	}

	private endDrag() {
		this.show(null);
		this.mouse.x = NaN;
	}

	private show(plan: Plan | null) {
		this.plan = plan;
		const el = plan?.row ?? null;
		if (this.shownEl && this.shownEl !== el) this.shownEl.removeClasses(SHOWN_CLASSES);
		this.shownEl = el;
		if (!plan) return;
		const wanted = [HOVER_CLASS, plan.kind === "place" ? LINE_CLASS[plan.side] : INTO_CLASS];
		for (const cls of SHOWN_CLASSES) plan.row.toggleClass(cls, wanted.includes(cls));
	}

	// A folder can't go inside itself, and a move never replaces something with the same name.
	private canHold(files: TAbstractFile[], folder: TFolder): boolean {
		return new Set(files.map((file) => file.name)).size === files.length && files.every(
			(f) =>
				!(f instanceof TFolder && isAtOrUnder(folder.path, f.path)) &&
				(f.parent === folder || !folder.children.some((child) => child.name === f.name))
		);
	}

	private draggedFiles(): TAbstractFile[] | null {
		const dragged = this.dragManager()?.draggable;
		if (!dragged) return null;
		if ((dragged.type === "file" || dragged.type === "folder") && dragged.file) return [dragged.file];
		if (dragged.type === "files" && dragged.files && dragged.files.length > 0) return dragged.files;
		return null;
	}

	private dragManager(): DragManager | null {
		return (this.app as InternalApp).dragManager ?? null;
	}

	private async moveInto(files: TAbstractFile[], folder: TFolder) {
		if (!this.canHold(files, folder)) throw new Error("The move conflicts with an existing name or would put a folder inside itself.");
		for (const file of files) {
			if (file.parent !== folder) await this.app.fileManager.renameFile(file, childPath(folder, file.name));
		}
	}

	// The folder's children as the file explorer shows them now.
	private namesIn(folder: TFolder): string[] {
		let items: FileExplorerItem[] = [];
		this.forEachExplorer((view) => (items = view.getSortedFolderItems(folder)));
		return items.length > 0 ? items.map((item) => item.file.name) : folder.children.map((child) => child.name);
	}

	private askToMerge(source: TFile, target: TFile) {
		const merge = () => void this.safely(() => this.merge(source, target));
		if (this.settings.askBeforeMerge) new MergeModal(this.app, source, target, this.mergedFolder(), merge).open();
		else merge();
	}

	private async ensureFolder(path: string): Promise<TFolder> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFolder) return existing;
		if (existing) throw new Error("The merged originals path is a file. Choose a folder instead.");
		const parent = parentOf(path);
		if (parent !== "/") await this.ensureFolder(parent);
		return this.app.vault.createFolder(path);
	}

	private freePath(folder: TFolder, base: string, extension = "md"): string {
		for (let n = 0; ; n++) {
			const path = childPath(folder, `${n === 0 ? base : `${base} ${n}`}.${extension}`);
			if (!this.app.vault.getAbstractFileByPath(path)) return path;
		}
	}

	private async safely(run: () => Promise<void>) {
		try {
			await run();
		} catch (error) {
			console.error("File Placer:", error);
			new Notice(`File Placer: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private addResetItem(menu: Menu, path: string) {
		menu.addItem((item) =>
			item.setSection("action").setTitle("Back to normal sort").setIcon("arrow-down-up").onClick(() => this.resetOrder(path))
		);
	}

	private forEachExplorer(callback: (view: FileExplorerView) => void) {
		for (const leaf of this.app.workspace.getLeavesOfType(FILE_EXPLORER)) {
			if (leaf.isDeferred) continue;
			const view = leaf.view as FileExplorerView;
			if (typeof view.requestSort === "function") callback(view);
		}
	}

	// Renaming keeps an item's place; moving it out of a folder drops it from that folder's order.
	// Renaming or moving a folder carries the placed order of everything inside it.
	private onRename(file: TAbstractFile, oldPath: string) {
		let changed = false;
		const oldName = nameOf(oldPath);
		const list = this.settings.order[parentOf(oldPath)];
		const i = list ? list.indexOf(oldName) : -1;
		if (list && i !== -1) {
			if (parentOf(oldPath) === parentOf(file.path)) list[i] = file.name;
			else list.splice(i, 1);
			changed = true;
		}
		if (file instanceof TFolder) {
			for (const key of Object.keys(this.settings.order)) {
				if (!isAtOrUnder(key, oldPath)) continue;
				this.settings.order[file.path + key.slice(oldPath.length)] = this.settings.order[key];
				delete this.settings.order[key];
				changed = true;
			}
		}
		if (changed) void this.safely(() => this.saveSettings());
	}

	private onDelete(path: string) {
		let changed = false;
		const list = this.settings.order[parentOf(path)];
		if (list?.includes(nameOf(path))) {
			this.settings.order[parentOf(path)] = list.filter((name) => name !== nameOf(path));
			changed = true;
		}
		for (const key of Object.keys(this.settings.order)) {
			if (!isAtOrUnder(key, path)) continue;
			delete this.settings.order[key];
			changed = true;
		}
		if (changed) void this.safely(() => this.saveSettings());
	}
}

class MergeModal extends Modal {
	constructor(app: App, private source: TFile, private target: TFile, private folder: string, private onMerge: () => void) {
		super(app);
	}

	onOpen() {
		const from = this.source.basename;
		const into = this.target.basename;
		this.titleEl.setText(`Merge "${from}" into "${into}"?`);
		this.contentEl.createEl("p", {
			text: `"${into}" stays where it is and gets all of "${from}" added under it, with its headings one level down.`,
		});
		this.contentEl.createEl("p", {
			text: `Exact text backups of both notes are saved in "${this.folder}" before merging. "${from}" moves there after the target is saved. Nothing is deleted.`,
		});
		new Setting(this.contentEl)
			.addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((button) =>
				button
					.setButtonText("Merge")
					.setCta()
					.onClick(() => {
						this.close();
						this.onMerge();
					})
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}

class FilePlacerSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: FilePlacerPlugin) {
		super(app, plugin);
	}

	display() {
		this.renderSettings();
	}

	private renderSettings() {
		const { containerEl } = this;
		const settings = this.plugin.settings;
		containerEl.empty();
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text:
				"Drag any note or folder in the file explorer. A purple line shows where it lands: on top of the row while you move up, " +
				"under it while you move down. Hold still over a note to merge the two; hold still over a folder to move into it.",
		});

		new Setting(containerEl)
			.setName("Ask before merging")
			.setDesc("Confirm each merge before changing notes.")
			.addToggle((toggle) =>
				toggle.setValue(settings.askBeforeMerge).onChange(async (value) => {
					settings.askBeforeMerge = value;
					await this.plugin.saveSettings();
				})
			);
		new Setting(containerEl)
			.setName("Merged originals folder")
			.setDesc("Exact copies of both notes are saved here before merging; the source moves here afterwards.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_MERGED_FOLDER)
					.setValue(settings.mergedFolder)
					.onChange(async (value) => {
						settings.mergedFolder = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Placed folders").setHeading();
		const folders = Object.keys(settings.order).sort();
		if (folders.length === 0) {
			containerEl.createEl("p", { cls: "setting-item-description", text: "Nothing placed yet." });
			return;
		}
		for (const path of folders) {
			new Setting(containerEl).setName(path === "/" ? "Vault root" : path).addButton((button) =>
				button.setButtonText("Back to normal sort").onClick(async () => {
					await this.plugin.resetOrder(path);
					this.renderSettings();
				})
			);
		}
	}
}
