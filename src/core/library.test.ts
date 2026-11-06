import { describe, expect, it } from "vitest";

import { buildLibrary, getAssetFolder, toAssetId } from "./library.ts";
import { createTestImage } from "./testAssets.ts";

describe("toAssetId", () => {
  it("normalizes Windows separators and drops the extension", () => {
    expect(toAssetId("cats\\cat-2-color.json")).toBe("cats/cat-2-color");
  });
});

describe("getAssetFolder", () => {
  it("returns an empty folder for top-level assets", () => {
    expect([getAssetFolder("cats/tabby"), getAssetFolder("tabby")]).toEqual(["cats", ""]);
  });
});

describe("buildLibrary", () => {
  it("separates valid assets from invalid ones and sorts by id", () => {
    const library = buildLibrary([
      { relativePath: "b.json", json: createTestImage() },
      { relativePath: "a.json", json: createTestImage() },
      { relativePath: "broken.json", parseError: "Invalid JSON: Unexpected token" },
      { relativePath: "wrong.json", json: { name: "x" } },
    ]);
    expect({
      validIds: library.entries.map((entry) => entry.id),
      invalidIds: library.invalidEntries.map((entry) => entry.id),
    }).toEqual({ validIds: ["a", "b"], invalidIds: ["broken", "wrong"] });
  });
});
