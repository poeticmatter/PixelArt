import { assertValidScale, createBlankImage, drawImageOver, type RgbaImage } from "../render.ts";
import type { TilesetAsset, WallFace } from "../types.ts";
import { NEIGHBOR_BITS } from "./bitmask.ts";
import {
  type Cell,
  getCellElevation,
  getLayerMask,
  getTerrainElevation,
  getWallBase,
  listLayersByHeight,
} from "./mapQueries.ts";
import { placePropsInCell } from "./propPlacement.ts";
import type { TileMap } from "./tileMap.ts";
import { type RenderedTileset, renderTilesetImages, selectTileImage, selectWallImage } from "./tilesetImages.ts";

export { getTerrainElevation };

interface Point {
  x: number;
  y: number;
}

/** Where things go on the output image. Heights are in steps (storeys). */
interface MapLayout {
  width: number;
  height: number;
  /** Top-left of a tile image for a cell whose surface is at `elevation`. */
  getTileOrigin(cell: Cell, elevation: number): Point;
  /** Screen position of grid point (u, v) of a cell at `height` steps. */
  project(cell: Cell, u: number, v: number, height: number): Point;
  /** Cells in the order they must be painted so nearer tiles cover farther ones. */
  paintOrder: Cell[];
}

function listCellsRowByRow(map: TileMap): Cell[] {
  return Array.from({ length: map.height }, (_, y) => Array.from({ length: map.width }, (_, x) => ({ x, y }))).flat();
}

function createGridLayout(map: TileMap, tileWidth: number, tileHeight: number, topPadding: number): MapLayout {
  return {
    width: map.width * tileWidth,
    height: topPadding + map.height * tileHeight,
    getTileOrigin: (cell) => ({ x: cell.x * tileWidth, y: topPadding + cell.y * tileHeight }),
    project: (cell, u, v) => ({ x: (cell.x + u) * tileWidth, y: topPadding + (cell.y + v) * tileHeight }),
    paintOrder: listCellsRowByRow(map),
  };
}

/** The highest surface on the map, in steps, so the image leaves room above it. */
function getHighestElevation(tileset: TilesetAsset, map: TileMap): number {
  let highest = 0;
  map.layers.forEach((grid, layer) =>
    grid.forEach((row, y) =>
      row.forEach((isFilled, x) => {
        if (isFilled) {
          highest = Math.max(highest, getCellElevation(tileset, map, layer, { x, y }));
        }
      }),
    ),
  );
  return highest;
}

interface IsometricMetrics {
  tileWidth: number;
  tileHeight: number;
  footprintHeight: number;
  topPadding: number;
}

/**
 * Diamond layout: moving +x steps down-right, +y steps down-left. Each elevation step raises
 * a tile by its side-face depth, and cells paint back (top) to front (bottom).
 */
function createIsometricLayout(map: TileMap, metrics: IsometricMetrics): MapLayout {
  const { tileWidth, tileHeight, footprintHeight, topPadding } = metrics;
  const halfWidth = tileWidth / 2;
  const halfHeight = footprintHeight / 2;
  const stepRise = tileHeight - footprintHeight;
  const originX = (map.height - 1) * halfWidth;
  const diagonalCount = map.width + map.height - 1;
  const getTileOrigin = (cell: Cell, elevation: number): Point => ({
    x: originX + (cell.x - cell.y) * halfWidth,
    y: topPadding + (cell.x + cell.y) * halfHeight - elevation * stepRise,
  });
  return {
    width: (map.width + map.height) * halfWidth,
    height: topPadding + (diagonalCount - 1) * halfHeight + tileHeight,
    getTileOrigin,
    project: (cell, u, v, height) => {
      const origin = getTileOrigin(cell, height);
      return { x: origin.x + halfWidth * (1 + u - v), y: origin.y + halfHeight * (u + v) };
    },
    paintOrder: listCellsRowByRow(map).sort((first, second) => first.x + first.y - (second.x + second.y)),
  };
}

/** Room above the map for props standing on the highest surfaces. */
function getPropHeadroom(tiles: RenderedTileset): number {
  return Math.max(0, ...tiles.props.flatMap((variants) => variants.map((variant) => variant.image.height)));
}

