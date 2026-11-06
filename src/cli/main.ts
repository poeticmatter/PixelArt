import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { describeAsset, renderAssetForExport } from "../core/assetSummary.ts";
import { getExportStem } from "../core/exportNaming.ts";
import type { Library } from "../core/library.ts";
import { createSheetMetadata } from "../core/spriteSheet.ts";
import type { LibraryEntry } from "../core/types.ts";
import { DEFAULT_LIBRARY_DIRECTORY, loadLibraryFromDisk } from "./diskLibrary.ts";
import { encodePng } from "./png.ts";

const DEFAULT_EXPORT_DIRECTORY = path.resolve(import.meta.dirname, "../../exports");

const USAGE = `Usage:
  npm run validate
      Validate every asset in library/.
  npm run export -- [asset-id ...] [--scale N] [--out DIR]
      Export assets as PNG (all assets when no ids are given).
      Sprite sheets also get a .json file with each animation's frame rectangles and timings.
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
    console.log(`✓ ${id}  (${describeAsset(asset)})`);
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

/** Writes the PNG, plus frame metadata for sprite sheets; returns the paths written. */
function exportEntry(entry: LibraryEntry, scale: number, outputDirectory: string): string[] {
  const stemPath = path.join(outputDirectory, getExportStem(entry.id, scale));
  const pngPath = `${stemPath}.png`;
  mkdirSync(path.dirname(pngPath), { recursive: true });
  writeFileSync(pngPath, encodePng(renderAssetForExport(entry.asset, scale)));
  if (entry.asset.type === "image") {
    return [pngPath];
  }
  const metadataPath = `${stemPath}.json`;
  const metadata = createSheetMetadata(entry.asset, path.basename(pngPath), scale);
  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return [pngPath, metadataPath];
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
    for (const writtenPath of exportEntry(entry, scale, path.resolve(values.out))) {
      console.log(`→ ${writtenPath}`);
    }
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
