import { getAssetFolder, type Library } from "../core/library.ts";
import type { InvalidLibraryEntry, LibraryEntry } from "../core/types.ts";
import { drawAsset, getFittingScale } from "./canvas.ts";
import { createElement } from "./dom.ts";

const THUMBNAIL_SIZE = 128;
const TOP_LEVEL_FOLDER_LABEL = "Library";

export function describeAsset(entry: LibraryEntry): string {
  const { width, height, palette } = entry.asset;
  return `${width}×${height} · ${palette.length} colors`;
}

function createThumbnailCard(entry: LibraryEntry, onSelect: (entry: LibraryEntry) => void): HTMLElement {
  const canvas = createElement("canvas", { className: "pixel-canvas" });
  drawAsset(canvas, entry.asset, getFittingScale(entry.asset, THUMBNAIL_SIZE));

  const card = createElement("button", { className: "asset-card", attributes: { type: "button", title: entry.id } }, [
    createElement("div", { className: "asset-card__preview checkerboard" }, [canvas]),
    createElement("span", { className: "asset-card__name", text: entry.asset.name }),
    createElement("span", { className: "asset-card__meta", text: describeAsset(entry) }),
  ]);
  card.addEventListener("click", () => onSelect(entry));
  return card;
}

function createInvalidCard(entry: InvalidLibraryEntry): HTMLElement {
  const errorItems = entry.errors.map((error) => createElement("li", { text: error }));
  return createElement("article", { className: "asset-card asset-card--invalid" }, [
    createElement("span", { className: "asset-card__name", text: entry.id }),
    createElement("span", { className: "asset-card__meta", text: "Invalid asset" }),
    createElement("ul", { className: "asset-card__errors" }, errorItems),
  ]);
}

function groupByFolder<Entry extends { id: string }>(entries: Entry[]): Map<string, Entry[]> {
  const groups = new Map<string, Entry[]>();
  for (const entry of entries) {
    const folder = getAssetFolder(entry.id);
    groups.set(folder, [...(groups.get(folder) ?? []), entry]);
  }
  return groups;
}

function createFolderSection(folder: string, cards: HTMLElement[]): HTMLElement {
  return createElement("section", { className: "gallery__section" }, [
    createElement("h2", { className: "gallery__heading", text: folder || TOP_LEVEL_FOLDER_LABEL }),
    createElement("div", { className: "gallery__grid" }, cards),
  ]);
}

export function renderGallery(
  container: HTMLElement,
  library: Library,
  onSelect: (entry: LibraryEntry) => void,
): void {
  const sections = [...groupByFolder(library.entries)].map(([folder, entries]) =>
    createFolderSection(
      folder,
      entries.map((entry) => createThumbnailCard(entry, onSelect)),
    ),
  );
  if (library.invalidEntries.length > 0) {
    sections.unshift(createFolderSection("Needs fixing", library.invalidEntries.map(createInvalidCard)));
  }
  if (sections.length === 0) {
    sections.push(createElement("p", { className: "gallery__empty", text: "No assets yet. Add JSON files under library/." }));
  }
  container.replaceChildren(...sections);
}
