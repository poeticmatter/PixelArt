import { describe, expect, it } from "vitest";

import { createTestImage, createTestSpriteSheet, createTestTileset } from "../testAssets.ts";
import { validateAsset } from "./validateAsset.ts";

function getErrors(input: unknown): string[] {
  const result = validateAsset(input);
  return result.isValid ? [] : result.errors;
}

describe("validateAsset", () => {
  it("rejects input that is not an object", () => {
    expect(getErrors([1, 2])).toEqual(["Asset must be a JSON object."]);
  });

  it("rejects a missing or unknown type", () => {
    expect(getErrors({ ...createTestImage(), type: "gif" })[0]).toMatch(/"type" must be "image" or "spritesheet"/);
  });
});

describe("validateAsset for images", () => {
  it("accepts a well-formed image", () => {
    expect(validateAsset(createTestImage())).toEqual({ isValid: true, asset: createTestImage() });
  });

  it("reports a row whose length does not match the width", () => {
    const asset = createTestImage({ pixels: [[0, 1, 1], [2, 3]] });
    expect(getErrors(asset)).toEqual([`"pixels"[0] has 3 pixels, expected width 2.`]);
  });

  it("reports a missing row", () => {
    const asset = createTestImage({ pixels: [[0, 1]] });
    expect(getErrors(asset)).toEqual([`"pixels" has 1 rows, expected height 2.`]);
  });

  it("reports a color index outside the palette with its coordinates", () => {
    const asset = createTestImage({ pixels: [[0, 1], [2, 4]] });
    expect(getErrors(asset)).toEqual([`"pixels"[1][1] is 4, expected an index from 0 to 3.`]);
  });

  it("reports a malformed palette color", () => {
    const asset = createTestImage({ palette: [{ name: "bad", color: "#fff" }] });
    expect(getErrors(asset)[0]).toMatch(/palette\[0\]\.color/);
  });

  it("reports every header problem at once", () => {
    expect(getErrors({ type: "image", name: "", width: 0, height: 1.5, palette: [] })).toHaveLength(4);
  });

  it("caps the number of reported errors", () => {
    const asset = createTestImage({ width: 30, height: 1, pixels: [Array.from({ length: 30 }, () => 9)] });
    expect(getErrors(asset).at(-1)).toBe("...and 10 more errors.");
  });
});

describe("validateAsset for sprite sheets", () => {
  it("accepts a well-formed sheet", () => {
    expect(validateAsset(createTestSpriteSheet()).isValid).toBe(true);
  });

  it("locates a bad pixel by animation, frame, row and column", () => {
    const sheet = createTestSpriteSheet();
    const brokenSheet = {
      ...sheet,
      animations: [{ ...sheet.animations[0], frames: [{ pixels: [[1]] }, { pixels: [[7]] }] }],
    };
    expect(getErrors(brokenSheet)).toEqual([
      "animations[0].frames[1].pixels[0][0] is 7, expected an index from 0 to 3.",
    ]);
  });

  it("rejects a sheet without animations", () => {
    expect(getErrors(createTestSpriteSheet({ animations: [] }))).toEqual([`"animations" must be a non-empty array.`]);
  });

  it("rejects an animation without frames", () => {
    const sheet = createTestSpriteSheet({
      animations: [{ name: "idle", frameDurationMs: 100, loop: true, frames: [] }],
    });
    expect(getErrors(sheet)).toEqual(["animations[0].frames must be a non-empty array."]);
  });

  it("rejects duplicate animation names", () => {
    const sheet = createTestSpriteSheet();
    const [idle] = sheet.animations;
    expect(getErrors({ ...sheet, animations: [idle, idle] })).toEqual([`Animation name "idle" is used more than once.`]);
  });

  it("rejects missing timing and loop settings", () => {
    const sheet = { ...createTestSpriteSheet(), animations: [{ name: "idle", frames: [{ pixels: [[1]] }] }] };
    expect(getErrors(sheet)).toEqual([
      "animations[0].frameDurationMs must be a positive integer.",
      "animations[0].loop must be true or false.",
    ]);
  });

  it("rejects a non-positive per-frame duration", () => {
    const sheet = createTestSpriteSheet({
      animations: [{ name: "idle", frameDurationMs: 100, loop: true, frames: [{ pixels: [[1]], durationMs: 0 }] }],
    });
    expect(getErrors(sheet)).toEqual(["animations[0].frames[0].durationMs must be a positive integer when present."]);
  });
});

