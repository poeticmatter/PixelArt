import type { AnimationPlayback } from "../../core/animationPlayback.ts";
import { getBaseName, getExportStem } from "../../core/exportNaming.ts";
import { renderImage, type RgbaImage } from "../../core/render.ts";
import { createSheetMetadata, getFrameDurations, getFrameImage, getSheetGrid, renderSpriteSheet } from "../../core/spriteSheet.ts";
import type { Animation, SpriteSheetAsset } from "../../core/types.ts";
import type { AnimationClock } from "../animation/animationClock.ts";
import { createPreviewPlayback } from "../animation/animationPreview.ts";
import { drawRgbaImage, getFittingScale, type Size } from "../canvas.ts";
import { createButton, createElement, createLabeledControl, createSidebarSection } from "../dom.ts";
import { downloadJson, downloadPng, runDownload } from "./download.ts";
import type { AssetPresenter, PresenterHost } from "./presenter.ts";

const FRAME_STRIP_THUMBNAIL_SIZE = { width: 48, height: 48 };

export interface SpriteSheetPresenterOptions {
  id: string;
  sheet: SpriteSheetAsset;
  host: PresenterHost;
  clock: AnimationClock;
}

/** Plays one animation at a time, or shows the whole sheet laid out as it exports. */
export class SpriteSheetPresenter implements AssetPresenter {
  private readonly id: string;
  private readonly sheet: SpriteSheetAsset;
  private readonly host: PresenterHost;
  private readonly unsubscribeFromClock: () => void;

  private animationIndex = 0;
  private playback: AnimationPlayback;
  private isShowingWholeSheet = false;

  private readonly animationList = createElement("ol", { className: "animation-list" });
  private readonly playButton = createButton("", () => this.togglePlaying(), "Play / pause (Space)");
  private readonly frameLabel = createElement("output", { className: "frame-label" });
  private readonly frameStrip = createElement("div", { className: "frame-strip" });
  private readonly sheetToggle = createElement("input", { attributes: { type: "checkbox" } });
  private readonly zoomExportButton = createButton("", () => this.exportSheetPng(this.host.getZoom()));

  constructor(options: SpriteSheetPresenterOptions) {
    this.id = options.id;
    this.sheet = options.sheet;
    this.host = options.host;
    this.playback = createPreviewPlayback(this.currentAnimation);
    this.sheetToggle.addEventListener("change", () => this.setWholeSheetVisible(this.sheetToggle.checked));
    this.unsubscribeFromClock = options.clock.subscribe((deltaMs) => this.onTick(deltaMs));
    this.selectAnimation(0);
  }

  private get currentAnimation(): Animation {
    const animation = this.sheet.animations[this.animationIndex];
    if (!animation) {
      throw new Error(`Sprite sheet "${this.sheet.name}" has no animation at index ${this.animationIndex}.`);
    }
    return animation;
  }

  getContentSize(): Size {
    if (!this.isShowingWholeSheet) {
      return { width: this.sheet.frameWidth, height: this.sheet.frameHeight };
    }
    const grid = getSheetGrid(this.sheet);
    return { width: grid.columns * this.sheet.frameWidth, height: grid.rows * this.sheet.frameHeight };
  }

  renderContent(scale: number): RgbaImage {
    if (this.isShowingWholeSheet) {
      return renderSpriteSheet(this.sheet, scale);
    }
    const frame = this.currentAnimation.frames[this.playback.frameIndex];
    if (!frame) {
      throw new Error(`Animation "${this.currentAnimation.name}" has no frame ${this.playback.frameIndex}.`);
    }
    return renderImage(getFrameImage(this.sheet, frame), scale);
  }

  createSidebarSections(): HTMLElement[] {
    return [
      createSidebarSection("Animations", [this.animationList]),
      createSidebarSection("Playback", [
        createElement("div", { className: "button-row" }, [
          createButton("◀", () => this.stepFrame(-1), "Previous frame (,)"),
          this.playButton,
          createButton("▶", () => this.stepFrame(1), "Next frame (.)"),
        ]),
        this.frameLabel,
        this.frameStrip,
        createLabeledControl("Show whole sheet", this.sheetToggle),
      ]),
      createSidebarSection("Export", [
        createElement("div", { className: "button-row" }, [
          createButton("Sheet PNG (1×)", () => this.exportSheetPng(1)),
          this.zoomExportButton,
        ]),
        createButton("Frame data JSON (1×)", () => this.exportMetadata(), "Frame rectangles and timings for a game engine"),
      ]),
    ];
  }

