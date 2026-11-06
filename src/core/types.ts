/** One palette entry. Its position in the palette array is its color index. */
export interface PaletteColor {
  /** Human-readable role of the color, e.g. "outline" or "fur shadow". */
  name: string;
  /** "#rrggbb" or "#rrggbbaa". */
  color: string;
}

/** A pixel art asset exactly as stored on disk. */
export interface PixelAsset {
  name: string;
  width: number;
  height: number;
  palette: PaletteColor[];
  /** Row-major color indices: pixels[y][x] indexes into palette. */
  pixels: number[][];
}

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
  asset: PixelAsset;
}

/** An asset file that failed validation, kept so it can be reported. */
export interface InvalidLibraryEntry {
  id: string;
  errors: string[];
}

export type ValidationResult =
  | { isValid: true; asset: PixelAsset }
  | { isValid: false; errors: string[] };
