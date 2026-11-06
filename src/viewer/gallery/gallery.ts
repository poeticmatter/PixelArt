import { describeAsset } from "../../core/assetSummary.ts";
import { getAssetFolder, type Library } from "../../core/library.ts";
import type { InvalidLibraryEntry, LibraryEntry } from "../../core/types.ts";
import type { AnimationClock } from "../animation/animationClock.ts";
import { createElement } from "../dom.ts";
import { createThumbnail } from "./thumbnail.ts";

const TOP_LEVEL_FOLDER_LABEL = "Library";

export interface GalleryOptions {
  clock: AnimationClock;
  onSelect: (entry: LibraryEntry) => void;
}

function createThumbnailCard(entry: LibraryEntry, options: GalleryOptions): HTMLElement {
  const isAnimated = entry.asset.type === "spritesheet";
  const card = createElement("button", { className: "asset-card", attributes: { type: "button", title: entry.id } }, [
    createElement("div", { className: "asset-card__preview checkerboard" }, [createThumbnail(entry.asset, options.clock)]),
    createElement("span", { className: "asset-card__name", text: entry.asset.name }),
    createElement("span", { className: "asset-card__meta", text: describeAsset(entry.asset) }),
  ]);
  if (isAnimated) {
    card.append(createElement("span", { className: "asset-card__badge", text: "Sprite sheet" }));
  }
  card.addEventListener("click", () => options.onSelect(entry));
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

export function renderGallery(container: HTMLElement, library: Library, options: GalleryOptions): void {
  const sections = [...groupByFolder(library.entries)].map(([folder, entries]) =>
    createFolderSection(
      folder,
      entries.map((entry) => createThumbnailCard(entry, options)),
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
