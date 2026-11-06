import { describe, expect, it } from "vitest";

import { clampZoom, getNextZoomIn, getNextZoomOut } from "./zoom.ts";

describe("zoom steps", () => {
  it("steps to the neighbouring level from an in-between zoom", () => {
    expect([getNextZoomIn(5), getNextZoomOut(5)]).toEqual([6, 4]);
  });

  it("stays within the supported range", () => {
    expect([getNextZoomIn(64), getNextZoomOut(1), clampZoom(500), clampZoom(0)]).toEqual([64, 1, 64, 1]);
  });
});
