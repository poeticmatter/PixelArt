import { isHexColor } from "./color.ts";
import type { PaletteColor, PixelAsset, ValidationResult } from "./types.ts";

export const MAX_PALETTE_SIZE = 256;
export const MAX_DIMENSION = 1024;

/** Keeps error reports readable when a whole matrix is wrong. */
const MAX_REPORTED_PIXEL_ERRORS = 10;

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isDimension(value: unknown): value is number {
  return isIntegerInRange(value, 1, MAX_DIMENSION);
}

function validatePaletteEntry(entry: unknown, index: number): string[] {
  if (!isFields(entry)) {
    return [`palette[${index}] must be an object with "name" and "color".`];
  }
  const errors: string[] = [];
  if (typeof entry.name !== "string" || entry.name.trim() === "") {
    errors.push(`palette[${index}].name must be a non-empty string.`);
  }
  if (typeof entry.color !== "string" || !isHexColor(entry.color)) {
    errors.push(`palette[${index}].color must be "#rrggbb" or "#rrggbbaa", got ${JSON.stringify(entry.color)}.`);
  }
  return errors;
}

function validatePalette(palette: unknown): string[] {
  if (!Array.isArray(palette) || palette.length === 0 || palette.length > MAX_PALETTE_SIZE) {
    return [`"palette" must be an array of 1 to ${MAX_PALETTE_SIZE} colors.`];
  }
  return palette.flatMap(validatePaletteEntry);
}

function validatePixelRow(row: unknown, y: number, width: number, paletteSize: number): string[] {
  if (!Array.isArray(row)) {
    return [`pixels[${y}] must be an array.`];
  }
  const errors: string[] = [];
  if (row.length !== width) {
    errors.push(`pixels[${y}] has ${row.length} pixels, expected width ${width}.`);
  }
  row.forEach((colorIndex: unknown, x) => {
    if (!isIntegerInRange(colorIndex, 0, paletteSize - 1)) {
      errors.push(`pixels[${y}][${x}] is ${JSON.stringify(colorIndex)}, expected an index from 0 to ${paletteSize - 1}.`);
    }
  });
  return errors;
}

function validatePixels(pixels: unknown, width: number, height: number, paletteSize: number): string[] {
  if (!Array.isArray(pixels)) {
    return [`"pixels" must be an array of rows.`];
  }
  const errors: string[] = [];
  if (pixels.length !== height) {
    errors.push(`"pixels" has ${pixels.length} rows, expected height ${height}.`);
  }
  pixels.forEach((row: unknown, y) => errors.push(...validatePixelRow(row, y, width, paletteSize)));
  return truncateErrors(errors);
}

function truncateErrors(errors: string[]): string[] {
  if (errors.length <= MAX_REPORTED_PIXEL_ERRORS) {
    return errors;
  }
  const hiddenCount = errors.length - MAX_REPORTED_PIXEL_ERRORS;
  return [...errors.slice(0, MAX_REPORTED_PIXEL_ERRORS), `...and ${hiddenCount} more pixel errors.`];
}

function validateHeader(fields: Fields): string[] {
  const errors: string[] = [];
  if (typeof fields.name !== "string" || fields.name.trim() === "") {
    errors.push(`"name" must be a non-empty string.`);
  }
  if (!isDimension(fields.width)) {
    errors.push(`"width" must be an integer from 1 to ${MAX_DIMENSION}.`);
  }
  if (!isDimension(fields.height)) {
    errors.push(`"height" must be an integer from 1 to ${MAX_DIMENSION}.`);
  }
  return errors;
}

/** Checks untrusted JSON against the asset format, reporting every problem found. */
export function validateAsset(input: unknown): ValidationResult {
  if (!isFields(input)) {
    return { isValid: false, errors: ["Asset must be a JSON object."] };
  }
  const headerErrors = validateHeader(input);
  const paletteErrors = validatePalette(input.palette);
  const errors = [...headerErrors, ...paletteErrors];

  // Pixel indices can only be checked once the dimensions and palette are trustworthy.
  if (errors.length === 0) {
    const paletteSize = (input.palette as PaletteColor[]).length;
    errors.push(...validatePixels(input.pixels, input.width as number, input.height as number, paletteSize));
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }
  // Every field has been checked above, so the shape is now known.
  return { isValid: true, asset: input as unknown as PixelAsset };
}
