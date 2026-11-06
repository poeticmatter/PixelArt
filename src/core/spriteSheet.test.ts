import { describe, expect, it } from "vitest";

import { createSheetMetadata, getFrameDurations, getSheetGrid, renderSpriteSheet } from "./spriteSheet.ts";
import { createTestSpriteSheet } from "./testAssets.ts";

describe("getSheetGrid", () => {
  it("has one row per animation and as many columns as the longest animation", () => {
    expect(getSheetGrid(createTestSpriteSheet())).toEqual({ columns: 2, rows: 2 });
  });
});

describe("getFrameDurations", () => {
  it("uses a frame's own duration over the animation default", () => {
    const [idle, jump] = createTestSpriteSheet().animations;
    expect([idle && getFrameDurations(idle), jump && getFrameDurations(jump)]).toEqual([[100, 100], [300]]);
  });
});

describe("renderSpriteSheet", () => {
  it("places frames left to right, animations top to bottom, and leaves unused cells transparent", () => {
    const image = renderSpriteSheet(createTestSpriteSheet(), 1);
    const pixels = Array.from({ length: 4 }, (_, index) => [...image.data.subarray(index * 4, index * 4 + 4)]);
    expect(pixels).toEqual([
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 128],
      [0, 0, 0, 0],
    ]);
  });
});

describe("createSheetMetadata", () => {
  it("gives each frame its rectangle at the export scale and its duration", () => {
    const metadata = createSheetMetadata(createTestSpriteSheet(), "sheet@4x.png", 4);
    expect(metadata.animations[0]?.frames[1]).toEqual({ x: 4, y: 0, width: 4, height: 4, durationMs: 100 });
    expect(metadata.animations[1]).toMatchObject({ name: "jump", loop: false, frames: [{ x: 0, y: 4, durationMs: 300 }] });
  });
});
