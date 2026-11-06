import type { PixelAsset } from "../core/types.ts";
import { createElement } from "./dom.ts";

export function countPixelsByColorIndex(asset: PixelAsset): number[] {
  const counts = asset.palette.map(() => 0);
  for (const row of asset.pixels) {
    for (const colorIndex of row) {
      counts[colorIndex] = (counts[colorIndex] ?? 0) + 1;
    }
  }
  return counts;
}

/** Lists every palette color with its index, so the pixel matrix can be read alongside the image. */
export function createPalettePanel(asset: PixelAsset): HTMLElement {
  const pixelCounts = countPixelsByColorIndex(asset);
  const rows = asset.palette.map((entry, index) =>
    createElement("li", { className: "palette__row" }, [
      createElement("span", { className: "palette__index", text: String(index) }),
      createElement("span", { className: "palette__swatch checkerboard" }, [
        createElement("span", { className: "palette__swatch-fill", attributes: { style: `background:${entry.color}` } }),
      ]),
      createElement("span", { className: "palette__name", text: entry.name }),
      createElement("code", { className: "palette__hex", text: entry.color }),
      createElement("span", { className: "palette__count", text: `${pixelCounts[index] ?? 0} px` }),
    ]),
  );
  return createElement("section", { className: "detail__section" }, [
    createElement("h3", { text: `Palette (${asset.palette.length})` }),
    createElement("ol", { className: "palette" }, rows),
  ]);
}
