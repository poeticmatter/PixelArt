import { describe, expect, it } from "vitest";

import { cropImage, findDensestWindow } from "./crop.ts";
import { createBlankImage, type RgbaImage } from "./render.ts";

function setPixel(image: RgbaImage, x: number, y: number, value: number): void {
  const offset = (y * image.width + x) * 4;
  image.data.set([value, value, value, 255], offset);
}

describe("cropImage", () => {
  it("copies the requested rectangle", () => {
    const image = createBlankImage(4, 4);
    setPixel(image, 2, 3, 200);
    const crop = cropImage(image, { x: 2, y: 2, width: 2, height: 2 });
    expect([crop.width, crop.height, crop.data[(1 * 2 + 0) * 4]]).toEqual([2, 2, 200]);
  });

  it("rejects a rectangle that leaves the image", () => {
    expect(() => cropImage(createBlankImage(4, 4), { x: 3, y: 0, width: 2, height: 2 })).toThrow(/does not fit/);
  });
});

describe("findDensestWindow", () => {
  it("finds the busiest area", () => {
    const image = createBlankImage(64, 64);
    for (let y = 40; y < 56; y++) {
      for (let x = 32; x < 48; x++) {
        setPixel(image, x, y, (x + y) % 2 === 0 ? 255 : 0);
      }
    }
    expect(findDensestWindow(image, { width: 16, height: 16 }, 8)).toEqual({ x: 32, y: 40, width: 16, height: 16 });
  });

  it("shrinks the window to fit a small image", () => {
    expect(findDensestWindow(createBlankImage(10, 6), { width: 640, height: 360 })).toEqual({ x: 0, y: 0, width: 10, height: 6 });
  });
});
