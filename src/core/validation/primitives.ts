import { isHexColor } from "../color.ts";

export const MAX_PALETTE_SIZE = 256;
export const MAX_DIMENSION = 1024;

export type Fields = Record<string, unknown>;

export function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function isPositiveInteger(value: unknown): value is number {
  return isIntegerInRange(value, 1, Number.MAX_SAFE_INTEGER);
}

export function validateName(fields: Fields, path: string): string[] {
  return isNonEmptyString(fields.name) ? [] : [`${path}"name" must be a non-empty string.`];
}

export function validateDimension(value: unknown, label: string): string[] {
  return isIntegerInRange(value, 1, MAX_DIMENSION) ? [] : [`"${label}" must be an integer from 1 to ${MAX_DIMENSION}.`];
}

function validatePaletteEntry(entry: unknown, index: number): string[] {
  if (!isFields(entry)) {
    return [`palette[${index}] must be an object with "name" and "color".`];
  }
  const errors: string[] = [];
  if (!isNonEmptyString(entry.name)) {
    errors.push(`palette[${index}].name must be a non-empty string.`);
  }
  if (typeof entry.color !== "string" || !isHexColor(entry.color)) {
    errors.push(`palette[${index}].color must be "#rrggbb" or "#rrggbbaa", got ${JSON.stringify(entry.color)}.`);
  }
  return errors;
}

export function validatePalette(palette: unknown): string[] {
  if (!Array.isArray(palette) || palette.length === 0 || palette.length > MAX_PALETTE_SIZE) {
    return [`"palette" must be an array of 1 to ${MAX_PALETTE_SIZE} colors.`];
  }
  return palette.flatMap(validatePaletteEntry);
}

export interface MatrixShape {
  width: number;
  height: number;
  paletteSize: number;
}

function validateMatrixRow(row: unknown, rowPath: string, shape: MatrixShape): string[] {
  if (!Array.isArray(row)) {
    return [`${rowPath} must be an array.`];
  }
  const errors: string[] = [];
  if (row.length !== shape.width) {
    errors.push(`${rowPath} has ${row.length} pixels, expected width ${shape.width}.`);
  }
  row.forEach((colorIndex: unknown, x) => {
    if (!isIntegerInRange(colorIndex, 0, shape.paletteSize - 1)) {
      errors.push(
        `${rowPath}[${x}] is ${JSON.stringify(colorIndex)}, expected an index from 0 to ${shape.paletteSize - 1}.`,
      );
    }
  });
  return errors;
}

/** Checks a pixel matrix; `path` locates it in error messages, e.g. `animations[0].frames[2].pixels`. */
export function validatePixelMatrix(matrix: unknown, path: string, shape: MatrixShape): string[] {
  if (!Array.isArray(matrix)) {
    return [`${path} must be an array of rows.`];
  }
  const errors: string[] = [];
  if (matrix.length !== shape.height) {
    errors.push(`${path} has ${matrix.length} rows, expected height ${shape.height}.`);
  }
  matrix.forEach((row: unknown, y) => errors.push(...validateMatrixRow(row, `${path}[${y}]`, shape)));
  return errors;
}
