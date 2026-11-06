import { hashPosition } from "../random.ts";
import { renderImage, type RgbaImage } from "../render.ts";
import type { PixelMatrix, TilesetAsset } from "../types.ts";
import { MASK_COUNT } from "./bitmask.ts";

export const DEFAULT_VARIANT_WEIGHT = 1;

interface WeightedTileImage {
  image: RgbaImage;
  weight: number;
}

/** Every tile pre-rendered at one scale, grouped so a map cell's tile is a lookup. */
export interface RenderedTileset {
  background: RgbaImage | undefined;
  /** variantsByMask[terrain][mask] lists that mask's variants with their weights. */
  variantsByMask: WeightedTileImage[][][];
}

export function renderTileImage(tileset: TilesetAsset, pixels: PixelMatrix, scale: number): RgbaImage {
  return renderImage({ width: tileset.tileWidth, height: tileset.tileHeight, palette: tileset.palette, pixels }, scale);
}

export function renderTilesetImages(tileset: TilesetAsset, scale: number): RenderedTileset {
  return {
    background: tileset.background && renderTileImage(tileset, tileset.background.pixels, scale),
    variantsByMask: tileset.terrains.map((terrain) => {
      const byMask: WeightedTileImage[][] = Array.from({ length: MASK_COUNT }, () => []);
      for (const tile of terrain.tiles) {
        byMask[tile.mask]?.push({ image: renderTileImage(tileset, tile.pixels, scale), weight: tile.weight ?? DEFAULT_VARIANT_WEIGHT });
      }
      return byMask;
    }),
  };
}

/** Picks a variant by position and weight, so the same map always renders the same way. */
export function selectTileImage(
  rendered: RenderedTileset,
  cell: { terrain: number; mask: number; x: number; y: number },
): RgbaImage | undefined {
  const variants = rendered.variantsByMask[cell.terrain]?.[cell.mask] ?? [];
  const totalWeight = variants.reduce((total, variant) => total + variant.weight, 0);
  let remaining = hashPosition(cell.x, cell.y, cell.terrain) * totalWeight;
  for (const variant of variants) {
    remaining -= variant.weight;
    if (remaining < 0) {
      return variant.image;
    }
  }
  return variants.at(-1)?.image;
}
