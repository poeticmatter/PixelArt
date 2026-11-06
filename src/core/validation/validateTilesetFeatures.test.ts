import { describe, expect, it } from "vitest";

import { createTestIsometricTileset, createTestTileset, ISO_STRIP_SIZE } from "../testAssets.ts";
import type { Prop, TilesetAsset, WallStrip } from "../types.ts";
import { validateAsset } from "./validateAsset.ts";

function getErrors(input: unknown): string[] {
  const result = validateAsset(input);
  return result.isValid ? [] : result.errors;
}

function withBlockWalls(walls: WallStrip[]): TilesetAsset {
  const tileset = createTestIsometricTileset();
  const [street, block] = tileset.terrains;
  if (!street || !block) throw new Error("test tileset needs two terrains");
  return { ...tileset, terrains: [street, { ...block, walls }] };
}

function withProp(changes: Partial<Prop>): TilesetAsset {
  const tileset = createTestIsometricTileset();
  const [prop] = tileset.props ?? [];
  if (!prop) throw new Error("test tileset needs a prop");
  return { ...tileset, props: [{ ...prop, ...changes }] };
}

const strip = (face: WallStrip["face"], floor: WallStrip["floor"], width = ISO_STRIP_SIZE.width): WallStrip => ({
  face,
  floor,
  pixels: Array.from({ length: ISO_STRIP_SIZE.height }, () => Array<number>(width).fill(1)),
});

describe("validateAsset for terrain walls", () => {
  it("accepts the isometric test tileset", () => {
    expect(validateAsset(createTestIsometricTileset()).isValid).toBe(true);
  });

  it("rejects walls on a non-isometric tileset", () => {
    const tileset = createTestTileset();
    const [land] = tileset.terrains;
    const withWalls = { ...tileset, terrains: [{ ...land, walls: [strip("left", "upper")] }] };
    expect(getErrors(withWalls)).toEqual(["terrains[0].walls is only supported for isometric tilesets."]);
  });

  it("requires a strip for each face", () => {
    expect(getErrors(withBlockWalls([strip("left", "upper")]))).toEqual(["terrains[1].walls has no strip for the right face."]);
  });

  it("checks strip size against half a tile by one step plus the slope", () => {
    const errors = getErrors(withBlockWalls([strip("left", "upper", 3), strip("right", "upper")]));
    expect(errors[0]).toMatch(/terrains\[1\]\.walls\[0\]\.pixels\[0\] has 3 pixels, expected width 2/);
  });

  it("rejects an unknown face or floor", () => {
    const bad = { ...strip("left", "upper"), face: "front", floor: "roof" };
    expect(getErrors(withBlockWalls([bad as unknown as WallStrip, strip("right", "upper")]))).toEqual([
      `terrains[1].walls[0].face must be "left" or "right".`,
      `terrains[1].walls[0].floor must be "ground" or "upper".`,
      "terrains[1].walls has no strip for the left face.",
    ]);
  });
});

describe("validateAsset for props", () => {
  it("rejects a prop on a terrain that doesn't exist", () => {
    expect(getErrors(withProp({ on: "lake" }))[0]).toMatch(/props\[0\]\.on must name one of the tileset's terrains/);
  });

  it("rejects wall props on a non-isometric tileset", () => {
    const tileset = createTestTileset({
      props: [{ name: "sign", on: "land", place: "left", chance: 1, anchor: [0, 0], variants: [{ pixels: [[1]] }] }],
    });
    expect(getErrors(tileset)[0]).toMatch(/is a wall placement, which needs an isometric tileset/);
  });

  it("rejects floors on a top prop", () => {
    expect(getErrors(withProp({ floors: [0, 2] }))).toEqual([`props[0].floors only applies to wall props ("left" or "right").`]);
  });

  it("rejects an anchor outside the sprite", () => {
    expect(getErrors(withProp({ anchor: [1, 0] }))).toEqual(["props[0].anchor must be [x, y] inside the 1×1 sprite."]);
  });

  it("requires every variant to match the first one's size", () => {
    expect(getErrors(withProp({ variants: [{ pixels: [[1]] }, { pixels: [[1, 1]] }] }))[0]).toMatch(
      /props\[0\]\.variants\[1\]\.pixels\[0\] has 2 pixels, expected width 1/,
    );
  });

  it("rejects a chance outside 0 to 1", () => {
    expect(getErrors(withProp({ chance: 1.5 }))).toEqual(["props[0].chance must be a number from 0 to 1."]);
  });

  it("rejects masks outside 0 to 15", () => {
    expect(getErrors(withProp({ masks: [16] }))).toEqual(["props[0].masks must be a non-empty list of masks from 0 to 15 when present."]);
  });
});

describe("validateAsset for city generator options", () => {
  const withGenerator = (options: Record<string, unknown>): unknown => ({
    ...createTestIsometricTileset(),
    generator: { type: "city", roles: { road: "street", building: "block" }, ...options },
  });

  it("accepts a full set of valid options", () => {
    const options = {
      blockSize: [3, 6],
      roadWidth: 2,
      setback: 0,
      openSpace: 0.1,
      buildingHeight: [2, 4],
      towerHeight: [3, 9],
      towerChance: 0.6,
      railElevation: 3,
      walkwayElevation: 2,
    };
    expect(validateAsset(withGenerator(options)).isValid).toBe(true);
  });

  it("rejects a reversed range", () => {
    expect(getErrors(withGenerator({ buildingHeight: [4, 2] }))).toEqual([`"generator.buildingHeight" must be [min, max] storeys from 1 to 16 when present.`]);
  });

  it("rejects a zero-width road", () => {
    expect(getErrors(withGenerator({ roadWidth: 0 }))).toEqual([`"generator.roadWidth" must be an integer from 1 to 6 when present.`]);
  });

  it("accepts the sidewalk role", () => {
    expect(validateAsset(withGenerator({ roles: { sidewalk: "street" } })).isValid).toBe(true);
  });
});
