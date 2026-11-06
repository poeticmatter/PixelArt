/**
 * 4-bit cardinal autotiling: a tile's mask records which of its four grid neighbours
 * belong to the same terrain. 16 masks, so 16 tiles per terrain.
 *
 * In isometric maps the same grid directions apply, drawn as diamonds:
 * N = up-right, E = down-right, S = down-left, W = up-left.
 */
export const NEIGHBOR_BITS = { north: 1, east: 2, south: 4, west: 8 } as const;

export const MASK_COUNT = 16;
export const ALL_MASKS = Array.from({ length: MASK_COUNT }, (_, mask) => mask);

const DIRECTIONS = [
  { bit: NEIGHBOR_BITS.north, dx: 0, dy: -1, label: "N" },
  { bit: NEIGHBOR_BITS.east, dx: 1, dy: 0, label: "E" },
  { bit: NEIGHBOR_BITS.south, dx: 0, dy: 1, label: "S" },
  { bit: NEIGHBOR_BITS.west, dx: -1, dy: 0, label: "W" },
] as const;

/** Whether a cell belongs to the terrain; called with out-of-range coordinates too. */
export type CellTest = (x: number, y: number) => boolean;

export function computeMask(isFilled: CellTest, x: number, y: number): number {
  return DIRECTIONS.reduce((mask, { bit, dx, dy }) => (isFilled(x + dx, y + dy) ? mask | bit : mask), 0);
}

/** 6 → "E+S", 0 → "none": readable labels for tile listings. */
export function describeMask(mask: number): string {
  const labels = DIRECTIONS.filter(({ bit }) => (mask & bit) !== 0).map(({ label }) => label);
  return labels.length === 0 ? "none" : labels.join("+");
}
