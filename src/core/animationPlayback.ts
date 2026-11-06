/**
 * Frame timing for previewing an animation, independent of any clock or DOM.
 * One-shot animations pause on their last frame for `restartDelayMs`, then replay,
 * so a preview keeps showing them instead of freezing.
 */
export class AnimationPlayback {
  private readonly durations: number[];
  private elapsedInFrameMs = 0;
  private currentFrameIndex = 0;
  private isPaused = false;

  constructor(durations: number[], options: { loop: boolean; restartDelayMs: number }) {
    if (durations.length === 0 || durations.some((duration) => duration <= 0)) {
      throw new Error("An animation needs at least one frame, and every duration must be positive.");
    }
    const lastIndex = durations.length - 1;
    this.durations = options.loop
      ? [...durations]
      : durations.map((duration, index) => (index === lastIndex ? duration + options.restartDelayMs : duration));
  }

  get frameIndex(): number {
    return this.currentFrameIndex;
  }

  get frameCount(): number {
    return this.durations.length;
  }

  get isPlaying(): boolean {
    return !this.isPaused;
  }

  /** Advances time; returns whether the visible frame changed. */
  advance(deltaMs: number): boolean {
    if (this.isPaused) {
      return false;
    }
    const previousIndex = this.currentFrameIndex;
    this.elapsedInFrameMs += deltaMs;
    let frameDuration = this.durations[this.currentFrameIndex] ?? 0;
    while (this.elapsedInFrameMs >= frameDuration) {
      this.elapsedInFrameMs -= frameDuration;
      this.currentFrameIndex = (this.currentFrameIndex + 1) % this.durations.length;
      frameDuration = this.durations[this.currentFrameIndex] ?? 0;
    }
    return this.currentFrameIndex !== previousIndex;
  }

  togglePlaying(): void {
    this.isPaused = !this.isPaused;
  }

  /** Jumps to a frame and pauses, for inspecting poses one at a time. */
  showFrame(index: number): void {
    const count = this.durations.length;
    this.currentFrameIndex = ((index % count) + count) % count;
    this.elapsedInFrameMs = 0;
    this.isPaused = true;
  }
}
