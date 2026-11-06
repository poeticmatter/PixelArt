import { type Fields, validateDimension, validateName, validatePalette, validatePixelMatrix } from "./primitives.ts";

/** Validates the fields of an `"type": "image"` asset. */
export function validateImageFields(fields: Fields): string[] {
  const headerErrors = [
    ...validateName(fields, ""),
    ...validateDimension(fields.width, "width"),
    ...validateDimension(fields.height, "height"),
    ...validatePalette(fields.palette),
  ];
  // Pixel indices can only be checked once the dimensions and palette are trustworthy.
  if (headerErrors.length > 0) {
    return headerErrors;
  }
  return validatePixelMatrix(fields.pixels, `"pixels"`, {
    width: fields.width as number,
    height: fields.height as number,
    paletteSize: (fields.palette as unknown[]).length,
  });
}
