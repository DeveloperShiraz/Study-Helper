const OUTLINE_JUMP_HIGHLIGHT_MS = 5000;

const OUTLINE_JUMP_HIGHLIGHT_CLASS = 'study-helper-outline-jump-highlight';

let highlightTimerId: number | null = null;
let highlightedElement: HTMLElement | null = null;

function clearOutlineJumpHighlight(): void {
  if (highlightTimerId !== null) {
    window.clearTimeout(highlightTimerId);
    highlightTimerId = null;
  }
  if (highlightedElement) {
    highlightedElement.classList.remove(OUTLINE_JUMP_HIGHLIGHT_CLASS);
    highlightedElement = null;
  }
}

/** Strong visual cue for ~5s so outline jumps are easy to spot after smooth scroll. */
export function flashOutlineJumpTarget(element: Element): void {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  clearOutlineJumpHighlight();
  highlightedElement = element;
  element.classList.add(OUTLINE_JUMP_HIGHLIGHT_CLASS);
  highlightTimerId = window.setTimeout(() => {
    element.classList.remove(OUTLINE_JUMP_HIGHLIGHT_CLASS);
    if (highlightedElement === element) {
      highlightedElement = null;
    }
    highlightTimerId = null;
  }, OUTLINE_JUMP_HIGHLIGHT_MS);
}
