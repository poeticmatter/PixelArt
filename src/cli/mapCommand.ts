import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { cropImage, type CropRect, DENSE_WINDOW, findDensestWindow } from "../core/crop.ts";
import { getExportStem } from "../core/exportNaming.ts";
import type { RgbaImage } from "../core/render.ts";
import { generateTileMap, getDefaultMapSize } from "../core/tileset/mapGenerator.ts";
import { renderTileMap } from "../core/tileset/renderTileMap.ts";
import { DEFAULT_EXPORT_DIRECTORY, parsePositiveInteger, parseScale, selectEntries } from "./cliShared.ts";
import { loadLibraryFromDisk } from "./diskLibrary.ts";
import { encodePng } from "./png.ts";

export const MAP_USAGE = `  npm run map -- <tileset-id> [--seed N] [--width W] [--height H] [--scale N] [--crop dense|x,y,w,h] [--out DIR]
      Generate a random map with a tileset and save it as PNG. The same seed gives the same map.
      Size defaults depend on the projection; seed defaults to 1.
      --crop dense    Keep only the most detailed ${DENSE_WINDOW.width}×${DENSE_WINDOW.height} window (times --scale).
      --crop x,y,w,h  Keep this rectangle, in output pixels.`;

const DEFAULT_SEED = "1";

/** "dense" picks the busiest screen-sized window; "x,y,w,h" is an explicit rectangle. */
function resolveCrop(rawCrop: string, image: RgbaImage, scale: number): CropRect {
  if (rawCrop === "dense") {
    return findDensestWindow(image, { width: DENSE_WINDOW.width * scale, height: DENSE_WINDOW.height * scale }, 8 * scale);
  }
  const parts = rawCrop.split(",").map(Number);
  const [x, y, width, height] = parts;
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part)) || x === undefined || y === undefined || width === undefined || height === undefined) {
    throw new Error(`--crop must be "dense" or "x,y,w,h" in whole pixels, got "${rawCrop}".`);
  }
  return { x, y, width, height };
}

export function runMap(commandArgs: string[]): number {
  const { values, positionals } = parseArgs({
    args: commandArgs,
    allowPositionals: true,
    options: {
      seed: { type: "string", default: DEFAULT_SEED },
      width: { type: "string" },
      height: { type: "string" },
      scale: { type: "string", default: "1" },
      crop: { type: "string" },
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
  const map = generateTileMap(tileset, {
    seed,
    width: values.width ? parsePositiveInteger(values.width, "width") : defaultSize.width,
    height: values.height ? parsePositiveInteger(values.height, "height") : defaultSize.height,
  });
  const scale = parseScale(values.scale);
  const fullImage = renderTileMap(tileset, map, scale);
  const crop = values.crop ? resolveCrop(values.crop, fullImage, scale) : undefined;
  const image = crop ? cropImage(fullImage, crop) : fullImage;

  const suffix = crop ? "-crop" : "";
  const outputPath = path.join(path.resolve(values.out), `${getExportStem(`${entry.id}-map-${seed}${suffix}`, scale)}.png`);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, encodePng(image));
  const cropNote = crop ? `, cropped to ${crop.x},${crop.y},${crop.width},${crop.height}` : "";
  console.log(`→ ${outputPath}  (${map.width}×${map.height} cells, seed ${seed}${cropNote})`);
  return 0;
}
