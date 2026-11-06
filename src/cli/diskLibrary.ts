import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { buildLibrary, type Library, type LibraryFile } from "../core/library.ts";

export const DEFAULT_LIBRARY_DIRECTORY = path.resolve(import.meta.dirname, "../../library");

function findAssetFiles(libraryDirectory: string): string[] {
  return readdirSync(libraryDirectory, { recursive: true, encoding: "utf8" })
    .filter((relativePath) => relativePath.endsWith(".json"))
    .map((relativePath) => path.join(libraryDirectory, relativePath));
}

function readLibraryFile(libraryDirectory: string, filePath: string): LibraryFile {
  const relativePath = path.relative(libraryDirectory, filePath);
  const text = readFileSync(filePath, "utf8");
  try {
    return { relativePath, json: JSON.parse(text) };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { relativePath, parseError: `Invalid JSON: ${error.message}` };
    }
    throw error;
  }
}

/** Reads every *.json file under the library directory and validates it. */
export function loadLibraryFromDisk(libraryDirectory = DEFAULT_LIBRARY_DIRECTORY): Library {
  const files = findAssetFiles(libraryDirectory).map((filePath) => readLibraryFile(libraryDirectory, filePath));
  return buildLibrary(files);
}