  onZoomChanged(zoom: number): void {
    this.zoomExportButton.textContent = `Sheet PNG (${zoom}×)`;
  }

  handleKey(key: string): boolean {
    const actions: Record<string, () => void> = {
      " ": () => this.togglePlaying(),
      ",": () => this.stepFrame(-1),
      ".": () => this.stepFrame(1),
      ArrowUp: () => this.selectAnimation(this.animationIndex - 1),
      ArrowDown: () => this.selectAnimation(this.animationIndex + 1),
      s: () => this.setWholeSheetVisible(!this.isShowingWholeSheet),
    };
    const action = actions[key];
    action?.();
    return action !== undefined;
  }

  dispose(): void {
    this.unsubscribeFromClock();
  }

  private onTick(deltaMs: number): void {
    if (!this.isShowingWholeSheet && this.playback.advance(deltaMs)) {
      this.refreshFrameState();
      this.host.redraw();
    }
  }

  private selectAnimation(index: number): void {
    const count = this.sheet.animations.length;
    this.animationIndex = ((index % count) + count) % count;
    this.playback = createPreviewPlayback(this.currentAnimation);
    this.renderAnimationList();
    this.renderFrameStrip();
    this.refreshFrameState();
    this.host.redraw();
  }

  private togglePlaying(): void {
    this.playback.togglePlaying();
    this.refreshFrameState();
  }

  private stepFrame(offset: number): void {
    this.playback.showFrame(this.playback.frameIndex + offset);
    this.refreshFrameState();
    this.host.redraw();
  }

  private showFrame(index: number): void {
    this.playback.showFrame(index);
    this.refreshFrameState();
    this.host.redraw();
  }

  private setWholeSheetVisible(isVisible: boolean): void {
    this.isShowingWholeSheet = isVisible;
    this.sheetToggle.checked = isVisible;
    this.host.refit();
  }

  private renderAnimationList(): void {
    const items = this.sheet.animations.map((animation, index) => {
      const button = createButton("", () => this.selectAnimation(index), `Play "${animation.name}" (↑/↓)`);
      button.className = index === this.animationIndex ? "animation-list__item is-selected" : "animation-list__item";
      button.append(
        createElement("span", { className: "animation-list__name", text: animation.name }),
        createElement("span", {
          className: "animation-list__meta",
          text: `${animation.frames.length} frames · ${animation.loop ? "loop" : "once"}`,
        }),
      );
      return createElement("li", {}, [button]);
    });
    this.animationList.replaceChildren(...items);
  }

  private renderFrameStrip(): void {
    const scale = getFittingScale({ width: this.sheet.frameWidth, height: this.sheet.frameHeight }, FRAME_STRIP_THUMBNAIL_SIZE);
    const cells = this.currentAnimation.frames.map((frame, index) => {
      const canvas = createElement("canvas", { className: "pixel-canvas" });
      drawRgbaImage(canvas, renderImage(getFrameImage(this.sheet, frame), scale));
      const cell = createButton("", () => this.showFrame(index), `Show frame ${index + 1}`);
      cell.className = "frame-strip__cell checkerboard";
      cell.append(canvas);
      return cell;
    });
    this.frameStrip.replaceChildren(...cells);
  }

  /** Syncs the play button, frame counter and highlighted frame with the playback state. */
  private refreshFrameState(): void {
    const frameIndex = this.playback.frameIndex;
    const durationMs = getFrameDurations(this.currentAnimation)[frameIndex] ?? 0;
    this.playButton.textContent = this.playback.isPlaying ? "Pause" : "Play";
    this.frameLabel.textContent = `Frame ${frameIndex + 1} / ${this.playback.frameCount} · ${durationMs} ms`;
    [...this.frameStrip.children].forEach((cell, index) => cell.classList.toggle("is-current", index === frameIndex));
  }

  private exportSheetPng(scale: number): void {
    const fileName = `${getBaseName(getExportStem(this.id, scale))}.png`;
    runDownload(fileName, () => downloadPng(renderSpriteSheet(this.sheet, scale), fileName));
  }

  private exportMetadata(): void {
    const stem = getBaseName(getExportStem(this.id, 1));
    runDownload(`${stem}.json`, () => downloadJson(createSheetMetadata(this.sheet, `${stem}.png`), `${stem}.json`));
  }
}