function createLayout(tileset: TilesetAsset, map: TileMap, scale: number, tiles: RenderedTileset): MapLayout {
  const { projection } = tileset;
  const tileWidth = tileset.tileWidth * scale;
  const tileHeight = tileset.tileHeight * scale;
  const headroom = getPropHeadroom(tiles);
  if (projection.type !== "isometric") {
    return createGridLayout(map, tileWidth, tileHeight, headroom);
  }
  const footprintHeight = projection.footprintHeight * scale;
  const topPadding = getHighestElevation(tileset, map) * (tileHeight - footprintHeight) + headroom;
  return createIsometricLayout(map, { tileWidth, tileHeight, footprintHeight, topPadding });
}

interface PaintContext {
  tileset: TilesetAsset;
  map: TileMap;
  layout: MapLayout;
  tiles: RenderedTileset;
  scale: number;
}

function getDrawnFaces(mask: number): WallFace[] {
  const faces: WallFace[] = [];
  if ((mask & NEIGHBOR_BITS.south) === 0) {
    faces.push("left");
  }
  if ((mask & NEIGHBOR_BITS.east) === 0) {
    faces.push("right");
  }
  return faces;
}

/**
 * Repeats wall strips under a layer's cap, one per storey, down to the layer beneath. The
 * cap's own side face is the top storey, so strips cover the storeys below it.
 */
function paintWalls(output: RgbaImage, layer: number, cell: Cell, context: PaintContext): void {
  const { tileset, map, layout, tiles, scale } = context;
  const walls = tiles.walls[layer];
  if (!walls || tileset.projection.type !== "isometric") {
    return;
  }
  const faces = getDrawnFaces(getLayerMask(map, layer, cell));
  const top = getCellElevation(tileset, map, layer, cell);
  const base = getWallBase(tileset, map, layer, cell);
  const stripOffsetY = (tileset.projection.footprintHeight / 2) * scale;
  for (let level = base + 1; level < top; level++) {
    const floor = level - 1 === 0 ? "ground" : "upper";
    const origin = layout.getTileOrigin(cell, level);
    for (const face of faces) {
      const strip = selectWallImage(walls, { face, floor, level, terrain: layer, x: cell.x, y: cell.y });
      const offsetX = face === "left" ? 0 : (tileset.tileWidth / 2) * scale;
      if (strip) {
        drawImageOver(output, strip, { x: origin.x + offsetX, y: origin.y + stripOffsetY });
      }
    }
  }
}

function paintProps(output: RgbaImage, cell: Cell, context: PaintContext): void {
  const { tileset, map, layout, tiles, scale } = context;
  for (const instance of placePropsInCell(tileset, map, cell)) {
    const sprite = tiles.props[instance.propIndex]?.[instance.variantIndex]?.image;
    const anchor = tileset.props?.[instance.propIndex]?.anchor;
    if (!sprite || !anchor) {
      continue;
    }
    const point = layout.project(cell, instance.u, instance.v, instance.height);
    drawImageOver(output, sprite, { x: Math.round(point.x - anchor[0] * scale), y: Math.round(point.y - anchor[1] * scale) });
  }
}

function paintCell(output: RgbaImage, cell: Cell, context: PaintContext): void {
  const { tileset, map, layout, tiles } = context;
  if (tiles.background) {
    drawImageOver(output, tiles.background, layout.getTileOrigin(cell, 0));
  }
  for (const layer of listLayersByHeight(tileset, map, cell)) {
    paintWalls(output, layer, cell, context);
    const mask = getLayerMask(map, layer, cell);
    const tile = selectTileImage(tiles, { terrain: layer, mask, x: cell.x, y: cell.y });
    if (tile) {
      drawImageOver(output, tile, layout.getTileOrigin(cell, getCellElevation(tileset, map, layer, cell)));
    }
  }
  paintProps(output, cell, context);
}

/** Paints a map with the tileset: tiles by neighbour bitmask, walls under raised terrain, then props. */
export function renderTileMap(tileset: TilesetAsset, map: TileMap, scale = 1): RgbaImage {
  assertValidScale(scale);
  if (map.layers.length > tileset.terrains.length) {
    throw new Error(`The map has ${map.layers.length} layers but "${tileset.name}" has ${tileset.terrains.length} terrains.`);
  }
  const tiles = renderTilesetImages(tileset, scale);
  const layout = createLayout(tileset, map, scale, tiles);
  const output = createBlankImage(layout.width, layout.height);
  const context: PaintContext = { tileset, map, layout, tiles, scale };
  for (const cell of layout.paintOrder) {
    paintCell(output, cell, context);
  }
  return output;
}
