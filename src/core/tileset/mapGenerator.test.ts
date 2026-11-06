import { describe, expect, it } from "vitest";

import { generateTileMap } from "./mapGenerator.ts";

const OPTIONS = { width: 24, height: 16, seed: 42 };

function countFilled(grid: boolean[][] | undefined): number {
  return (grid ?? []).flat().filter(Boolean).length;
}

describe("generateTileMap", () => {
  it("returns the same map for the same seed", () => {
    expect(generateTileMap({ type: "topdown" }, 2, OPTIONS)).toEqual(generateTileMap({ type: "topdown" }, 2, OPTIONS));
  });

  it("returns a different map for a different seed", () => {
    const first = generateTileMap({ type: "topdown" }, 1, OPTIONS);
    const second = generateTileMap({ type: "topdown" }, 1, { ...OPTIONS, seed: 43 });
    expect(first).not.toEqual(second);
  });

  it("produces one layer per terrain at the requested size", () => {
    const map = generateTileMap({ type: "isometric", footprintHeight: 16 }, 3, OPTIONS);
    expect([map.layers.length, map.layers[0]?.length, map.layers[0]?.[0]?.length]).toEqual([3, 16, 24]);
  });

  it.each([{ type: "topdown" as const }, { type: "sideview" as const }])(
    "nests each $type terrain inside the one below it",
    (projection) => {
      const map = generateTileMap(projection, 2, OPTIONS);
      const isNested = map.layers[1]?.every((row, y) => row.every((filled, x) => !filled || map.layers[0]?.[y]?.[x]));
      expect(isNested).toBe(true);
    },
  );

  it("keeps the edges of an island map as water", () => {
    const map = generateTileMap({ type: "topdown" }, 1, OPTIONS);
    const [land] = map.layers;
    const edgeCells = [...(land?.[0] ?? []), ...(land?.at(-1) ?? []), ...(land ?? []).map((row) => row[0])];
    expect(edgeCells.some(Boolean)).toBe(false);
  });

  it("fills the bottom row of a side-view map with ground", () => {
    const map = generateTileMap({ type: "sideview" }, 1, OPTIONS);
    expect(map.layers[0]?.at(-1)?.every(Boolean)).toBe(true);
  });

  it("generates some land on a side-view map without filling the sky", () => {
    const map = generateTileMap({ type: "sideview" }, 1, OPTIONS);
    const filled = countFilled(map.layers[0]);
    expect(filled > 0 && filled < OPTIONS.width * OPTIONS.height).toBe(true);
  });

  it.each([3, 129, 10.5])("rejects map size %s", (size) => {
    expect(() => generateTileMap({ type: "topdown" }, 1, { ...OPTIONS, width: size })).toThrow(/Map width and height/);
  });
});
