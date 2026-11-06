import { describe, expect, it } from "vitest";

import { computeMask, describeMask, NEIGHBOR_BITS } from "./bitmask.ts";

describe("computeMask", () => {
  it("sets the bit of every neighbour that shares the terrain", () => {
    const filledCells = new Set(["1,0", "2,1"]);
    const isFilled = (x: number, y: number): boolean => filledCells.has(`${x},${y}`);
    expect(computeMask(isFilled, 1, 1)).toBe(NEIGHBOR_BITS.north | NEIGHBOR_BITS.east);
  });

  it("is 15 when surrounded on all four sides", () => {
    expect(computeMask(() => true, 5, 5)).toBe(15);
  });
});

describe("describeMask", () => {
  it("lists the connected directions", () => {
    expect([describeMask(0), describeMask(6), describeMask(15)]).toEqual(["none", "E+S", "N+E+S+W"]);
  });
});
