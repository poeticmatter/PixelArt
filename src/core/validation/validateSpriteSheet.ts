import {
  type Fields,
  isFields,
  isNonEmptyString,
  isPositiveInteger,
  type MatrixShape,
  validateDimension,
  validateName,
  validatePalette,
  validatePixelMatrix,
} from "./primitives.ts";

function validateFrame(frame: unknown, path: string, shape: MatrixShape): string[] {
  if (!isFields(frame)) {
    return [`${path} must be an object with "pixels".`];
  }
  const errors = validatePixelMatrix(frame.pixels, `${path}.pixels`, shape);
  if (frame.durationMs !== undefined && !isPositiveInteger(frame.durationMs)) {
    errors.push(`${path}.durationMs must be a positive integer when present.`);
  }
  return errors;
}

function validateAnimationSettings(animation: Fields, path: string): string[] {
  const errors: string[] = [];
  if (!isNonEmptyString(animation.name)) {
    errors.push(`${path}.name must be a non-empty string.`);
  }
  if (!isPositiveInteger(animation.frameDurationMs)) {
    errors.push(`${path}.frameDurationMs must be a positive integer.`);
  }
  if (typeof animation.loop !== "boolean") {
    errors.push(`${path}.loop must be true or false.`);
  }
  return errors;
}

function validateAnimation(animation: unknown, index: number, shape: MatrixShape): string[] {
  const path = `animations[${index}]`;
  if (!isFields(animation)) {
    return [`${path} must be an object.`];
  }
  const errors = validateAnimationSettings(animation, path);
  if (!Array.isArray(animation.frames) || animation.frames.length === 0) {
    return [...errors, `${path}.frames must be a non-empty array.`];
  }
  animation.frames.forEach((frame: unknown, frameIndex) =>
    errors.push(...validateFrame(frame, `${path}.frames[${frameIndex}]`, shape)),
  );
  return errors;
}

function findDuplicateNames(animations: unknown[]): string[] {
  const names = animations.map((animation) => (isFields(animation) ? animation.name : undefined));
  const duplicates = names.filter((name, index) => isNonEmptyString(name) && names.indexOf(name) !== index);
  return [...new Set(duplicates)].map((name) => `Animation name "${String(name)}" is used more than once.`);
}

/** Validates the fields of a `"type": "spritesheet"` asset. */
export function validateSpriteSheetFields(fields: Fields): string[] {
  const headerErrors = [
    ...validateName(fields, ""),
    ...validateDimension(fields.frameWidth, "frameWidth"),
    ...validateDimension(fields.frameHeight, "frameHeight"),
    ...validatePalette(fields.palette),
  ];
  if (!Array.isArray(fields.animations) || fields.animations.length === 0) {
    headerErrors.push(`"animations" must be a non-empty array.`);
  }
  // Frames can only be checked once the frame size, palette and animation list are trustworthy.
  if (headerErrors.length > 0) {
    return headerErrors;
  }
  const animations = fields.animations as unknown[];
  const shape: MatrixShape = {
    width: fields.frameWidth as number,
    height: fields.frameHeight as number,
    paletteSize: (fields.palette as unknown[]).length,
  };
  return [
    ...findDuplicateNames(animations),
    ...animations.flatMap((animation, index) => validateAnimation(animation, index, shape)),
  ];
}
