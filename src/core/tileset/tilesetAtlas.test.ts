import { describe, expect, it } from "vitest";

import { createTestIsometricTileset, createTestTileset, ISO_STRIP_SIZE } from "../testAssets.ts";
import { createTilesetMetadata, renderTilesetAtlas } from "./tilesetAtlas.ts";

const BACKGROUND = { pixels: [[1]] };

describe("renderTilesetAtlas", () => {
  it("has one row per terrain plus a background row, and one column per tile", () => {
    const atlas = renderTilesetAtlas(createTestTileset({ background: BACKGROUND }), 2);
    expect({ width: atlas.width, height: atlas.height }).toEqual({ width: 32, height: 4 });
  });
});

describe("createTilesetMetadata", () => {
  it("places terrain tiles below the background row, ordered by mask", () => {
    const metadata = createTilesetMetadata(createTestTileset({ background: BACKGROUND }), "tiles.png");
    expect(metadata.terrains[0]?.tiles[6]).toEqual({ mask: 6, neighbors: "E+S", x: 6, y: 1, width: 1, height: 1 });
  });

  it("omits the background when the tileset has none", () => {
    expect(createTilesetMetadata(createTestTileset(), "tiles.png").background).toBeUndefined();
  });
});

describe("createTilesetMetadata with walls and props", () => {
  const metadata = createTilesetMetadata(createTestIsometricTileset(), "city.png", 2);

  it("lists each terrain's wall strips with their face, floor and rectangle", () => {
    // Rows: two terrains of 4px tiles, then the block's walls, at scale 2.
    expect(metadata.terrains[1]?.walls?.[0]).toEqual({
      face: "left",
      floor: "ground",
      x: 0,
      y: 16,
      width: ISO_STRIP_SIZE.width * 2,
      height: ISO_STRIP_SIZE.height * 2,
    });
  });

  it("lists props with their placement rules and a scaled anchor", () => {
    expect(metadata.props?.[0]).toMatchObject({ name: "antenna", on: "block", place: "top", anchor: [0, 0], variants: [{ width: 2, height: 2 }] });
  });
});
