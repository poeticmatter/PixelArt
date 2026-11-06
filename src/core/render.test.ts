import { describe, expect, it } from "vitest";

import { renderAsset, type RgbaImage } from "./render.ts";
import { createTestAsset } from "./testAssets.ts";

function getPixel(image: RgbaImage, x: number, y: number): number[] {
  const offset = (y * image.width + x) * 4;
  return [...image.data.subarray(offset, offset + 4)];
}

describe("renderAsset", () => {
  it("maps each index to its palette color at scale 1", () => {
    const image = renderAsset(createTestAsset());
    expect([getPixel(image, 0, 0), getPixel(image, 1, 0), getPixel(image, 0, 1), getPixel(image, 1, 1)]).toEqual([
      [0, 0, 0, 0],
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 128],
    ]);
  });

  it("expands every source pixel into a scale×scale block", () => {
    const image = renderAsset(createTestAsset(), 3);
    expect({ width: image.width, height: image.height }).toEqual({ width: 6, height: 6 });
    expect([getPixel(image, 3, 0), getPixel(image, 5, 2)]).toEqual([
      [255, 0, 0, 255],
      [255, 0, 0, 255],
    ]);
  });

  it.each([0, -1, 1.5])("rejects scale %s", (scale) => {
    expect(() => renderAsset(createTestAsset(), scale)).toThrow(/positive integer/);
  });
});
