import { describe, expect, it } from "vitest";

import type { RgbaImage } from "../render.ts";
import { createTestTileset } from "../testAssets.ts";
import type { TileMap } from "./mapGenerator.ts";
import { renderTileMap } from "./renderTileMap.ts";

/** In the test tileset, a tile's red channel is its mask + 1; 0 means nothing was drawn. */
function readMaskAt(image: RgbaImage, x: number, y: number): number {
  return (image.data[(y * image.width + x) * 4] ?? 0) - 1;
}

/** "#" is filled; parsed into a one-layer map. */
function parseMap(rows: string[]): TileMap {
  return {
    width: rows[0]?.length ?? 0,
    height: rows.length,
    layers: [rows.map((row) => [...row].map((cell) => cell === "#"))],
  };
}

describe("renderTileMap on a grid", () => {
  const map = parseMap([
    "....",
    ".##.",
    ".#..",
    "....",
  ]);
  const image = renderTileMap(createTestTileset(), map);

  it("picks each cell's tile from its neighbour mask", () => {
    expect([readMaskAt(image, 1, 1), readMaskAt(image, 2, 1), readMaskAt(image, 1, 2)]).toEqual([
      2 | 4, // east and south neighbours
      8, // west neighbour only
      1, // north neighbour only
    ]);
  });

  it("leaves empty cells transparent when there is no background", () => {
    expect(readMaskAt(image, 0, 0)).toBe(-1);
  });

  it("treats cells beyond the map edge as filled", () => {
    const edgeImage = renderTileMap(createTestTileset(), parseMap(["#"]));
    expect(readMaskAt(edgeImage, 0, 0)).toBe(15);
  });
});

describe("renderTileMap in isometric projection", () => {
  it("sizes the image to fit every diamond plus raised layers", () => {
    const tileset = createTestTileset({
      projection: { type: "isometric", footprintHeight: 8 },
      tileWidth: 16,
      tileHeight: 12,
      terrains: [
        { name: "low", tiles: [] },
        { name: "high", tiles: [] },
      ],
    });
    const emptyMap: TileMap = { width: 3, height: 2, layers: [[], []] };
    const image = renderTileMap(tileset, emptyMap);
    // Width: (3 + 2) diamonds of half-width 8. Height: one 4px rise, 3 half-height steps, one tile.
    expect({ width: image.width, height: image.height }).toEqual({ width: 40, height: 4 + 3 * 4 + 12 });
  });
});

describe("renderTileMap validation", () => {
  it("rejects a map with more layers than the tileset has terrains", () => {
    const map: TileMap = { width: 1, height: 1, layers: [[[true]], [[true]]] };
    expect(() => renderTileMap(createTestTileset(), map)).toThrow(/2 layers/);
  });
});
