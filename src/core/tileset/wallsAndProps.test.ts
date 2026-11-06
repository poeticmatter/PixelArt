import { describe, expect, it } from "vitest";

import type { RgbaImage } from "../render.ts";
import { createTestIsometricTileset, ISO_COLORS } from "../testAssets.ts";
import type { Prop, TilesetAsset } from "../types.ts";
import { getWallBase, listLayersByHeight } from "./mapQueries.ts";
import { placePropsInCell } from "./propPlacement.ts";
import { renderTileMap } from "./renderTileMap.ts";
import type { TileMap } from "./tileMap.ts";

const BLOCK = 1;

/** A 2×2 map with a block only at (0,0), so its S and E neighbours are open and both faces show. */
function createBlockMap(blockElevation?: number): TileMap {
  const all = [
    [true, true],
    [true, true],
  ];
  const corner = [
    [true, false],
    [false, false],
  ];
  return {
    width: 2,
    height: 2,
    layers: [all, corner],
    elevations: blockElevation === undefined ? undefined : [undefined, [[blockElevation, 0], [0, 0]]],
  };
}

/** Rows (y) where the given colour appears; colours are told apart by their red channel. */
function rowsWithColor(image: RgbaImage, color: number): number[] {
  const rows = new Set<number>();
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const offset = (y * image.width + x) * 4;
      if (image.data[offset] === color && image.data[offset + 3] === 255) rows.add(y);
    }
  }
  return [...rows].sort((first, second) => first - second);
}

describe("map queries", () => {
  it("orders a cell's layers by height, not by tileset order", () => {
    const tileset = createTestIsometricTileset();
    const reversed = { ...tileset, terrains: [...tileset.terrains].reverse() };
    const map: TileMap = { width: 1, height: 1, layers: [[[true]], [[true]]] };
    expect(listLayersByHeight(reversed, map, { x: 0, y: 0 })).toEqual([1, 0]);
  });

  it("stops a tower's walls at the roof of the building beneath it", () => {
    const tileset = createTestIsometricTileset();
    const block = tileset.terrains[BLOCK];
    if (!block) throw new Error("missing block terrain");
    const withTower: TilesetAsset = { ...tileset, terrains: [...tileset.terrains, { ...block, name: "tower", elevation: 7 }] };
    const map: TileMap = { width: 1, height: 1, layers: [[[true]], [[true]], [[true]]] };
    expect([getWallBase(withTower, map, 2, { x: 0, y: 0 }), getWallBase(withTower, map, BLOCK, { x: 0, y: 0 })]).toEqual([3, 0]);
  });
});

describe("renderTileMap walls", () => {
  it("repeats wall strips under the cap, with the ground strip lowest", () => {
    const image = renderTileMap({ ...createTestIsometricTileset(), props: [] }, createBlockMap());
    const groundRows = rowsWithColor(image, ISO_COLORS.ground);
    const upperRows = rowsWithColor(image, ISO_COLORS.upper);
    // The upper storeys start higher up the wall than the ground storey does.
    expect(groundRows.length > 0 && upperRows.length > 0 && Math.min(...groundRows) > Math.min(...upperRows)).toBe(true);
  });

  it("falls back to the other floor type when a face lacks one", () => {
    // The right face has only an "upper" strip, so its ground storey uses it too.
    const image = renderTileMap({ ...createTestIsometricTileset(), props: [] }, createBlockMap());
    expect(Math.max(...rowsWithColor(image, ISO_COLORS.upper))).toBe(Math.max(...rowsWithColor(image, ISO_COLORS.ground)));
  });

  it("draws more storeys of wall for a taller per-cell height", () => {
    const tileset = { ...createTestIsometricTileset(), props: [] };
    const short = rowsWithColor(renderTileMap(tileset, createBlockMap(2)), ISO_COLORS.upper).length;
    const tall = rowsWithColor(renderTileMap(tileset, createBlockMap(6)), ISO_COLORS.upper).length;
    expect(tall).toBeGreaterThan(short);
  });

  it("draws no walls on a cell whose S and E neighbours share the terrain", () => {
    const map: TileMap = { width: 1, height: 1, layers: [[[true]], [[true]]] };
    const image = renderTileMap({ ...createTestIsometricTileset(), props: [] }, map);
    expect(rowsWithColor(image, ISO_COLORS.upper)).toEqual([]);
  });
});

describe("prop placement", () => {
  const cell = { x: 0, y: 0 };

  function withProp(changes: Partial<Prop>): TilesetAsset {
    const tileset = createTestIsometricTileset();
    const [prop] = tileset.props ?? [];
    if (!prop) throw new Error("test tileset needs a prop");
    return { ...tileset, props: [{ ...prop, ...changes }] };
  }

  it("puts a top prop at the centre of the top surface", () => {
    expect(placePropsInCell(withProp({}), createBlockMap(), cell)).toEqual([{ propIndex: 0, variantIndex: 0, u: 0.5, v: 0.5, height: 3 }]);
  });

  it("skips cells where the prop's terrain is not the top layer", () => {
    expect(placePropsInCell(withProp({ on: "street" }), createBlockMap(), cell)).toEqual([]);
  });

  it("never places a prop whose chance is 0", () => {
    expect(placePropsInCell(withProp({ chance: 0 }), createBlockMap(), cell)).toEqual([]);
  });

  it("respects the mask filter", () => {
    expect(placePropsInCell(withProp({ masks: [15] }), createBlockMap(), cell)).toEqual([]);
  });

  it("puts a wall prop on a drawn face, within its storey range", () => {
    const [instance] = placePropsInCell(withProp({ place: "left", floors: [1, 1] }), createBlockMap(), cell);
    expect(instance).toMatchObject({ u: 0.5, v: 1, height: 1.5 });
  });

  it("skips wall props on faces that are not drawn", () => {
    const enclosed: TileMap = { width: 1, height: 1, layers: [[[true]], [[true]]] };
    expect(placePropsInCell(withProp({ place: "right" }), enclosed, cell)).toEqual([]);
  });

  it("paints the prop sprite into the rendered map", () => {
    expect(rowsWithColor(renderTileMap(withProp({}), createBlockMap()), ISO_COLORS.prop).length).toBe(1);
  });
});
