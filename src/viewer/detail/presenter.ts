import type { RgbaImage } from "../../core/render.ts";
import type { Size } from "../canvas.ts";

/** What the detail view offers to the asset-specific presenter it hosts. */
export interface PresenterHost {
  /** Redraw the stage at the current zoom, e.g. because the animation frame changed. */
  redraw(): void;
  /** Re-fit the zoom, e.g. because the stage switched between one frame and the whole sheet. */
  refit(): void;
  getZoom(): number;
}

/** Asset-type specific part of the detail view: what the stage shows and which controls go with it. */
export interface AssetPresenter {
  /** Size of what the stage currently shows, in source pixels. */
  getContentSize(): Size;
  renderContent(scale: number): RgbaImage;
  createSidebarSections(): HTMLElement[];
  /** Updates labels that depend on the zoom, such as "Export at 8×". */
  onZoomChanged(zoom: number): void;
  /** Returns whether the key was handled. */
  handleKey(key: string): boolean;
  dispose(): void;
}
