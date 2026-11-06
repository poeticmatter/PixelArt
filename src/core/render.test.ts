import { describe, expect, it } from "vitest";

import { drawImageOver, renderImage, type RgbaImage } from "./render.ts";
import { createTestImage } from "./testAssets.ts";

function getPixel(image: RgbaImage, x: number, y: number): number[] {
  const offset = (y * image.width + x) * 4;
  return [...image.data.subarray(offset, offset + 4)];
}

describe("renderImage", () => {
  it("maps each index to its palette color at scale 1", () => {
    const image = renderImage(createTestImage());
    expect([getPixel(image, 0, 0), getPixel(image, 1, 0), getPixel(image, 0, 1), getPixel(image, 1, 1)]).toEqual([
      [0, 0, 0, 0],
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 128],
    ]);
  });

  it("expands every source pixel into a scale×scale block", () => {
    const image = renderImage(createTestImage(), 3);
    expect({ width: image.width, height: image.height }).toEqual({ width: 6, height: 6 });
    expect([getPixel(image, 3, 0), getPixel(image, 5, 2)]).toEqual([
      [255, 0, 0, 255],
      [255, 0, 0, 255],
    ]);
  });

  it.each([0, -1, 1.5])("rejects scale %s", (scale) => {
    expect(() => renderImage(createTestImage(), scale)).toThrow(/positive integer/);
  });
});

function createSolidImage(rgba: number[]): RgbaImage {
  return { width: 1, height: 1, data: new Uint8ClampedArray(rgba) };
}

describe("drawImageOver", () => {
  it("leaves the target unchanged where the source is transparent", () => {
    const target = createSolidImage([10, 20, 30, 255]);
    drawImageOver(target, createSolidImage([255, 0, 0, 0]), { x: 0, y: 0 });
    expect([...target.data]).toEqual([10, 20, 30, 255]);
  });

  it("blends a half-transparent source over an opaque target", () => {
    const target = createSolidImage([0, 0, 0, 255]);
    drawImageOver(target, createSolidImage([255, 255, 255, 128]), { x: 0, y: 0 });
    expect([...target.data]).toEqual([128, 128, 128, 255]);
  });

  it("ignores source pixels that fall outside the target", () => {
    const target = createSolidImage([0, 0, 0, 255]);
    drawImageOver(target, createSolidImage([255, 0, 0, 255]), { x: 1, y: -1 });
    expect([...target.data]).toEqual([0, 0, 0, 255]);
  });
});
