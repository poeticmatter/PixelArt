/** One boolean grid per terrain, in tileset order: layers[terrain][y][x]. */
export interface TileMap {
  width: number;
  height: number;
  layers: boolean[][][];
  /**
   * Optional per-cell heights in storeys, per layer: elevations[terrain][y][x]. A missing
   * layer (or cell) uses the terrain's own elevation. Lets generators vary building heights.
   */
  elevations?: (number[][] | undefined)[];
}

export interface MapOptions {
  width: number;
  height: number;
  seed: number;
}

export const MIN_MAP_SIZE = 4;
export const MAX_MAP_SIZE = 128;

export type Grid = boolean[][];

export function createGrid(options: { width: number; height: number }, isFilled: (x: number, y: number) => boolean): Grid {
  return Array.from({ length: options.height }, (_, y) => Array.from({ length: options.width }, (_, x) => isFilled(x, y)));
}

export function createEmptyGrid(options: { width: number; height: number }): Grid {
  return createGrid(options, () => false);
}

/** Sets a cell, ignoring coordinates outside the grid. */
export function fillCell(grid: Grid, x: number, y: number): void {
  const row = grid[y];
  if (row && x >= 0 && x < row.length) {
    row[x] = true;
  }
}

export function isCellFilled(grid: Grid, x: number, y: number): boolean {
  return grid[y]?.[x] ?? false;
}
