import { describe, expect, it } from "vitest";

import type { RgbaImage } from "../render.ts";
import { createTestTileset } from "../testAssets.ts";
import type { TileMap } from "./tileMap.ts";
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
    // One raised cell: the image leaves room for the tallest thing actually on the map.
    const map: TileMap = { width: 3, height: 2, layers: [[], [[true]]] };
    const image = renderTileMap(tileset, map);
    // Width: (3 + 2) diamonds of half-width 8. Height: one 4px rise, 3 half-height steps, one tile.
    expect({ width: image.width, height: image.height }).toEqual({ width: 40, height: 4 + 3 * 4 + 12 });
  });
});

describe("renderTileMap with explicit elevations", () => {
  it("raises a terrain by its own elevation instead of its layer index", () => {
    const tileset = createTestTileset({
      projection: { type: "isometric", footprintHeight: 8 },
      tileWidth: 16,
      tileHeight: 12,
      terrains: [
        { name: "street", elevation: 0, tiles: [] },
        { name: "tower", elevation: 3, tiles: [] },
      ],
    });
    const image = renderTileMap(tileset, { width: 1, height: 1, layers: [[], [[true]]] });
    // Three 4px steps of headroom above a single 12px tile.
    expect(image.height).toBe(3 * 4 + 12);
  });
});

describe("renderTileMap validation", () => {
  it("rejects a map with more layers than the tileset has terrains", () => {
    const map: TileMap = { width: 1, height: 1, layers: [[[true]], [[true]]] };
    expect(() => renderTileMap(createTestTileset(), map)).toThrow(/2 layers/);
  });
});

describe("renderTileMap variant weights", () => {
  it("picks heavier variants proportionally more often", () => {
    const base = createTestTileset();
    const [land] = base.terrains;
    // Mask 15 gets a second variant (palette index 1, i.e. mask-0 colour) weighted 9× the original.
    const tiles = [...(land?.tiles ?? []), { mask: 15, pixels: [[1]], weight: 9 }];
    const tileset = { ...base, terrains: [{ name: "land", tiles }] };
    const size = 30;
    const map: TileMap = { width: size, height: size, layers: [Array.from({ length: size }, () => Array<boolean>(size).fill(true))] };
    const image = renderTileMap(tileset, map);
    let heavyCount = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (readMaskAt(image, x, y) === 0) heavyCount++;
    expect(heavyCount / (size * size)).toBeGreaterThan(0.8);
  });
});
