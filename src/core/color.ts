import type { Rgba } from "./types.ts";

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/;
const OPAQUE_ALPHA = 255;

export function isHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value);
}

/** Parses "#rrggbb" or "#rrggbbaa". Throws on anything else. */
export function parseHexColor(value: string): Rgba {
  const match = HEX_COLOR_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid color "${value}": expected "#rrggbb" or "#rrggbbaa".`);
  }
  const [, rgbHex = "", alphaHex] = match;
  return {
    red: parseInt(rgbHex.slice(0, 2), 16),
    green: parseInt(rgbHex.slice(2, 4), 16),
    blue: parseInt(rgbHex.slice(4, 6), 16),
    alpha: alphaHex === undefined ? OPAQUE_ALPHA : parseInt(alphaHex, 16),
  };
}
