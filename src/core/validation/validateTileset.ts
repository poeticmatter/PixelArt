import { ALL_MASKS, describeMask } from "../tileset/bitmask.ts";
import {
  type Fields,
  isFields,
  isIntegerInRange,
  isNonEmptyString,
  type MatrixShape,
  MAX_ELEVATION,
  validateDimension,
  validateName,
  validatePalette,
  validatePixelMatrix,
  validateWeight,
} from "./primitives.ts";
import { validateMapGenerator } from "./validateMapGenerator.ts";
import { validateProps } from "./validateProps.ts";
import { validateWalls, type WallContext } from "./validateWalls.ts";

const PROJECTION_TYPES = ["topdown", "sideview", "isometric"];

function validateProjection(projection: unknown, tileWidth: unknown, tileHeight: unknown): string[] {
  if (!isFields(projection) || !PROJECTION_TYPES.includes(String(projection.type))) {
    return [`"projection.type" must be one of "${PROJECTION_TYPES.join(`", "`)}".`];
  }
  if (projection.type !== "isometric") {
    return [];
  }
  const errors: string[] = [];
  if (typeof tileWidth === "number" && tileWidth % 2 !== 0) {
    errors.push(`Isometric tiles need an even "tileWidth" so the diamond is symmetric.`);
  }
  const maxFootprint = typeof tileHeight === "number" ? tileHeight : 1;
  if (!isIntegerInRange(projection.footprintHeight, 1, maxFootprint)) {
    errors.push(`"projection.footprintHeight" must be an integer from 1 to tileHeight (${maxFootprint}).`);
  }
  return errors;
}

function validateTile(tile: unknown, path: string, shape: MatrixShape): string[] {
  if (!isFields(tile)) {
    return [`${path} must be an object with "mask" and "pixels".`];
  }
  const errors = validatePixelMatrix(tile.pixels, `${path}.pixels`, shape);
  if (!isIntegerInRange(tile.mask, 0, ALL_MASKS.length - 1)) {
    errors.push(`${path}.mask must be an integer from 0 to ${ALL_MASKS.length - 1}.`);
  }
  return [...errors, ...validateWeight(tile.weight, path)];
}

interface TerrainContext {
  shape: MatrixShape;
  walls: WallContext;
}

/** Wall strips are half a tile wide and one step plus the face's slope tall. */
function getWallContext(projection: unknown, shape: MatrixShape): WallContext {
  if (!isFields(projection) || projection.type !== "isometric" || typeof projection.footprintHeight !== "number") {
    return { isIsometric: false, stripShape: undefined };
  }
  const step = shape.height - projection.footprintHeight;
  const stripShape = step > 0 ? { width: shape.width / 2, height: step + projection.footprintHeight / 2, paletteSize: shape.paletteSize } : undefined;
  return { isIsometric: true, stripShape };
}

function findMissingMasks(tiles: unknown[]): number[] {
  const presentMasks = new Set(tiles.map((tile) => (isFields(tile) ? tile.mask : undefined)));
  return ALL_MASKS.filter((mask) => !presentMasks.has(mask));
}

function validateTerrain(terrain: unknown, index: number, { shape, walls }: TerrainContext): string[] {
  const path = `terrains[${index}]`;
  if (!isFields(terrain)) {
    return [`${path} must be an object.`];
  }
  const errors = isNonEmptyString(terrain.name) ? [] : [`${path}.name must be a non-empty string.`];
  if (terrain.elevation !== undefined && !isIntegerInRange(terrain.elevation, 0, MAX_ELEVATION)) {
    errors.push(`${path}.elevation must be an integer from 0 to ${MAX_ELEVATION} when present.`);
  }
  if (!Array.isArray(terrain.tiles)) {
    return [...errors, `${path}.tiles must be an array.`];
  }
  terrain.tiles.forEach((tile: unknown, tileIndex) => errors.push(...validateTile(tile, `${path}.tiles[${tileIndex}]`, shape)));
  const missingMasks = findMissingMasks(terrain.tiles);
  if (missingMasks.length > 0) {
    const missing = missingMasks.map((mask) => `${mask} (${describeMask(mask)})`).join(", ");
    errors.push(`${path} has no tile for mask ${missing}.`);
  }
  return [...errors, ...validateWalls(terrain, path, walls)];
}

function validateBackground(background: unknown, shape: MatrixShape): string[] {
  if (background === undefined) {
    return [];
  }
  if (!isFields(background)) {
    return [`"background" must be an object with "pixels" when present.`];
  }
  return validatePixelMatrix(background.pixels, `background.pixels`, shape);
}

function findDuplicateTerrainNames(terrains: unknown[]): string[] {
  const names = terrains.map((terrain) => (isFields(terrain) ? terrain.name : undefined));
  const duplicates = names.filter((name, index) => isNonEmptyString(name) && names.indexOf(name) !== index);
  return [...new Set(duplicates)].map((name) => `Terrain name "${String(name)}" is used more than once.`);
}

/** Validates the fields of a `"type": "tileset"` asset. */
export function validateTilesetFields(fields: Fields): string[] {
  const headerErrors = [
    ...validateName(fields, ""),
    ...validateDimension(fields.tileWidth, "tileWidth"),
    ...validateDimension(fields.tileHeight, "tileHeight"),
    ...validateProjection(fields.projection, fields.tileWidth, fields.tileHeight),
    ...validatePalette(fields.palette),
  ];
  if (!Array.isArray(fields.terrains) || fields.terrains.length === 0) {
    headerErrors.push(`"terrains" must be a non-empty array.`);
  }
  // Tiles can only be checked once the tile size, palette and terrain list are trustworthy.
  if (headerErrors.length > 0) {
    return headerErrors;
  }
  const terrains = fields.terrains as unknown[];
  const shape: MatrixShape = {
    width: fields.tileWidth as number,
    height: fields.tileHeight as number,
    paletteSize: (fields.palette as unknown[]).length,
  };
  const wallContext = getWallContext(fields.projection, shape);
  const terrainNames = terrains.map((terrain) => (isFields(terrain) ? terrain.name : undefined));
  return [
    ...validateBackground(fields.background, shape),
    ...findDuplicateTerrainNames(terrains),
    ...validateMapGenerator(fields.generator, terrains),
    ...terrains.flatMap((terrain, index) => validateTerrain(terrain, index, { shape, walls: wallContext })),
    ...validateProps(fields.props, { terrainNames, isIsometric: wallContext.isIsometric, paletteSize: shape.paletteSize }),
  ];
}
