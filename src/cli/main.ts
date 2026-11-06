import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import type { Library } from "../core/library.ts";
import { renderAsset } from "../core/render.ts";
import type { LibraryEntry } from "../core/types.ts";
import { DEFAULT_LIBRARY_DIRECTORY, loadLibraryFromDisk } from "./diskLibrary.ts";
import { encodePng } from "./png.ts";

const DEFAULT_EXPORT_DIRECTORY = path.resolve(import.meta.dirname, "../../exports");

const USAGE = `Usage:
  npm run validate
      Validate every asset in library/.
  npm run export -- [asset-id ...] [--scale N] [--out DIR]
      Export assets as PNG (all assets when no ids are given).
      Ids are library-relative paths without .json, e.g. cats/cat-2-color.
      --scale  Integer upscale factor, default 1.
      --out    Output directory, default exports/.`;

function reportInvalidEntries(library: Library): void {
  for (const { id, errors } of library.invalidEntries) {
    console.error(`✗ ${id}`);
    for (const error of errors) {
      console.error(`    ${error}`);
    }
  }
}

function runValidate(): number {
  const library = loadLibraryFromDisk();
  for (const { id, asset } of library.entries) {
    console.log(`✓ ${id}  (${asset.width}×${asset.height}, ${asset.palette.length} colors)`);
  }
  reportInvalidEntries(library);
  console.log(`\n${library.entries.length} valid, ${library.invalidEntries.length} invalid in ${DEFAULT_LIBRARY_DIRECTORY}`);
  return library.invalidEntries.length === 0 ? 0 : 1;
}

function selectEntries(library: Library, requestedIds: string[]): LibraryEntry[] {
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

function parseScale(rawScale: string): number {
  const scale = Number(rawScale);
  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error(`--scale must be a positive integer, got "${rawScale}".`);
  }
  return scale;
}

function exportEntry(entry: LibraryEntry, scale: number, outputDirectory: string): string {
  const suffix = scale === 1 ? "" : `@${scale}x`;
  const outputPath = path.join(outputDirectory, `${entry.id}${suffix}.png`);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, encodePng(renderAsset(entry.asset, scale)));
  return outputPath;
}

function runExport(commandArgs: string[]): number {
  const { values, positionals } = parseArgs({
    args: commandArgs,
    allowPositionals: true,
    options: {
      scale: { type: "string", default: "1" },
      out: { type: "string", default: DEFAULT_EXPORT_DIRECTORY },
    },
  });
  const scale = parseScale(values.scale);
  const library = loadLibraryFromDisk();
  reportInvalidEntries(library);

  for (const entry of selectEntries(library, positionals)) {
    console.log(`→ ${exportEntry(entry, scale, path.resolve(values.out))}`);
  }
  return library.invalidEntries.length === 0 ? 0 : 1;
}

function main(argv: string[]): number {
  const [command, ...commandArgs] = argv;
  switch (command) {
    case "validate":
      return runValidate();
    case "export":
      return runExport(commandArgs);
    default:
      console.error(USAGE);
      return command === undefined || command === "--help" ? 0 : 1;
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
