const STYLE_ELEMENT_ID = 'study-helper-read-along-highlight-css';

/** Injected so PostCSS/Tailwind never drops the `::highlight()` rules from bundled CSS. */
export function registerReadAlongHighlightStyles(): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.getElementById(STYLE_ELEMENT_ID)) {
    return;
  }
  const el = document.createElement('style');
  el.id = STYLE_ELEMENT_ID;
  el.textContent = `
::highlight(study-helper-read-along) {
  background-color: rgb(252 211 77 / 0.88);
  color: inherit;
}
mark.read-along-fallback-mark {
  background-color: rgb(252 211 77 / 0.88);
  color: inherit;
  border-radius: 0.125rem;
  padding-left: 0.125rem;
  padding-right: 0.125rem;
}
`;
  document.head.appendChild(el);
}
