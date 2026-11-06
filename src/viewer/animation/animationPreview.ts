import { AnimationPlayback } from "../../core/animationPlayback.ts";
import { getFrameDurations } from "../../core/spriteSheet.ts";
import type { Animation } from "../../core/types.ts";

/** How long a one-shot animation (e.g. jump) rests on its last frame before the preview replays it. */
export const ONE_SHOT_RESTART_DELAY_MS = 700;

export function createPreviewPlayback(animation: Animation): AnimationPlayback {
  return new AnimationPlayback(getFrameDurations(animation), {
    loop: animation.loop,
    restartDelayMs: ONE_SHOT_RESTART_DELAY_MS,
  });
}
