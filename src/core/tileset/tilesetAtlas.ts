import { copyImageInto, createBlankImage, renderImage, type RgbaImage } from "../render.ts";
import type { PixelMatrix, Projection, Prop, Tile, TilesetAsset, WallFace, WallFloor, WallStrip } from "../types.ts";
import { describeMask, NEIGHBOR_BITS } from "./bitmask.ts";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TileRect extends Rect {
  mask: number;
  /** Readable form of the mask, e.g. "N+E". */
  neighbors: string;
  /** Relative pick frequency among variants with the same mask, when the tileset sets one. */
  weight?: number;
}

interface WallRect extends Rect {
  face: WallFace;
  floor: WallFloor;
  weight?: number;
}

interface PropMetadata extends Omit<Prop, "variants"> {
  variants: (Rect & { weight?: number })[];
}

/** Engine-friendly description of where each tile, wall strip and prop sits in the exported atlas. */
export interface TilesetMetadata {
  image: string;
  tileWidth: number;
  tileHeight: number;
  projection: Projection;
  maskBits: typeof NEIGHBOR_BITS;
  background?: Rect;
  terrains: { name: string; elevation?: number; tiles: TileRect[]; walls?: WallRect[] }[];
  props?: PropMetadata[];
}

/** One atlas row: matrices laid left to right, each at its own width. */
interface AtlasRow {
  matrices: PixelMatrix[];
}

interface AtlasLayout {
  width: number;
  height: number;
  /** rects[row][item], at scale 1. */
  rects: Rect[][];
}

/** Tiles sorted by mask (variants keep file order), so atlas columns read 0, 1, 2… 15. */
function sortTilesByMask(tiles: Tile[]): Tile[] {
  return [...tiles].sort((first, second) => first.mask - second.mask);
}

/** Wall strips grouped left before right, ground before upper. */
function sortWalls(walls: WallStrip[]): WallStrip[] {
  const order = (strip: WallStrip): number => (strip.face === "left" ? 0 : 2) + (strip.floor === "ground" ? 0 : 1);
  return [...walls].sort((first, second) => order(first) - order(second));
}

/** Rows in a fixed order: background, one per terrain, one per terrain with walls, one per prop. */
function getAtlasRows(tileset: TilesetAsset): AtlasRow[] {
  const background = tileset.background ? [{ matrices: [tileset.background.pixels] }] : [];
  const terrains = tileset.terrains.map((terrain) => ({ matrices: sortTilesByMask(terrain.tiles).map((tile) => tile.pixels) }));
  const walls = tileset.terrains.flatMap((terrain) => (terrain.walls ? [{ matrices: sortWalls(terrain.walls).map((strip) => strip.pixels) }] : []));
  const props = (tileset.props ?? []).map((prop) => ({ matrices: prop.variants.map((variant) => variant.pixels) }));
  return [...background, ...terrains, ...walls, ...props];
}

/** Shelf packing: rows stack downward, each as tall as its tallest item. */
function layOutAtlas(rows: AtlasRow[]): AtlasLayout {
  let top = 0;
  let width = 0;
  const rects = rows.map((row) => {
    let left = 0;
    const rowRects = row.matrices.map((matrix) => {
      const rect = { x: left, y: top, width: matrix[0]?.length ?? 0, height: matrix.length };
      left += rect.width;
      return rect;
    });
    width = Math.max(width, left);
    top += Math.max(0, ...rowRects.map((rect) => rect.height));
    return rowRects;
  });
  return { width, height: top, rects };
}

function scaleRect(rect: Rect | undefined, scale: number): Rect {
  return { x: (rect?.x ?? 0) * scale, y: (rect?.y ?? 0) * scale, width: (rect?.width ?? 0) * scale, height: (rect?.height ?? 0) * scale };
}

export function renderTilesetAtlas(tileset: TilesetAsset, scale = 1): RgbaImage {
  const rows = getAtlasRows(tileset);
  const layout = layOutAtlas(rows);
  const output = createBlankImage(layout.width * scale, layout.height * scale);
  rows.forEach((row, rowIndex) => {
    row.matrices.forEach((pixels, column) => {
      const rect = scaleRect(layout.rects[rowIndex]?.[column], scale);
      const image = renderImage({ width: pixels[0]?.length ?? 0, height: pixels.length, palette: tileset.palette, pixels }, scale);
      copyImageInto(output, image, { x: rect.x, y: rect.y });
    });
  });
  return output;
}

const withWeight = (weight: number | undefined): { weight?: number } => (weight === undefined ? {} : { weight });

/** Rectangles in the coordinates of the atlas exported at `scale`, in the same row order as the image. */
export function createTilesetMetadata(tileset: TilesetAsset, imageFileName: string, scale = 1): TilesetMetadata {
  const layout = layOutAtlas(getAtlasRows(tileset));
  const rowsOf = (rowIndex: number): Rect[] => layout.rects[rowIndex] ?? [];
  // Row indices mirror getAtlasRows: background, terrains, terrains' walls, props.
  const terrainRowStart = tileset.background ? 1 : 0;
  let wallRow = terrainRowStart + tileset.terrains.length;
  const wallRowByTerrain = tileset.terrains.map((terrain) => (terrain.walls ? wallRow++ : undefined));
  const propRowStart = wallRow;

  const terrains = tileset.terrains.map((terrain, index) => {
    const tileRects = rowsOf(terrainRowStart + index);
    const tiles = sortTilesByMask(terrain.tiles).map((tile, column) => ({
      mask: tile.mask,
      neighbors: describeMask(tile.mask),
      ...withWeight(tile.weight),
      ...scaleRect(tileRects[column], scale),
    }));
    const wallRowIndex = wallRowByTerrain[index];
    const walls =
      terrain.walls && wallRowIndex !== undefined
        ? sortWalls(terrain.walls).map((strip, column) => ({
            face: strip.face,
            floor: strip.floor,
            ...withWeight(strip.weight),
            ...scaleRect(rowsOf(wallRowIndex)[column], scale),
          }))
        : undefined;
    return { name: terrain.name, ...(terrain.elevation !== undefined && { elevation: terrain.elevation }), tiles, ...(walls && { walls }) };
  });
  const props = (tileset.props ?? []).map(({ variants, ...prop }, index) => {
    const anchor: [number, number] = [prop.anchor[0] * scale, prop.anchor[1] * scale];
    return {
      ...prop,
      anchor,
      variants: variants.map((variant, column) => ({ ...withWeight(variant.weight), ...scaleRect(rowsOf(propRowStart + index)[column], scale) })),
    };
  });
  const background = tileset.background ? scaleRect(rowsOf(0)[0], scale) : undefined;
  return {
    image: imageFileName,
    tileWidth: tileset.tileWidth * scale,
    tileHeight: tileset.tileHeight * scale,
    projection: tileset.projection,
    maskBits: NEIGHBOR_BITS,
    ...(background && { background }),
    terrains,
    ...(tileset.props && { props }),
  };
}
