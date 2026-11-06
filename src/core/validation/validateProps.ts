import { ALL_MASKS } from "../tileset/bitmask.ts";
import {
  type Fields,
  isFields,
  isIntegerInRange,
  isIntegerRangePair,
  isNonEmptyString,
  isProbability,
  MAX_DIMENSION,
  validatePixelMatrix,
  validateWeight,
} from "./primitives.ts";

const PLACEMENTS = ["top", "left", "right"];
/** Storey numbers above this make no sense for any map the generators produce. */
const MAX_FLOOR = 64;

export interface PropContext {
  terrainNames: unknown[];
  isIsometric: boolean;
  paletteSize: number;
}

interface Size {
  width: number;
  height: number;
}

function isMaskList(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((mask) => isIntegerInRange(mask, 0, ALL_MASKS.length - 1));
}

function validatePlacement(prop: Fields, path: string, context: PropContext): string[] {
  const errors: string[] = [];
  if (!isNonEmptyString(prop.on) || !context.terrainNames.includes(prop.on)) {
    errors.push(`${path}.on must name one of the tileset's terrains, got ${JSON.stringify(prop.on)}.`);
  }
  if (!PLACEMENTS.includes(String(prop.place))) {
    errors.push(`${path}.place must be "top", "left" or "right".`);
  }
  const isWallProp = prop.place === "left" || prop.place === "right";
  if (isWallProp && !context.isIsometric) {
    errors.push(`${path}.place "${String(prop.place)}" is a wall placement, which needs an isometric tileset.`);
  }
  if (prop.floors !== undefined && !isWallProp) {
    errors.push(`${path}.floors only applies to wall props ("left" or "right").`);
  } else if (prop.floors !== undefined && !isIntegerRangePair(prop.floors, 0, MAX_FLOOR)) {
    errors.push(`${path}.floors must be [min, max] storeys from 0 to ${MAX_FLOOR}.`);
  }
  if (prop.masks !== undefined && !isMaskList(prop.masks)) {
    errors.push(`${path}.masks must be a non-empty list of masks from 0 to ${ALL_MASKS.length - 1} when present.`);
  }
  if (!isProbability(prop.chance)) {
    errors.push(`${path}.chance must be a number from 0 to 1.`);
  }
  return errors;
}

function getMatrixSize(pixels: unknown): Size {
  const rows = Array.isArray(pixels) ? (pixels as unknown[]) : [];
  const firstRow = rows[0];
  return { width: Array.isArray(firstRow) ? firstRow.length : 0, height: rows.length };
}

/** Variants are free-size, but must all match the first one so the anchor fits each. */
function validateVariants(prop: Fields, path: string, paletteSize: number): { errors: string[]; size?: Size } {
  const variants = prop.variants;
  if (!Array.isArray(variants) || variants.length === 0) {
    return { errors: [`${path}.variants must be a non-empty array.`] };
  }
  const first: unknown = variants[0];
  const size = getMatrixSize(isFields(first) ? first.pixels : undefined);
  if (!isIntegerInRange(size.width, 1, MAX_DIMENSION) || !isIntegerInRange(size.height, 1, MAX_DIMENSION)) {
    return { errors: [`${path}.variants[0].pixels must be a matrix from 1×1 to ${MAX_DIMENSION}×${MAX_DIMENSION}.`] };
  }
  const shape = { ...size, paletteSize };
  const errors = variants.flatMap((variant: unknown, index) => {
    const variantPath = `${path}.variants[${index}]`;
    if (!isFields(variant)) {
      return [`${variantPath} must be an object with "pixels".`];
    }
    return [...validateWeight(variant.weight, variantPath), ...validatePixelMatrix(variant.pixels, `${variantPath}.pixels`, shape)];
  });
  return { errors, size };
}

function validateAnchor(anchor: unknown, path: string, size: Size): string[] {
  const isInside =
    Array.isArray(anchor) &&
    anchor.length === 2 &&
    isIntegerInRange(anchor[0], 0, size.width - 1) &&
    isIntegerInRange(anchor[1], 0, size.height - 1);
  return isInside ? [] : [`${path}.anchor must be [x, y] inside the ${size.width}×${size.height} sprite.`];
}

function validateProp(prop: unknown, index: number, context: PropContext): string[] {
  const path = `props[${index}]`;
  if (!isFields(prop)) {
    return [`${path} must be an object.`];
  }
  const nameErrors = isNonEmptyString(prop.name) ? [] : [`${path}.name must be a non-empty string.`];
  const variants = validateVariants(prop, path, context.paletteSize);
  const anchorErrors = variants.size ? validateAnchor(prop.anchor, path, variants.size) : [];
  return [...nameErrors, ...validatePlacement(prop, path, context), ...variants.errors, ...anchorErrors];
}

/** Checks the optional `props` list against the tileset's terrains and palette. */
export function validateProps(props: unknown, context: PropContext): string[] {
  if (props === undefined) {
    return [];
  }
  if (!Array.isArray(props)) {
    return [`"props" must be an array when present.`];
  }
  const names = props.map((prop) => (isFields(prop) ? prop.name : undefined));
  const duplicates = [...new Set(names.filter((name, index) => isNonEmptyString(name) && names.indexOf(name) !== index))];
  return [
    ...duplicates.map((name) => `Prop name "${String(name)}" is used more than once.`),
    ...props.flatMap((prop, index) => validateProp(prop, index, context)),
  ];
}
