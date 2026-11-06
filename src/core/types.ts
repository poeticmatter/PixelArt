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

export type WallFace = "left" | "right";
/** "ground" is the storey at street level; "upper" is every storey above it. */
export type WallFloor = "ground" | "upper";

/**
 * Isometric only: one storey of side face, repeated downward below a terrain's cap tile to
 * the top of the layer beneath, so a terrain can stand any number of storeys tall.
 * Size: tileWidth / 2 wide, step + footprintHeight / 2 tall (the shape of half a cap's side face).
 */
export interface WallStrip {
  face: WallFace;
  floor: WallFloor;
  /** Relative pick frequency among strips with the same face and floor. Defaults to 1. */
  weight?: number;
  pixels: PixelMatrix;
}

export interface Terrain {
  name: string;
  /** At least one tile for every mask 0-15. Extra tiles with the same mask are random variants. */
  tiles: Tile[];
  /**
   * Isometric only: height of the terrain's top surface in steps of
   * (tileHeight - footprintHeight) pixels. Defaults to the terrain's index, making terraces.
   */
  elevation?: number;
  walls?: WallStrip[];
}

export type PropPlacement = "top" | "left" | "right";

export interface PropVariant {
  weight?: number;
  pixels: PixelMatrix;
}

/** A free-size sprite scattered over cells of one terrain: the clutter that makes a map look inhabited. */
export interface Prop {
  name: string;
  /** Terrain name; the prop only appears where this terrain is the cell's top layer. */
  on: string;
  /** On the top surface, or on a drawn side face (isometric only). */
  place: PropPlacement;
  /** Wall props only: [min, max] storey, counted from 0 at the bottom of the wall. */
  floors?: [number, number];
  /** Only on cells whose neighbour mask (for `on`) is one of these. */
  masks?: number[];
  /** Probability per eligible cell, or per eligible storey for wall props. */
  chance: number;
  /** Pixel of the sprite that lands on the placement point: top centre or face centre. */
  anchor: [number, number];
  /** All variants share one size, so the anchor fits every one. */
  variants: PropVariant[];
}

/** Map features the city generator knows how to lay out. */
export const CITY_ROLES = ["road", "rail", "sidewalk", "building", "tower", "walkway"] as const;
export type CityRole = (typeof CITY_ROLES)[number];

/** An inclusive [min, max] range of whole numbers. */
export type IntegerRange = [number, number];

/** Options for the "city" generator; every one has a default (see core/tileset/cityGenerator.ts). */
export interface CityGeneratorConfig {
  type: "city";
  roles: Partial<Record<CityRole, string>>;
  /** Building lot size in cells, between the sidewalks, picked per block. */
  blockSize?: IntegerRange;
  /** Road lanes, in cells. */
  roadWidth?: number;
  /** Extra sidewalk cells between the kerbside sidewalk strip and the buildings. */
  setback?: number;
  /** Share of lots left as open plazas. */
  openSpace?: number;
  /** Building height in storeys, picked per building. Defaults to the terrain's elevation. */
  buildingHeight?: IntegerRange;
  /** Storeys a tower rises above the building it stands on, picked per tower. */
  towerHeight?: IntegerRange;
  towerChance?: number;
  /** Viaduct height of the railway, in storeys; 0 runs it at street level as one of the streets. */
  railElevation?: number;
  /** Height of the walkways that bridge streets between buildings. */
  walkwayElevation?: number;
  /** Chance of a walkway at each place one could bridge a street between two buildings. */
  walkwayChance?: number;
}

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
  | CityGeneratorConfig;

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
  props?: Prop[];
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
