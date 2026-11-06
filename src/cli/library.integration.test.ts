import { describe, expect, it } from "vitest";

import { loadLibraryFromDisk } from "./diskLibrary.ts";

describe("the asset library on disk", () => {
  it("contains only valid assets", () => {
    expect(loadLibraryFromDisk().invalidEntries).toEqual([]);
  });
});
