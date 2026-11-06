import type { InvalidLibraryEntry, LibraryEntry } from "./types.ts";
import { validateAsset } from "./validation/validateAsset.ts";

/** A file found in the library, either parsed or with the reason it could not be parsed. */
export type LibraryFile =
  | { relativePath: string; json: unknown }
  | { relativePath: string; parseError: string };

export interface Library {
  entries: LibraryEntry[];
  invalidEntries: InvalidLibraryEntry[];
}

/** "cats\\cat-2-color.json" → "cats/cat-2-color", so ids match across platforms. */
export function toAssetId(relativePath: string): string {
  return relativePath.replaceAll("\\", "/").replace(/^\.?\//, "").replace(/\.json$/, "");
}

/** The folder part of an id, used to group assets; "" for top-level assets. */
export function getAssetFolder(id: string): string {
  const lastSlash = id.lastIndexOf("/");
  return lastSlash === -1 ? "" : id.slice(0, lastSlash);
}

function compareById(first: { id: string }, second: { id: string }): number {
  return first.id.localeCompare(second.id);
}

export function buildLibrary(files: LibraryFile[]): Library {
  const entries: LibraryEntry[] = [];
  const invalidEntries: InvalidLibraryEntry[] = [];

  for (const file of files) {
    const id = toAssetId(file.relativePath);
    if ("parseError" in file) {
      invalidEntries.push({ id, errors: [file.parseError] });
      continue;
    }
    const result = validateAsset(file.json);
    if (result.isValid) {
      entries.push({ id, asset: result.asset });
    } else {
      invalidEntries.push({ id, errors: result.errors });
    }
  }
  return { entries: entries.sort(compareById), invalidEntries: invalidEntries.sort(compareById) };
}
