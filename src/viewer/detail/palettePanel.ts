import { getAllPixelMatrices } from "../../core/assetSummary.ts";
import type { Asset } from "../../core/types.ts";
import { createElement, createSidebarSection } from "../dom.ts";

/** How often each palette index is used, summed over every frame of a sprite sheet. */
export function countPixelsByColorIndex(asset: Asset): number[] {
  const counts = asset.palette.map(() => 0);
  for (const matrix of getAllPixelMatrices(asset)) {
    for (const row of matrix) {
      for (const colorIndex of row) {
        counts[colorIndex] = (counts[colorIndex] ?? 0) + 1;
      }
    }
  }
  return counts;
}

/** Lists every palette color with its index, so the pixel matrix can be read alongside the image. */
export function createPalettePanel(asset: Asset): HTMLElement {
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
  return createSidebarSection(`Palette (${asset.palette.length})`, [createElement("ol", { className: "palette" }, rows)]);
}
