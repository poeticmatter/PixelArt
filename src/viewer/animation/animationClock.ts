type TickListener = (deltaMs: number) => void;

/**
 * Ignore gaps longer than this (e.g. a background tab resuming) so animations
 * continue from where they were instead of skipping ahead.
 */
const MAX_TICK_MS = 250;

/** One shared requestAnimationFrame loop for every animated canvas; it runs only while someone listens. */
export class AnimationClock {
  private readonly listeners = new Set<TickListener>();
  private frameRequest: number | undefined;
  private lastTimestamp: number | undefined;

  subscribe(listener: TickListener): () => void {
    this.listeners.add(listener);
    this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  private start(): void {
    if (this.frameRequest === undefined) {
      this.frameRequest = requestAnimationFrame((timestamp) => this.tick(timestamp));
    }
  }

  private stop(): void {
    if (this.frameRequest !== undefined) {
      cancelAnimationFrame(this.frameRequest);
    }
    this.frameRequest = undefined;
    this.lastTimestamp = undefined;
  }

  private tick(timestamp: number): void {
    const deltaMs = Math.min(MAX_TICK_MS, timestamp - (this.lastTimestamp ?? timestamp));
    this.lastTimestamp = timestamp;
    for (const listener of this.listeners) {
      listener(deltaMs);
    }
    this.frameRequest = requestAnimationFrame((nextTimestamp) => this.tick(nextTimestamp));
  }
}
