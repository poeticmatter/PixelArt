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

/**
 * How tiles are laid out on screen. The bitmask logic is the same for all three;
 * the projection changes tile shape, draw order and the kind of map generated.
 */
export type Projection =
  | { type: "topdown" }
  | { type: "sideview" }
  /**
   * Tiles are tileWidth-wide diamonds footprintHeight tall, drawn back to front.
   * Pixels below the diamond (tileHeight - footprintHeight) are the tile's side faces;
   * one elevation step raises a terrain by that much (see Terrain.elevation).
   */
  | { type: "isometric"; footprintHeight: number };

export interface Tile {
  /** Which neighbours share this terrain: N=1, E=2, S=4, W=8 (see core/tileset/bitmask.ts). */
  mask: number;
  pixels: PixelMatrix;
  /** How often this variant is picked relative to others with the same mask. Defaults to 1. */
  weight?: number;
}

export interface Terrain {
  name: string;
  /** At least one tile for every mask 0-15. Extra tiles with the same mask are random variants. */
  tiles: Tile[];
  /**
   * Isometric only: how many steps of (tileHeight - footprintHeight) pixels the terrain is
   * raised. Defaults to the terrain's index, so successive layers form terraces.
   */
  elevation?: number;
}

/** Map features the city generator knows how to lay out. */
export const CITY_ROLES = ["road", "rail", "building", "tower", "walkway"] as const;
export type CityRole = (typeof CITY_ROLES)[number];

/**
 * Which random map a tileset generates. Without one, top-down and isometric tilesets make
 * islands and side-view tilesets make hills.
 */
export type MapGeneratorConfig =
  /** Terrains nest like contour lines: each one inside the one before. */
  | { type: "island" }
  /** Platformer ground with floating platforms; later terrains are buried deeper. */
  | { type: "hills" }
  /**
   * A street grid with rail lines, buildings in the blocks, taller towers on some of them,
   * and walkways bridging streets between buildings. `roles` maps each feature to the name
   * of the terrain that draws it; unmapped features are left out.
   */
  | { type: "city"; roles: Partial<Record<CityRole, string>> };

/**
 * Autotiling terrains for a tile map. Terrains are layers in order: each one is drawn over
 * the previous, so tiles use transparency where their terrain ends.
 */
export interface TilesetAsset {
  type: "tileset";
  name: string;
  projection: Projection;
  tileWidth: number;
  tileHeight: number;
  palette: PaletteColor[];
  /** Drawn under every cell before any terrain, e.g. water or sky. */
  background?: { pixels: PixelMatrix };
  terrains: Terrain[];
  generator?: MapGeneratorConfig;
}

export type Asset = ImageAsset | SpriteSheetAsset | TilesetAsset;

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
