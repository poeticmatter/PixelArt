import { describe, expect, it } from "vitest";

import { parseHexColor } from "./color.ts";

describe("parseHexColor", () => {
  it("treats #rrggbb as fully opaque", () => {
    expect(parseHexColor("#1a2B3c")).toEqual({ red: 0x1a, green: 0x2b, blue: 0x3c, alpha: 255 });
  });

  it("reads the alpha channel from #rrggbbaa", () => {
    expect(parseHexColor("#00000080").alpha).toBe(0x80);
  });

  it.each(["#fff", "red", "#12345", "1a2b3c", "#gggggg"])("rejects %s", (value) => {
    expect(() => parseHexColor(value)).toThrow(/Invalid color/);
  });
});
