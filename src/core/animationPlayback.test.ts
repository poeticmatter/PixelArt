import { describe, expect, it } from "vitest";

import { AnimationPlayback } from "./animationPlayback.ts";

describe("AnimationPlayback", () => {
  it("advances to the next frame once the current frame's duration has elapsed", () => {
    const playback = new AnimationPlayback([100, 200], { loop: true, restartDelayMs: 0 });
    playback.advance(99);
    const indexBefore = playback.frameIndex;
    playback.advance(1);
    expect([indexBefore, playback.frameIndex]).toEqual([0, 1]);
  });

  it("wraps around after the last frame of a looping animation", () => {
    const playback = new AnimationPlayback([100, 200], { loop: true, restartDelayMs: 0 });
    playback.advance(300);
    expect(playback.frameIndex).toBe(0);
  });

  it("holds a one-shot animation on its last frame for the restart delay", () => {
    const playback = new AnimationPlayback([100, 100], { loop: false, restartDelayMs: 500 });
    // Frame 1 starts at 100 ms and lasts 100 + 500 ms, so the replay begins at 700 ms.
    playback.advance(699);
    const heldIndex = playback.frameIndex;
    playback.advance(1);
    expect([heldIndex, playback.frameIndex]).toEqual([1, 0]);
  });

  it("stops advancing while paused", () => {
    const playback = new AnimationPlayback([100, 100], { loop: true, restartDelayMs: 0 });
    playback.togglePlaying();
    expect(playback.advance(1000)).toBe(false);
  });

  it("pauses on the requested frame, wrapping out-of-range indices", () => {
    const playback = new AnimationPlayback([100, 100, 100], { loop: true, restartDelayMs: 0 });
    playback.showFrame(-1);
    expect([playback.frameIndex, playback.isPlaying]).toEqual([2, false]);
  });

  it("rejects an animation without frames", () => {
    expect(() => new AnimationPlayback([], { loop: true, restartDelayMs: 0 })).toThrow(/at least one frame/);
  });
});
