import { AnimationClock } from "./animation/animationClock.ts";
import { loadLibraryFromBundle } from "./browserLibrary.ts";
import { DetailView } from "./detail/detailView.ts";
import { renderGallery } from "./gallery/gallery.ts";

function getRequiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`index.html is missing the #${id} element.`);
  }
  return element;
}

function describeLibrary(validCount: number, invalidCount: number): string {
  const summary = `${validCount} asset${validCount === 1 ? "" : "s"}`;
  return invalidCount === 0 ? summary : `${summary} · ${invalidCount} invalid`;
}

const library = loadLibraryFromBundle();
const clock = new AnimationClock();
const detailView = new DetailView(library.entries, clock);

getRequiredElement("library-summary").textContent = describeLibrary(
  library.entries.length,
  library.invalidEntries.length,
);
renderGallery(getRequiredElement("gallery"), library, { clock, onSelect: (entry) => detailView.open(entry) });
