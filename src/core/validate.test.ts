import { describe, expect, it } from "vitest";

import { createTestAsset } from "./testAssets.ts";
import { validateAsset } from "./validate.ts";

function getErrors(input: unknown): string[] {
  const result = validateAsset(input);
  return result.isValid ? [] : result.errors;
}

describe("validateAsset", () => {
  it("accepts a well-formed asset", () => {
    expect(validateAsset(createTestAsset())).toEqual({ isValid: true, asset: createTestAsset() });
  });

  it("rejects input that is not an object", () => {
    expect(getErrors([1, 2])).toEqual(["Asset must be a JSON object."]);
  });

  it("reports a row whose length does not match the width", () => {
    const asset = createTestAsset({ pixels: [[0, 1, 1], [2, 3]] });
    expect(getErrors(asset)).toEqual(["pixels[0] has 3 pixels, expected width 2."]);
  });

  it("reports a missing row", () => {
    const asset = createTestAsset({ pixels: [[0, 1]] });
    expect(getErrors(asset)).toEqual([`"pixels" has 1 rows, expected height 2.`]);
  });

  it("reports a color index outside the palette with its coordinates", () => {
    const asset = createTestAsset({ pixels: [[0, 1], [2, 4]] });
    expect(getErrors(asset)).toEqual(["pixels[1][1] is 4, expected an index from 0 to 3."]);
  });

  it("reports a malformed palette color", () => {
    const asset = createTestAsset({ palette: [{ name: "bad", color: "#fff" }] });
    expect(getErrors(asset)[0]).toMatch(/palette\[0\]\.color/);
  });

  it("reports every header problem at once", () => {
    expect(getErrors({ name: "", width: 0, height: 1.5, palette: [] })).toHaveLength(4);
  });

  it("caps the number of reported pixel errors", () => {
    const asset = createTestAsset({ width: 20, height: 1, pixels: [Array.from({ length: 20 }, () => 9)] });
    expect(getErrors(asset).at(-1)).toBe("...and 10 more pixel errors.");
  });
});
