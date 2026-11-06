import { assertValidScale, createBlankImage, drawImageOver, type RgbaImage } from "../render.ts";
import type { TilesetAsset } from "../types.ts";
import { computeMask } from "./bitmask.ts";
import type { TileMap } from "./tileMap.ts";
import { type RenderedTileset, renderTilesetImages, selectTileImage } from "./tilesetImages.ts";

interface Point {
  x: number;
  y: number;
}

/** Where a cell's tile goes on the output image, given how many steps its terrain is raised. */
interface MapLayout {
  width: number;
  height: number;
  getTileOrigin(cell: Point, elevation: number): Point;
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
 * Diamond layout: moving +x steps down-right, +y steps down-left. Each elevation step raises
 * a tile by its side-face depth, and cells paint back (top) to front (bottom).
 */
function createIsometricLayout(map: TileMap, tileset: TilesetAsset, scale: number, footprintHeight: number): MapLayout {
  const tileWidth = tileset.tileWidth * scale;
  const tileHeight = tileset.tileHeight * scale;
  const halfWidth = tileWidth / 2;
  const halfHeight = footprintHeight / 2;
  const stepRise = tileHeight - footprintHeight;
  const highestElevation = Math.max(0, ...tileset.terrains.map((_, index) => getTerrainElevation(tileset, index)));
  const topPadding = highestElevation * stepRise;
  const originX = (map.height - 1) * halfWidth;
  const diagonalCount = map.width + map.height - 1;
  return {
    width: (map.width + map.height) * halfWidth,
    height: topPadding + (diagonalCount - 1) * halfHeight + tileHeight,
    getTileOrigin: (cell, elevation) => ({
      x: originX + (cell.x - cell.y) * halfWidth,
      y: topPadding + (cell.x + cell.y) * halfHeight - elevation * stepRise,
    }),
    paintOrder: listCellsRowByRow(map).sort((first, second) => first.x + first.y - (second.x + second.y)),
  };
}

function createLayout(tileset: TilesetAsset, map: TileMap, scale: number): MapLayout {
  const { projection } = tileset;
  return projection.type === "isometric"
    ? createIsometricLayout(map, tileset, scale, projection.footprintHeight * scale)
    : createGridLayout(map, tileset.tileWidth * scale, tileset.tileHeight * scale);
}

/** Isometric elevation in steps; unset means one step per layer, which makes terraces. */
export function getTerrainElevation(tileset: TilesetAsset, terrainIndex: number): number {
  return tileset.terrains[terrainIndex]?.elevation ?? terrainIndex;
}

/** Cells outside the map count as filled, so terrain reads as continuing past the edge. */
function isLayerFilled(map: TileMap, layer: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return true;
  }
  return map.layers[layer]?.[y]?.[x] ?? false;
}

interface PaintContext {
  tileset: TilesetAsset;
  layout: MapLayout;
  tiles: RenderedTileset;
}

function paintCell(output: RgbaImage, map: TileMap, cell: Point, context: PaintContext): void {
  const { tileset, layout, tiles } = context;
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
      drawImageOver(output, tile, layout.getTileOrigin(cell, getTerrainElevation(tileset, layer)));
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
    paintCell(output, map, cell, { tileset, layout, tiles });
  }
  return output;
}
