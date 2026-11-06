import { describe, expect, it } from "vitest";

import type { MapGeneratorConfig, Projection, TilesetAsset } from "../types.ts";
import { generateTileMap, getMapGenerator } from "./mapGenerator.ts";
import type { Grid, TileMap } from "./tileMap.ts";

const OPTIONS = { width: 24, height: 16, seed: 42 };

type GeneratorInput = Pick<TilesetAsset, "projection" | "generator" | "terrains">;

function createTilesetShape(projection: Projection, terrainNames: string[], generator?: MapGeneratorConfig): GeneratorInput {
  return { projection, generator, terrains: terrainNames.map((name) => ({ name, tiles: [] })) };
}

function countFilled(grid: Grid | undefined): number {
  return (grid ?? []).flat().filter(Boolean).length;
}

function isInside(inner: Grid | undefined, outer: Grid | undefined): boolean {
  return (inner ?? []).every((row, y) => row.every((filled, x) => !filled || (outer?.[y]?.[x] ?? false)));
}

describe("getMapGenerator", () => {
  it("defaults to hills for side view and islands otherwise", () => {
    expect([
      getMapGenerator({ projection: { type: "sideview" } }).type,
      getMapGenerator({ projection: { type: "isometric", footprintHeight: 8 } }).type,
    ]).toEqual(["hills", "island"]);
  });
});

describe("generateTileMap", () => {
  const island = createTilesetShape({ type: "topdown" }, ["sand", "grass"]);

  it("returns the same map for the same seed", () => {
    expect(generateTileMap(island, OPTIONS)).toEqual(generateTileMap(island, OPTIONS));
  });

  it("returns a different map for a different seed", () => {
    expect(generateTileMap(island, OPTIONS)).not.toEqual(generateTileMap(island, { ...OPTIONS, seed: 43 }));
  });

  it("produces one layer per terrain at the requested size", () => {
    const map = generateTileMap(createTilesetShape({ type: "isometric", footprintHeight: 16 }, ["a", "b", "c"]), OPTIONS);
    expect([map.layers.length, map.layers[0]?.length, map.layers[0]?.[0]?.length]).toEqual([3, 16, 24]);
  });

  it.each([3, 129, 10.5])("rejects map size %s", (size) => {
    expect(() => generateTileMap(island, { ...OPTIONS, width: size })).toThrow(/Map width and height/);
  });
});

describe("island maps", () => {
  const map = generateTileMap(createTilesetShape({ type: "topdown" }, ["sand", "grass"]), OPTIONS);

  it("nests each terrain inside the one below it", () => {
    expect(isInside(map.layers[1], map.layers[0])).toBe(true);
  });

  it("keeps the map edges as water", () => {
    const [land] = map.layers;
    const edgeCells = [...(land?.[0] ?? []), ...(land?.at(-1) ?? []), ...(land ?? []).map((row) => row[0])];
    expect(edgeCells.some(Boolean)).toBe(false);
  });
});

describe("hill maps", () => {
  const map = generateTileMap(createTilesetShape({ type: "sideview" }, ["ground", "stone"]), OPTIONS);

  it("buries deeper terrains inside the ground", () => {
    expect(isInside(map.layers[1], map.layers[0])).toBe(true);
  });

  it("fills the bottom row with ground", () => {
    expect(map.layers[0]?.at(-1)?.every(Boolean)).toBe(true);
  });

  it("leaves open sky above the ground", () => {
    const filled = countFilled(map.layers[0]);
    expect(filled > 0 && filled < OPTIONS.width * OPTIONS.height).toBe(true);
  });
});

describe("city maps", () => {
  const LAYER_INDEX = { road: 0, rail: 1, building: 2, tower: 3, walkway: 4, unused: 5 } as const;
  const city = createTilesetShape({ type: "isometric", footprintHeight: 16 }, ["asphalt", "tracks", "blocks", "spires", "bridges", "unused"], {
    type: "city",
    roles: { road: "asphalt", rail: "tracks", building: "blocks", tower: "spires", walkway: "bridges" },
  });
  const maps = [1, 2, 3, 4, 5].map((seed) => generateTileMap(city, { width: 32, height: 32, seed }));
  const layerOf = (map: TileMap, feature: keyof typeof LAYER_INDEX): Grid | undefined => map.layers[LAYER_INDEX[feature]];
  const overlaps = (first: Grid | undefined, second: Grid | undefined): boolean =>
    (first ?? []).some((row, y) => row.some((filled, x) => filled && (second?.[y]?.[x] ?? false)));

  it("puts each feature on the layer of the terrain its role names", () => {
    expect(maps.every((map) => countFilled(layerOf(map, "road")) > 0 && countFilled(layerOf(map, "building")) > 0)).toBe(true);
  });

  it("leaves terrains without a role empty", () => {
    expect(maps.every((map) => countFilled(layerOf(map, "unused")) === 0)).toBe(true);
  });

  it("only places towers on top of buildings", () => {
    expect(maps.every((map) => isInside(layerOf(map, "tower"), layerOf(map, "building")))).toBe(true);
  });

  it("never puts buildings on streets or rails", () => {
    const isBlocked = maps.some(
      (map) => overlaps(layerOf(map, "building"), layerOf(map, "road")) || overlaps(layerOf(map, "building"), layerOf(map, "rail")),
    );
    expect(isBlocked).toBe(false);
  });

  it("only builds walkways over open ground, never over buildings", () => {
    expect(maps.some((map) => overlaps(layerOf(map, "walkway"), layerOf(map, "building")))).toBe(false);
  });

  it("builds some walkways and rail lines across a range of seeds", () => {
    expect([
      maps.some((map) => countFilled(layerOf(map, "walkway")) > 0),
      maps.some((map) => countFilled(layerOf(map, "rail")) > 0),
    ]).toEqual([true, true]);
  });
});
