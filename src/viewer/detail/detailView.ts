import { describeAsset } from "../../core/assetSummary.ts";
import type { LibraryEntry } from "../../core/types.ts";
import type { AnimationClock } from "../animation/animationClock.ts";
import { drawPixelGrid, drawRgbaImage, getFittingScale, MIN_SCALE_FOR_GRID } from "../canvas.ts";
import { createButton, createElement, createLabeledControl, createSidebarSection } from "../dom.ts";
import { ImagePresenter } from "./imagePresenter.ts";
import { createPalettePanel } from "./palettePanel.ts";
import type { AssetPresenter, PresenterHost } from "./presenter.ts";
import { SpriteSheetPresenter } from "./spriteSheetPresenter.ts";
import { clampZoom, getNextZoomIn, getNextZoomOut } from "./zoom.ts";

const BACKGROUNDS = ["checkerboard", "dark", "light"] as const;
type Background = (typeof BACKGROUNDS)[number];

function isBackground(value: string): value is Background {
  return BACKGROUNDS.some((background) => background === value);
}

/** Leaves breathing room around the artwork when fitting it to the stage. */
const STAGE_PADDING_PX = 48;

/** The expanded single-asset view. Built once; each opened asset gets its own presenter. */
export class DetailView {
  private readonly entries: LibraryEntry[];
  private readonly clock: AnimationClock;
  private presenter: AssetPresenter | undefined;

  private index = 0;
  private zoom = 1;
  private background: Background = "checkerboard";
  private isGridVisible = false;

  private readonly dialog = createElement("dialog", { className: "detail" });
  private readonly stage = createElement("div", { className: "detail__stage" });
  private readonly canvas = createElement("canvas", { className: "pixel-canvas" });
  private readonly title = createElement("h2", { className: "detail__title" });
  private readonly subtitle = createElement("p", { className: "detail__subtitle" });
  private readonly zoomLabel = createElement("output", { className: "detail__zoom" });
  private readonly gridToggle = createElement("input", { attributes: { type: "checkbox" } });
  private readonly presenterSlot = createElement("div", { className: "detail__presenter" });
  private readonly paletteSlot = createElement("div");

  private readonly host: PresenterHost = {
    redraw: () => this.redraw(),
    refit: () => this.fitToStage(),
    getZoom: () => this.zoom,
  };

  constructor(entries: LibraryEntry[], clock: AnimationClock) {
    this.entries = entries;
    this.clock = clock;
    this.stage.append(this.canvas);
    this.dialog.append(this.stage, this.createSidebar());
    this.dialog.addEventListener("keydown", (event) => this.handleKey(event));
    this.dialog.addEventListener("close", () => this.disposePresenter());
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
      createElement("nav", { className: "button-row" }, [
        createButton("← Previous", () => this.showEntryAt(this.index - 1), "Previous asset (←)"),
        createButton("Next →", () => this.showEntryAt(this.index + 1), "Next asset (→)"),
      ]),
      createSidebarSection("View", [
        createElement("div", { className: "control" }, [
          createElement("span", { text: "Zoom" }),
          createElement("div", { className: "zoom-buttons" }, [
            createButton("−", () => this.setZoom(getNextZoomOut(this.zoom)), "Zoom out (−)"),
            this.zoomLabel,
            createButton("+", () => this.setZoom(getNextZoomIn(this.zoom)), "Zoom in (+)"),
            createButton("Fit", () => this.fitToStage(), "Fit to window (0)"),
          ]),
        ]),
        createLabeledControl("Background", backgroundSelect),
        createLabeledControl("Pixel grid", this.gridToggle),
      ]),
      this.presenterSlot,
      this.paletteSlot,
    ]);
  }

  private createPresenter(entry: LibraryEntry): AssetPresenter {
    const { asset } = entry;
    if (asset.type === "image") {
      return new ImagePresenter(entry.id, asset, this.host);
    }
    return new SpriteSheetPresenter({ id: entry.id, sheet: asset, host: this.host, clock: this.clock });
  }

  private disposePresenter(): void {
    this.presenter?.dispose();
    this.presenter = undefined;
  }

  private showEntryAt(index: number): void {
    const count = this.entries.length;
    this.index = ((index % count) + count) % count;
    const entry = this.entries[this.index];
    if (!entry) {
      throw new Error(`No asset at position ${this.index}.`);
    }
    this.disposePresenter();
    const presenter = this.createPresenter(entry);
    this.presenter = presenter;

    this.title.textContent = entry.asset.name;
    this.subtitle.textContent = `${entry.id} · ${describeAsset(entry.asset)}`;
    this.presenterSlot.replaceChildren(...presenter.createSidebarSections());
    this.paletteSlot.replaceChildren(createPalettePanel(entry.asset));
    this.fitToStage();
  }

  private fitToStage(): void {
    if (!this.presenter) {
      return;
    }
    const available = {
      width: this.stage.clientWidth - STAGE_PADDING_PX,
      height: this.stage.clientHeight - STAGE_PADDING_PX,
    };
    this.setZoom(getFittingScale(this.presenter.getContentSize(), available));
  }

  private setZoom(zoom: number): void {
    this.zoom = clampZoom(zoom);
    this.zoomLabel.textContent = `${this.zoom}×`;
    this.presenter?.onZoomChanged(this.zoom);
    this.redraw();
  }

  private setBackground(background: Background): void {
    this.background = background;
    this.stage.dataset.background = background;
  }

  private setGridVisible(isGridVisible: boolean): void {
    this.isGridVisible = isGridVisible;
    this.gridToggle.checked = isGridVisible;
    this.redraw();
  }

  /** No-op until a presenter exists: presenters may request redraws while being constructed. */
  private redraw(): void {
    if (!this.presenter) {
      return;
    }
    drawRgbaImage(this.canvas, this.presenter.renderContent(this.zoom));
    if (this.isGridVisible && this.zoom >= MIN_SCALE_FOR_GRID) {
      drawPixelGrid(this.canvas, this.zoom);
    }
    this.stage.dataset.background = this.background;
  }

  private handleKey(event: KeyboardEvent): void {
    const isFormControl = event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement;
    // A focused button already reacts to Space itself; handling it here too would toggle twice.
    const isButtonActivation = event.target instanceof HTMLButtonElement && event.key === " ";
    if (isFormControl || isButtonActivation) {
      return;
    }
    const actions: Record<string, () => void> = {
      "+": () => this.setZoom(getNextZoomIn(this.zoom)),
      "=": () => this.setZoom(getNextZoomIn(this.zoom)),
      "-": () => this.setZoom(getNextZoomOut(this.zoom)),
      "0": () => this.fitToStage(),
      g: () => this.setGridVisible(!this.isGridVisible),
      ArrowLeft: () => this.showEntryAt(this.index - 1),
      ArrowRight: () => this.showEntryAt(this.index + 1),
    };
    const action = actions[event.key];
    if (action) {
      action();
      event.preventDefault();
    } else if (this.presenter?.handleKey(event.key)) {
      event.preventDefault();
    }
  }
}
