import { getBaseName, getExportStem } from "../../core/exportNaming.ts";
import { renderImage, type RgbaImage } from "../../core/render.ts";
import type { ImageAsset } from "../../core/types.ts";
import type { Size } from "../canvas.ts";
import { createButton, createElement, createSidebarSection } from "../dom.ts";
import { downloadPng, runDownload } from "./download.ts";
import type { AssetPresenter, PresenterHost } from "./presenter.ts";

export class ImagePresenter implements AssetPresenter {
  private readonly id: string;
  private readonly image: ImageAsset;
  private readonly host: PresenterHost;
  private readonly zoomExportButton = createButton("", () => this.exportPng(this.host.getZoom()));

  constructor(id: string, image: ImageAsset, host: PresenterHost) {
    this.id = id;
    this.image = image;
    this.host = host;
  }

  getContentSize(): Size {
    return { width: this.image.width, height: this.image.height };
  }

  renderContent(scale: number): RgbaImage {
    return renderImage(this.image, scale);
  }

  createSidebarSections(): HTMLElement[] {
    return [
      createSidebarSection("Export PNG", [
        createElement("div", { className: "button-row" }, [
          createButton("Actual size (1×)", () => this.exportPng(1)),
          this.zoomExportButton,
        ]),
      ]),
    ];
  }

  onZoomChanged(zoom: number): void {
    this.zoomExportButton.textContent = `At zoom (${zoom}×)`;
  }

  handleKey(): boolean {
    return false;
  }

  dispose(): void {}

  private exportPng(scale: number): void {
    const fileName = `${getBaseName(getExportStem(this.id, scale))}.png`;
    runDownload(fileName, () => downloadPng(renderImage(this.image, scale), fileName));
  }
}
