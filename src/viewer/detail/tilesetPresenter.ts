import { getBaseName, getExportStem } from "../../core/exportNaming.ts";
import type { RgbaImage } from "../../core/render.ts";
import { describeMask, NEIGHBOR_BITS } from "../../core/tileset/bitmask.ts";
import { generateTileMap, getDefaultMapSize } from "../../core/tileset/mapGenerator.ts";
import { MAX_MAP_SIZE, MIN_MAP_SIZE, type TileMap } from "../../core/tileset/tileMap.ts";
import { renderTileMap } from "../../core/tileset/renderTileMap.ts";
import { createTilesetMetadata, renderTilesetAtlas } from "../../core/tileset/tilesetAtlas.ts";
import type { TilesetAsset } from "../../core/types.ts";
import type { Size } from "../canvas.ts";
import { createButton, createElement, createLabeledControl, createSidebarSection } from "../dom.ts";
import { downloadJson, downloadPng, runDownload } from "./download.ts";
import type { AssetPresenter, PresenterHost } from "./presenter.ts";

const MAX_SEED = 999_999;

const ISOMETRIC_DIRECTIONS_NOTE = "On isometric maps: N ↗, E ↘, S ↙, W ↖.";

function createRandomSeed(): number {
  return Math.floor(Math.random() * MAX_SEED) + 1;
}

function createNumberInput(value: number, range: { min: number; max: number }): HTMLInputElement {
  return createElement("input", {
    className: "number-input",
    attributes: { type: "number", min: String(range.min), max: String(range.max), value: String(value) },
  });
}

/** Shows a randomly generated map built from the tileset, or the tiles themselves as an atlas. */
export class TilesetPresenter implements AssetPresenter {
  private readonly id: string;
  private readonly tileset: TilesetAsset;
  private readonly host: PresenterHost;

  private isShowingTiles = false;
  private seed = createRandomSeed();
  private mapSize: Size;
  private map: TileMap;

  private readonly seedInput: HTMLInputElement;
  private readonly widthInput: HTMLInputElement;
  private readonly heightInput: HTMLInputElement;
  private readonly viewToggle = createElement("input", { attributes: { type: "checkbox" } });
  private readonly zoomExportButton = createButton("", () => this.exportMapPng(this.host.getZoom()));

  constructor(id: string, tileset: TilesetAsset, host: PresenterHost) {
    this.id = id;
    this.tileset = tileset;
    this.host = host;
    this.mapSize = getDefaultMapSize(tileset.projection);
    this.map = this.generateMap();

    const sizeRange = { min: MIN_MAP_SIZE, max: MAX_MAP_SIZE };
    this.seedInput = createNumberInput(this.seed, { min: 1, max: MAX_SEED });
    this.widthInput = createNumberInput(this.mapSize.width, sizeRange);
    this.heightInput = createNumberInput(this.mapSize.height, sizeRange);
    this.seedInput.addEventListener("change", () => this.applyInputs());
    this.widthInput.addEventListener("change", () => this.applyInputs());
    this.heightInput.addEventListener("change", () => this.applyInputs());
    this.viewToggle.addEventListener("change", () => this.setTilesVisible(this.viewToggle.checked));
  }

  getContentSize(): Size {
    const image = this.renderContent(1);
    return { width: image.width, height: image.height };
  }

  renderContent(scale: number): RgbaImage {
    return this.isShowingTiles ? renderTilesetAtlas(this.tileset, scale) : renderTileMap(this.tileset, this.map, scale);
  }