describe("validateAsset for tilesets", () => {
  it("accepts a well-formed tileset", () => {
    expect(validateAsset(createTestTileset()).isValid).toBe(true);
  });

  it("names every mask a terrain is missing a tile for", () => {
    const tileset = createTestTileset();
    const [terrain] = tileset.terrains;
    const tiles = (terrain?.tiles ?? []).filter((tile) => tile.mask !== 3 && tile.mask !== 12);
    expect(getErrors({ ...tileset, terrains: [{ name: "land", tiles }] })).toEqual([
      "terrains[0] has no tile for mask 3 (N+E), 12 (S+W).",
    ]);
  });

  it("rejects an isometric footprint taller than the tile", () => {
    const tileset = createTestTileset({ tileWidth: 2, projection: { type: "isometric", footprintHeight: 2 } });
    expect(getErrors(tileset)[0]).toMatch(/footprintHeight/);
  });

  it("rejects an odd isometric tile width", () => {
    const tileset = createTestTileset({ projection: { type: "isometric", footprintHeight: 1 } });
    expect(getErrors(tileset)[0]).toMatch(/even "tileWidth"/);
  });

  it("rejects an unknown projection", () => {
    expect(getErrors({ ...createTestTileset(), projection: { type: "hexagonal" } })[0]).toMatch(/projection\.type/);
  });

  it("checks the background tile's size", () => {
    expect(getErrors(createTestTileset({ background: { pixels: [[1, 1]] } }))).toEqual([
      "background.pixels[0] has 2 pixels, expected width 1.",
    ]);
  });
});

describe("validateAsset for tileset generators and elevation", () => {
  const twoTerrains = (): ReturnType<typeof createTestTileset> => {
    const tileset = createTestTileset();
    const [land] = tileset.terrains;
    return { ...tileset, terrains: [{ ...land, name: "road", tiles: land?.tiles ?? [] }, { ...land, name: "block", tiles: land?.tiles ?? [] }] };
  };

  it("accepts a city generator whose roles name existing terrains", () => {
    const tileset = { ...twoTerrains(), generator: { type: "city", roles: { road: "road", building: "block" } } };
    expect(validateAsset(tileset).isValid).toBe(true);
  });

  it("rejects a role that names a missing terrain", () => {
    const tileset = { ...twoTerrains(), generator: { type: "city", roles: { road: "highway" } } };
    expect(getErrors(tileset)).toEqual([`"generator.roles.road" must name one of the tileset's terrains, got "highway".`]);
  });

  it("rejects an unknown city feature", () => {
    const tileset = { ...twoTerrains(), generator: { type: "city", roles: { canal: "road" } } };
    expect(getErrors(tileset)[0]).toMatch(/"generator.roles.canal" is not a city feature/);
  });

  it("rejects an unknown generator type", () => {
    expect(getErrors({ ...createTestTileset(), generator: { type: "maze" } })[0]).toMatch(/"generator.type"/);
  });

  it("rejects a negative terrain elevation", () => {
    const tileset = twoTerrains();
    const [road, block] = tileset.terrains;
    const withElevation = { ...tileset, terrains: [{ ...road, elevation: -1 }, block] };
    expect(getErrors(withElevation)).toEqual(["terrains[0].elevation must be an integer from 0 to 16 when present."]);
  });
});
