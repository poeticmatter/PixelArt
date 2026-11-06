import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { createExportMetadata, describeAsset, renderAssetForExport } from "../core/assetSummary.ts";
import { getExportStem } from "../core/exportNaming.ts";
import type { LibraryEntry } from "../core/types.ts";
import { DEFAULT_EXPORT_DIRECTORY, parseScale, reportInvalidEntries, selectEntries } from "./cliShared.ts";
import { DEFAULT_LIBRARY_DIRECTORY, loadLibraryFromDisk } from "./diskLibrary.ts";
import { MAP_USAGE, runMap } from "./mapCommand.ts";
import { encodePng } from "./png.ts";

const USAGE = `Usage:
  npm run validate
      Validate every asset in library/.
  npm run export -- [asset-id ...] [--scale N] [--out DIR]
      Export assets as PNG (all assets when no ids are given).
      Sprite sheets and tilesets also get a .json file with frame or tile rectangles for game engines.
      Ids are library-relative paths without .json, e.g. cats/cat-2-color.
      --scale  Integer upscale factor, default 1.
      --out    Output directory, default exports/.
${MAP_USAGE}`;

function runValidate(): number {
  const library = loadLibraryFromDisk();
  for (const { id, asset } of library.entries) {
    console.log(`✓ ${id}  (${describeAsset(asset)})`);
  }
  reportInvalidEntries(library);
  console.log(`\n${library.entries.length} valid, ${library.invalidEntries.length} invalid in ${DEFAULT_LIBRARY_DIRECTORY}`);
  return library.invalidEntries.length === 0 ? 0 : 1;
}

/** Writes the PNG, plus slicing metadata for sprite sheets and tilesets; returns the paths written. */
function exportEntry(entry: LibraryEntry, scale: number, outputDirectory: string): string[] {
  const stemPath = path.join(outputDirectory, getExportStem(entry.id, scale));
  const pngPath = `${stemPath}.png`;
  mkdirSync(path.dirname(pngPath), { recursive: true });
  writeFileSync(pngPath, encodePng(renderAssetForExport(entry.asset, scale)));
  const metadata = createExportMetadata(entry.asset, path.basename(pngPath), scale);
  if (!metadata) {
    return [pngPath];
  }
  const metadataPath = `${stemPath}.json`;
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
    case "map":
      return runMap(commandArgs);
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