  createSidebarSections(): HTMLElement[] {
    return [
      createSidebarSection(`Random ${this.tileset.projection.type} map`, [
        createLabeledControl("Seed", this.seedInput),
        createLabeledControl("Width", this.widthInput),
        createLabeledControl("Height", this.heightInput),
        createButton("New map", () => this.regenerate(createRandomSeed()), "Generate a map with a new seed (r)"),
        createLabeledControl("Show tiles instead", this.viewToggle),
      ]),
      this.createTerrainSection(),
      createSidebarSection("Export", [
        createElement("div", { className: "button-row" }, [
          createButton("Map PNG (1×)", () => this.exportMapPng(1)),
          this.zoomExportButton,
        ]),
        createElement("div", { className: "button-row" }, [
          createButton("Tileset PNG", () => this.exportAtlasPng(), "All tiles: one row per terrain, columns by mask"),
          createButton("Tileset JSON", () => this.exportMetadata(), "Tile rectangles and masks for a game engine"),
        ]),
      ]),
    ];
  }

  onZoomChanged(zoom: number): void {
    this.zoomExportButton.textContent = `Map PNG (${zoom}×)`;
  }

  handleKey(key: string): boolean {
    const actions: Record<string, () => void> = {
      r: () => this.regenerate(createRandomSeed()),
      t: () => this.setTilesVisible(!this.isShowingTiles),
    };
    const action = actions[key];
    action?.();
    return action !== undefined;
  }

  dispose(): void {}

  private createTerrainSection(): HTMLElement {
    const bitLegend = Object.entries(NEIGHBOR_BITS)
      .map(([direction, bit]) => `${describeMask(bit)}=${bit} (${direction})`)
      .join(", ");
    const notes = [
      `Each tile is picked by which neighbours share its terrain: ${bitLegend}.`,
      "In the tiles view, rows are terrains (background first) and columns are masks 0–15.",
    ];
    if (this.tileset.projection.type === "isometric") {
      notes.push(ISOMETRIC_DIRECTIONS_NOTE);
    }
    const terrainItems = this.tileset.terrains.map((terrain, index) =>
      createElement("li", { text: `${index + 1}. ${terrain.name} (${terrain.tiles.length} tiles)` }),
    );
    return createSidebarSection("Terrains (bottom to top)", [
      createElement("ol", { className: "terrain-list" }, terrainItems),
      ...notes.map((note) => createElement("p", { className: "detail__note", text: note })),
    ]);
  }

  private generateMap(): TileMap {
    return generateTileMap(this.tileset, { ...this.mapSize, seed: this.seed });
  }

  private regenerate(seed: number): void {
    this.seed = seed;
    this.seedInput.value = String(seed);
    this.map = this.generateMap();
    this.setTilesVisible(false);
  }

  /** Reads seed and size; out-of-range values snap back to the last valid ones. */
  private applyInputs(): void {
    const readInteger = (input: HTMLInputElement, fallback: number): number => {
      const value = Number(input.value);
      const isValid = Number.isInteger(value) && value >= Number(input.min) && value <= Number(input.max);
      input.value = String(isValid ? value : fallback);
      return isValid ? value : fallback;
    };
    this.mapSize = {
      width: readInteger(this.widthInput, this.mapSize.width),
      height: readInteger(this.heightInput, this.mapSize.height),
    };
    this.regenerate(readInteger(this.seedInput, this.seed));
  }

  private setTilesVisible(isVisible: boolean): void {
    this.isShowingTiles = isVisible;
    this.viewToggle.checked = isVisible;
    this.host.refit();
  }

  private exportMapPng(scale: number): void {
    const fileName = `${getBaseName(getExportStem(`${this.id}-map-${this.seed}`, scale))}.png`;
    runDownload(fileName, () => downloadPng(renderTileMap(this.tileset, this.map, scale), fileName));
  }

  private exportAtlasPng(): void {
    const fileName = `${getBaseName(this.id)}.png`;
    runDownload(fileName, () => downloadPng(renderTilesetAtlas(this.tileset), fileName));
  }

  private exportMetadata(): void {
    const stem = getBaseName(this.id);
    runDownload(`${stem}.json`, () => downloadJson(createTilesetMetadata(this.tileset, `${stem}.png`), `${stem}.json`));
  }
}
