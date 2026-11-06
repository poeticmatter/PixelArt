import type { LibraryEntry } from "../core/types.ts";
import { drawAsset, drawPixelGrid, getFittingScale, MIN_SCALE_FOR_GRID } from "./canvas.ts";
import { createElement } from "./dom.ts";
import { exportEntryAsPng } from "./exportPng.ts";
import { describeAsset } from "./gallery.ts";
import { createPalettePanel } from "./palettePanel.ts";
import { clampZoom, getNextZoomIn, getNextZoomOut } from "./zoom.ts";

const BACKGROUNDS = ["checkerboard", "dark", "light"] as const;
type Background = (typeof BACKGROUNDS)[number];

function isBackground(value: string): value is Background {
  return BACKGROUNDS.some((background) => background === value);
}

/** Leaves breathing room around the artwork when fitting it to the stage. */
const STAGE_PADDING_PX = 48;

interface DetailState {
  index: number;
  zoom: number;
  background: Background;
  isGridVisible: boolean;
}

function createButton(label: string, onClick: () => void, title?: string): HTMLButtonElement {
  const button = createElement("button", { text: label, attributes: { type: "button", title: title ?? label } });
  button.addEventListener("click", onClick);
  return button;
}

function createLabeledControl(label: string, control: HTMLElement): HTMLElement {
  return createElement("label", { className: "control" }, [createElement("span", { text: label }), control]);
}

/** The expanded single-asset view. Built once and reused for every asset. */
export class DetailView {
  private readonly entries: LibraryEntry[];
  private readonly state: DetailState = { index: 0, zoom: 1, background: "checkerboard", isGridVisible: false };

  private readonly dialog = createElement("dialog", { className: "detail" });
  private readonly stage = createElement("div", { className: "detail__stage" });
  private readonly canvas = createElement("canvas", { className: "pixel-canvas" });
  private readonly title = createElement("h2", { className: "detail__title" });
  private readonly subtitle = createElement("p", { className: "detail__subtitle" });
  private readonly zoomLabel = createElement("output", { className: "detail__zoom" });
  private readonly gridToggle = createElement("input", { attributes: { type: "checkbox" } });
  private readonly paletteSlot = createElement("div");
  private readonly exportCurrentButton = createButton("", () => this.exportCurrent(this.state.zoom));

  constructor(entries: LibraryEntry[]) {
    this.entries = entries;
    this.stage.append(this.canvas);
    this.dialog.append(this.stage, this.createSidebar());
    this.dialog.addEventListener("keydown", (event) => this.handleKey(event));
    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.stage) {
        this.dialog.close();
      }
    });
    document.body.append(this.dialog);
  }

  open(entry: LibraryEntry): void {
    this.dialog.showModal();
    this.showEntryAt(this.entries.indexOf(entry));
  }

  private get currentEntry(): LibraryEntry {
    const entry = this.entries[this.state.index];
    if (!entry) {
      throw new Error(`No asset at position ${this.state.index}.`);
    }
    return entry;
  }

  private createSidebar(): HTMLElement {
    const backgroundSelect = createElement(
      "select",
      {},
      BACKGROUNDS.map((background) => createElement("option", { text: background, attributes: { value: background } })),
    );
    backgroundSelect.addEventListener("change", () => {
      if (isBackground(backgroundSelect.value)) {
        this.setBackground(backgroundSelect.value);
      }
    });
    this.gridToggle.addEventListener("change", () => this.setGridVisible(this.gridToggle.checked));

    return createElement("aside", { className: "detail__sidebar" }, [
      createElement("header", { className: "detail__header" }, [
        createElement("div", {}, [this.title, this.subtitle]),
        createButton("✕", () => this.dialog.close(), "Close (Esc)"),
      ]),
      createElement("nav", { className: "detail__nav" }, [
        createButton("← Previous", () => this.showEntryAt(this.state.index - 1), "Previous asset (←)"),
        createButton("Next →", () => this.showEntryAt(this.state.index + 1), "Next asset (→)"),
      ]),
      createElement("section", { className: "detail__section" }, [
        createElement("h3", { text: "View" }),
        createElement("div", { className: "control" }, [
          createElement("span", { text: "Zoom" }),
          createElement("div", { className: "zoom-buttons" }, [
            createButton("−", () => this.setZoom(getNextZoomOut(this.state.zoom)), "Zoom out (−)"),
            this.zoomLabel,
            createButton("+", () => this.setZoom(getNextZoomIn(this.state.zoom)), "Zoom in (+)"),
            createButton("Fit", () => this.fitToStage(), "Fit to window (0)"),
          ]),
        ]),
        createLabeledControl("Background", backgroundSelect),
        createLabeledControl("Pixel grid", this.gridToggle),
      ]),
      this.paletteSlot,
      createElement("section", { className: "detail__section" }, [
        createElement("h3", { text: "Export PNG" }),
        createElement("div", { className: "export-buttons" }, [
          createButton("Actual size (1×)", () => this.exportCurrent(1)),
          this.exportCurrentButton,
        ]),
      ]),
    ]);
  }

  private showEntryAt(index: number): void {
    const count = this.entries.length;
    this.state.index = ((index % count) + count) % count;
    const entry = this.currentEntry;
    this.title.textContent = entry.asset.name;
    this.subtitle.textContent = `${entry.id} · ${describeAsset(entry)}`;
    this.paletteSlot.replaceChildren(createPalettePanel(entry.asset));
    this.fitToStage();
  }

  private fitToStage(): void {
    const availableSize = Math.min(this.stage.clientWidth, this.stage.clientHeight) - STAGE_PADDING_PX;
    this.setZoom(getFittingScale(this.currentEntry.asset, availableSize));
  }

  private setZoom(zoom: number): void {
    this.state.zoom = clampZoom(zoom);
    this.redraw();
  }

  private setBackground(background: Background): void {
    this.state.background = background;
    this.redraw();
  }

  private setGridVisible(isGridVisible: boolean): void {
    this.state.isGridVisible = isGridVisible;
    this.gridToggle.checked = isGridVisible;
    this.redraw();
  }

  private redraw(): void {
    const { asset } = this.currentEntry;
    const { zoom, background, isGridVisible } = this.state;
    drawAsset(this.canvas, asset, zoom);
    if (isGridVisible && zoom >= MIN_SCALE_FOR_GRID) {
      drawPixelGrid(this.canvas, asset, zoom);
    }
    this.stage.dataset.background = background;
    this.zoomLabel.textContent = `${zoom}×`;
    this.exportCurrentButton.textContent = `At zoom (${zoom}×)`;
  }

  private exportCurrent(scale: number): void {
    exportEntryAsPng(this.currentEntry, scale).catch((error: unknown) => {
      console.error(`Failed to export ${this.currentEntry.id} at ${scale}×`, error);
      alert(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.target instanceof HTMLSelectElement) {
      return;
    }
    const actions: Record<string, () => void> = {
      "+": () => this.setZoom(getNextZoomIn(this.state.zoom)),
      "=": () => this.setZoom(getNextZoomIn(this.state.zoom)),
      "-": () => this.setZoom(getNextZoomOut(this.state.zoom)),
      "0": () => this.fitToStage(),
      g: () => this.setGridVisible(!this.state.isGridVisible),
      ArrowLeft: () => this.showEntryAt(this.state.index - 1),
      ArrowRight: () => this.showEntryAt(this.state.index + 1),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  }
}
