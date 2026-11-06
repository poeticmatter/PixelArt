/** One palette entry. Its position in the palette array is its color index. */
export interface PaletteColor {
  /** Human-readable role of the color, e.g. "outline" or "fur shadow". */
  name: string;
  /** "#rrggbb" or "#rrggbbaa". */
  color: string;
}

/** Row-major color indices: matrix[y][x] indexes into a palette. */
export type PixelMatrix = number[][];

/** Anything drawable: a palette plus a matrix of indices into it. */
export interface PixelImage {
  width: number;
  height: number;
  palette: PaletteColor[];
  pixels: PixelMatrix;
}

/** A single still image, as stored on disk. */
export interface ImageAsset extends PixelImage {
  type: "image";
  name: string;
}

export interface AnimationFrame {
  pixels: PixelMatrix;
  /** Overrides the animation's frameDurationMs for this frame, e.g. to hold a key pose. */
  durationMs?: number;
}

export interface Animation {
  /** Unique within the sheet; this is the name a game engine looks the animation up by. */
  name: string;
  frameDurationMs: number;
  /** Whether the game should repeat it (walk, idle) or play it once (jump, attack). */
  loop: boolean;
  frames: AnimationFrame[];
}

/**
 * Several named animations of one character, all sharing a frame size and palette.
 * Exported as one image with one row per animation and one column per frame.
 */
export interface SpriteSheetAsset {
  type: "spritesheet";
  name: string;
  frameWidth: number;
  frameHeight: number;
  palette: PaletteColor[];
  animations: Animation[];
}

export type Asset = ImageAsset | SpriteSheetAsset;

export interface Rgba {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

/** An asset together with where it was loaded from in the library. */
export interface LibraryEntry {
  /** Library-relative path without extension, e.g. "cats/cat-2-color". */
  id: string;
  asset: Asset;
}

/** An asset file that failed validation, kept so it can be reported. */
export interface InvalidLibraryEntry {
  id: string;
  errors: string[];
}

export type ValidationResult =
  | { isValid: true; asset: Asset }
  | { isValid: false; errors: string[] };
