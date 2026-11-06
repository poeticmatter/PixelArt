import type { TilesetAsset } from "../types.ts";
import { computeMask } from "./bitmask.ts";
import type { TileMap } from "./tileMap.ts";

export interface Cell {
  x: number;
  y: number;
}

/** Isometric elevation in steps; unset means one step per layer, which makes terraces. */
export function getTerrainElevation(tileset: Pick<TilesetAsset, "terrains">, terrainIndex: number): number {
  return tileset.terrains[terrainIndex]?.elevation ?? terrainIndex;
}

/** A cell's height for one layer: the map's per-cell height if it has one, else the terrain's. */
export function getCellElevation(tileset: TilesetAsset, map: TileMap, layer: number, cell: Cell): number {
  return map.elevations?.[layer]?.[cell.y]?.[cell.x] ?? getTerrainElevation(tileset, layer);
}

export function isLayerFilledAt(map: TileMap, layer: number, cell: Cell): boolean {
  return map.layers[layer]?.[cell.y]?.[cell.x] ?? false;
}

/** Cells outside the map count as filled, so terrain reads as continuing past the edge. */
function isFilledOrOffMap(map: TileMap, layer: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) {
    return true;
  }
  return isLayerFilledAt(map, layer, { x, y });
}

export function getLayerMask(map: TileMap, layer: number, cell: Cell): number {
  return computeMask((x, y) => isFilledOrOffMap(map, layer, x, y), cell.x, cell.y);
}

/** The layers present in a cell, lowest first, so higher structures paint over lower ones. */
export function listLayersByHeight(tileset: TilesetAsset, map: TileMap, cell: Cell): number[] {
  return map.layers
    .map((_, layer) => layer)
    .filter((layer) => isLayerFilledAt(map, layer, cell))
    .sort((first, second) => getCellElevation(tileset, map, first, cell) - getCellElevation(tileset, map, second, cell) || first - second);
}

/** The layer seen from above: the highest one in the cell (later layers win ties). */
export function getTopLayer(tileset: TilesetAsset, map: TileMap, cell: Cell): number | undefined {
  return listLayersByHeight(tileset, map, cell).at(-1);
}

/**
 * Where a layer's walls stop: the top of the highest lower layer in the same cell (a tower's
 * walls end on its building's roof), or street level if there is none.
 */
export function getWallBase(tileset: TilesetAsset, map: TileMap, layer: number, cell: Cell): number {
  const top = getCellElevation(tileset, map, layer, cell);
  const lowerTops = listLayersByHeight(tileset, map, cell)
    .filter((other) => other !== layer)
    .map((other) => getCellElevation(tileset, map, other, cell))
    .filter((elevation) => elevation < top);
  return Math.max(0, ...lowerTops);
}
