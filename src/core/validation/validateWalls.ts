import { type Fields, isFields, type MatrixShape, validatePixelMatrix, validateWeight } from "./primitives.ts";

const FACES = ["left", "right"];
const FLOORS = ["ground", "upper"];

export interface WallContext {
  isIsometric: boolean;
  /** Strip size: tileWidth / 2 wide, step + footprintHeight / 2 tall; undefined if tiles have no side faces. */
  stripShape: MatrixShape | undefined;
}

function validateStrip(strip: unknown, path: string, shape: MatrixShape): string[] {
  if (!isFields(strip)) {
    return [`${path} must be an object with "face", "floor" and "pixels".`];
  }
  const errors: string[] = [];
  if (!FACES.includes(String(strip.face))) {
    errors.push(`${path}.face must be "left" or "right".`);
  }
  if (!FLOORS.includes(String(strip.floor))) {
    errors.push(`${path}.floor must be "ground" or "upper".`);
  }
  return [...errors, ...validateWeight(strip.weight, path), ...validatePixelMatrix(strip.pixels, `${path}.pixels`, shape)];
}

function findMissingFaces(walls: unknown[]): string[] {
  const faces = new Set(walls.map((strip) => (isFields(strip) ? strip.face : undefined)));
  return FACES.filter((face) => !faces.has(face));
}

/** Checks a terrain's optional `walls`: isometric only, both faces covered, every strip the right size. */
export function validateWalls(terrain: Fields, path: string, context: WallContext): string[] {
  const { walls } = terrain;
  if (walls === undefined) {
    return [];
  }
  if (!context.isIsometric) {
    return [`${path}.walls is only supported for isometric tilesets.`];
  }
  if (!context.stripShape) {
    return [`${path}.walls needs tiles with side faces (tileHeight greater than footprintHeight).`];
  }
  if (!Array.isArray(walls) || walls.length === 0) {
    return [`${path}.walls must be a non-empty array when present.`];
  }
  const shape = context.stripShape;
  const errors = walls.flatMap((strip: unknown, index) => validateStrip(strip, `${path}.walls[${index}]`, shape));
  const missingFaces = findMissingFaces(walls);
  if (missingFaces.length > 0) {
    errors.push(`${path}.walls has no strip for the ${missingFaces.join(" or ")} face.`);
  }
  return errors;
}
