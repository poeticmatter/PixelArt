import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { getExportStem } from "../core/exportNaming.ts";
import { generateTileMap, getDefaultMapSize } from "../core/tileset/mapGenerator.ts";
import { renderTileMap } from "../core/tileset/renderTileMap.ts";
import { DEFAULT_EXPORT_DIRECTORY, parsePositiveInteger, parseScale, selectEntries } from "./cliShared.ts";
import { loadLibraryFromDisk } from "./diskLibrary.ts";
import { encodePng } from "./png.ts";

export const MAP_USAGE = `  npm run map -- <tileset-id> [--seed N] [--width W] [--height H] [--scale N] [--out DIR]
      Generate a random map with a tileset and save it as PNG. The same seed gives the same map.
      Size defaults depend on the projection; seed defaults to 1.`;

const DEFAULT_SEED = "1";

export function runMap(commandArgs: string[]): number {
  const { values, positionals } = parseArgs({
    args: commandArgs,
    allowPositionals: true,
    options: {
      seed: { type: "string", default: DEFAULT_SEED },
      width: { type: "string" },
      height: { type: "string" },
      scale: { type: "string", default: "1" },
      out: { type: "string", default: DEFAULT_EXPORT_DIRECTORY },
    },
  });
  if (positionals.length !== 1) {
    throw new Error(`"map" needs exactly one tileset id.\n${MAP_USAGE}`);
  }
  const [entry] = selectEntries(loadLibraryFromDisk(), positionals);
  if (entry?.asset.type !== "tileset") {
    throw new Error(`"${positionals[0]}" is not a tileset.`);
  }
  const tileset = entry.asset;
  const defaultSize = getDefaultMapSize(tileset.projection);
  const seed = Number.parseInt(values.seed, 10);
  if (!Number.isSafeInteger(seed)) {
    throw new Error(`--seed must be an integer, got "${values.seed}".`);
  }
  const map = generateTileMap(tileset.projection, tileset.terrains.length, {
    seed,
    width: values.width ? parsePositiveInteger(values.width, "width") : defaultSize.width,
    height: values.height ? parsePositiveInteger(values.height, "height") : defaultSize.height,
  });
  const scale = parseScale(values.scale);
  const outputPath = path.join(path.resolve(values.out), `${getExportStem(`${entry.id}-map-${seed}`, scale)}.png`);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, encodePng(renderTileMap(tileset, map, scale)));
  console.log(`→ ${outputPath}  (${map.width}×${map.height} cells, seed ${seed})`);
  return 0;
}
