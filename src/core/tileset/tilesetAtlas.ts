import { copyImageInto, createBlankImage, type RgbaImage } from "../render.ts";
import type { Projection, Tile, TilesetAsset } from "../types.ts";
import { describeMask, NEIGHBOR_BITS } from "./bitmask.ts";
import { renderTileImage } from "./tilesetImages.ts";

interface TileRect {
  mask: number;
  /** Readable form of the mask, e.g. "N+E". */
  neighbors: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Engine-friendly description of where each tile sits in the exported atlas image. */
export interface TilesetMetadata {
  image: string;
  tileWidth: number;
  tileHeight: number;
  projection: Projection;
  maskBits: typeof NEIGHBOR_BITS;
  background?: Omit<TileRect, "mask" | "neighbors">;
  terrains: { name: string; tiles: TileRect[] }[];
}

/** Tiles sorted by mask (variants keep file order), so atlas columns read 0, 1, 2… 15. */
function sortTilesByMask(tiles: Tile[]): Tile[] {
  return [...tiles].sort((first, second) => first.mask - second.mask);
}

/** Atlas rows: the background tile (if any) first, then one row per terrain. */
function getAtlasRows(tileset: TilesetAsset): { name: string; tiles: Tile[] }[] {
  const terrainRows = tileset.terrains.map((terrain) => ({ name: terrain.name, tiles: sortTilesByMask(terrain.tiles) }));
  if (!tileset.background) {
    return terrainRows;
  }
  return [{ name: "background", tiles: [{ mask: 0, pixels: tileset.background.pixels }] }, ...terrainRows];
}

export function renderTilesetAtlas(tileset: TilesetAsset, scale = 1): RgbaImage {
  const rows = getAtlasRows(tileset);
  const tileWidth = tileset.tileWidth * scale;
  const tileHeight = tileset.tileHeight * scale;
  const columns = Math.max(...rows.map((row) => row.tiles.length));
  const output = createBlankImage(columns * tileWidth, rows.length * tileHeight);
  rows.forEach((row, rowIndex) => {
    row.tiles.forEach((tile, column) => {
      copyImageInto(output, renderTileImage(tileset, tile.pixels, scale), { x: column * tileWidth, y: rowIndex * tileHeight });
    });
  });
  return output;
}

/** Tile rectangles in the coordinates of the atlas exported at `scale`. */
export function createTilesetMetadata(tileset: TilesetAsset, imageFileName: string, scale = 1): TilesetMetadata {
  const width = tileset.tileWidth * scale;
  const height = tileset.tileHeight * scale;
  const rowOffset = tileset.background ? 1 : 0;
  return {
    image: imageFileName,
    tileWidth: width,
    tileHeight: height,
    projection: tileset.projection,
    maskBits: NEIGHBOR_BITS,
    ...(tileset.background && { background: { x: 0, y: 0, width, height } }),
    terrains: tileset.terrains.map((terrain, terrainIndex) => ({
      name: terrain.name,
      tiles: sortTilesByMask(terrain.tiles).map((tile, column) => ({
        mask: tile.mask,
        neighbors: describeMask(tile.mask),
        x: column * width,
        y: (terrainIndex + rowOffset) * height,
        width,
        height,
      })),
    })),
  };
}
