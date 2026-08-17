// Shared icon set for Sanoja — simple outline SVGs (24x24, stroke-based),
// used in place of emoji so buttons render consistently across platforms
// instead of depending on each OS's own emoji font.
//
// Loaded as a plain script (not a module) in every context that needs icons:
// the popup, the review/quiz page, and the content script's on-page popup.
// Each context gets its own independent copy of ICONS/iconSvg — that's fine,
// there's no shared state here, just markup.

const ICONS = {
  book: '<path d="M4 5.5A2 2 0 016 3.5h5v17H6a2 2 0 00-2 2v-17z"/><path d="M20 5.5a2 2 0 00-2-2h-5v17h5a2 2 0 012 2v-17z"/>',
  list: '<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/>',
  cloud: '<path d="M7 18.5a4 4 0 01-1-7.9 5 5 0 019.9-1.5A4.5 4.5 0 0117 18.5H7z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><line x1="20" y1="20" x2="15" y2="15"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 3.5v11.5"/><path d="M7 10.5l5 5 5-5"/><path d="M4.5 19.5h15"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.2h5V7"/><path d="M6.5 7l1 13h9l1-13"/><line x1="10.3" y1="11" x2="10.3" y2="17"/><line x1="13.7" y1="11" x2="13.7" y2="17"/>',
  x: '<line x1="5.5" y1="5.5" x2="18.5" y2="18.5"/><line x1="18.5" y1="5.5" x2="5.5" y2="18.5"/>',
  volume: '<path d="M4 9.5v5h3.6l4.9 3.8V5.7L7.6 9.5H4z"/><path d="M16.8 8.3a5 5 0 010 7.4"/><path d="M19.6 5.5a9 9 0 010 13"/>',
  check: '<polyline points="4,12.5 9,17.5 20,6"/>',
  flame: '<path d="M12 2.5c1 3-3 4-3 8a3 3 0 006 0c0-1-1-1.8-1-2.8 2 1 3.3 3 3.3 5.3a5.3 5.3 0 01-10.6 0c0-4.3 3.3-6.5 5.3-10.5z"/>',
};

// Returns raw SVG markup (as an HTML string) for the given icon name, sized
// via the size param. `stroke: false` is used for icons made of filled dots
// (search/more) where the shapes themselves already carry fill.
function iconSvg(name, size) {
  const px = size || 18;
  const body = ICONS[name] || "";
  return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
