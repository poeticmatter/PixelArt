import type { Asset, ValidationResult } from "../types.ts";
import { type Fields, isFields } from "./primitives.ts";
import { validateImageFields } from "./validateImage.ts";
import { validateSpriteSheetFields } from "./validateSpriteSheet.ts";

/** Keeps error reports readable when a whole matrix is wrong. */
const MAX_REPORTED_ERRORS = 20;

const VALIDATORS_BY_TYPE: Record<Asset["type"], (fields: Fields) => string[]> = {
  image: validateImageFields,
  spritesheet: validateSpriteSheetFields,
};

function isAssetType(value: unknown): value is Asset["type"] {
  return typeof value === "string" && Object.hasOwn(VALIDATORS_BY_TYPE, value);
}

function truncateErrors(errors: string[]): string[] {
  if (errors.length <= MAX_REPORTED_ERRORS) {
    return errors;
  }
  const hiddenCount = errors.length - MAX_REPORTED_ERRORS;
  return [...errors.slice(0, MAX_REPORTED_ERRORS), `...and ${hiddenCount} more errors.`];
}

/** Checks untrusted JSON against the asset format, reporting every problem found. */
export function validateAsset(input: unknown): ValidationResult {
  if (!isFields(input)) {
    return { isValid: false, errors: ["Asset must be a JSON object."] };
  }
  if (!isAssetType(input.type)) {
    const knownTypes = Object.keys(VALIDATORS_BY_TYPE).join(`" or "`);
    return { isValid: false, errors: [`"type" must be "${knownTypes}", got ${JSON.stringify(input.type)}.`] };
  }
  const errors = VALIDATORS_BY_TYPE[input.type](input);
  if (errors.length > 0) {
    return { isValid: false, errors: truncateErrors(errors) };
  }
  // The validator for this type has checked every field, so the shape is now known.
  return { isValid: true, asset: input as unknown as Asset };
}
