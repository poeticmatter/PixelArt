import { describe, expect, it } from "vitest";

import { createTestTileset } from "../testAssets.ts";
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
