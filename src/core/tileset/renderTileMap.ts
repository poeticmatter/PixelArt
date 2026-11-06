import { assertValidScale, createBlankImage, drawImageOver, type RgbaImage } from "../render.ts";
import type { TilesetAsset } from "../types.ts";
import { computeMask } from "./bitmask.ts";
import type { TileMap } from "./mapGenerator.ts";
import { type RenderedTileset, renderTilesetImages, selectTileImage } from "./tilesetImages.ts";

interface Point {
  x: number;
  y: number;
}

/** Where a cell's tile goes on the output image, and how high its terrain layer is raised. */
interface MapLayout {
  width: number;
  height: number;
  getTileOrigin(cell: Point, layer: number): Point;
  /** Cells in the order they must be painted so nearer tiles cover farther ones. */
  paintOrder: Point[];
}

function listCellsRowByRow(map: TileMap): Point[] {
  return Array.from({ length: map.height }, (_, y) => Array.from({ length: map.width }, (_, x) => ({ x, y }))).flat();
}

function createGridLayout(map: TileMap, tileWidth: number, tileHeight: number): MapLayout {
  return {
    width: map.width * tileWidth,
    height: map.height * tileHeight,
    getTileOrigin: (cell) => ({ x: cell.x * tileWidth, y: cell.y * tileHeight }),
    paintOrder: listCellsRowByRow(map),
  };
}

/**
 * Diamond layout: moving +x steps down-right, +y steps down-left. Each terrain layer is
 * raised by the tile's side-face depth, and cells paint back (top) to front (bottom).
 */
function createIsometricLayout(map: TileMap, tileWidth: number, tileHeight: number, footprintHeight: number): MapLayout {
  const halfWidth = tileWidth / 2;
  const halfHeight = footprintHeight / 2;
  const layerRise = tileHeight - footprintHeight;
  const topPadding = Math.max(0, map.layers.length - 1) * layerRise;
  const originX = (map.height - 1) * halfWidth;
  const diagonalCount = map.width + map.height - 1;
  return {
    width: (map.width + map.height) * halfWidth,
    height: topPadding + (diagonalCount - 1) * halfHeight + tileHeight,
    getTileOrigin: (cell, layer) => ({
      x: originX + (cell.x - cell.y) * halfWidth,
      y: topPadding + (cell.x + cell.y) * halfHeight - layer * layerRise,
    }),
    paintOrder: listCellsRowByRow(map).sort((first, second) => first.x + first.y - (second.x + second.y)),
  };
}

function createLayout(tileset: TilesetAsset, map: TileMap, scale: number): MapLayout {
  const tileWidth = tileset.tileWidth * scale;
  const tileHeight = tileset.tileHeight * scale;
  const { projection } = tileset;
  return projection.type === "isometric"
    ? createIsometricLayout(map, tileWidth, tileHeight, projection.footprintHeight * scale)
    : createGridLayout(map, tileWidth, tileHeight);
}

/** Cells outside the map count as filled, so terrain reads as continuing past the edge. */
function isLayerFilled(map: TileMap, layer: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return true;
  }
  return map.layers[layer]?.[y]?.[x] ?? false;
}

function paintCell(output: RgbaImage, map: TileMap, cell: Point, context: { layout: MapLayout; tiles: RenderedTileset }): void {
  const { layout, tiles } = context;
  if (tiles.background) {
    drawImageOver(output, tiles.background, layout.getTileOrigin(cell, 0));
  }
  map.layers.forEach((grid, layer) => {
    if (!grid[cell.y]?.[cell.x]) {
      return;
    }
    const mask = computeMask((x, y) => isLayerFilled(map, layer, x, y), cell.x, cell.y);
    const tile = selectTileImage(tiles, { terrain: layer, mask, x: cell.x, y: cell.y });
    if (tile) {
      drawImageOver(output, tile, layout.getTileOrigin(cell, layer));
    }
  });
}

/** Paints a map with the tileset, choosing each cell's tile from its neighbour bitmask. */
export function renderTileMap(tileset: TilesetAsset, map: TileMap, scale = 1): RgbaImage {
  assertValidScale(scale);
  if (map.layers.length > tileset.terrains.length) {
    throw new Error(`The map has ${map.layers.length} layers but "${tileset.name}" has ${tileset.terrains.length} terrains.`);
  }
  const layout = createLayout(tileset, map, scale);
  const tiles = renderTilesetImages(tileset, scale);
  const output = createBlankImage(layout.width, layout.height);
  for (const cell of layout.paintOrder) {
    paintCell(output, map, cell, { layout, tiles });
  }
  return output;
}
