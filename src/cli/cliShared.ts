import path from "node:path";

import type { Library } from "../core/library.ts";
import type { LibraryEntry } from "../core/types.ts";

export const DEFAULT_EXPORT_DIRECTORY = path.resolve(import.meta.dirname, "../../exports");

export function reportInvalidEntries(library: Library): void {
  for (const { id, errors } of library.invalidEntries) {
    console.error(`✗ ${id}`);
    for (const error of errors) {
      console.error(`    ${error}`);
    }
  }
}

export function selectEntries(library: Library, requestedIds: string[]): LibraryEntry[] {
  if (requestedIds.length === 0) {
    return library.entries;
  }
  const missingIds = requestedIds.filter((id) => !library.entries.some((entry) => entry.id === id));
  if (missingIds.length > 0) {
    const knownIds = library.entries.map((entry) => entry.id).join(", ");
    throw new Error(`Unknown or invalid asset id(s): ${missingIds.join(", ")}. Valid ids: ${knownIds}`);
  }
  return library.entries.filter((entry) => requestedIds.includes(entry.id));
}

export function parsePositiveInteger(rawValue: string, optionName: string): number {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`--${optionName} must be a positive integer, got "${rawValue}".`);
  }
  return value;
}

export function parseScale(rawScale: string): number {
  return parsePositiveInteger(rawScale, "scale");
}
