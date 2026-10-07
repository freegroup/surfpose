// Inline SVG marks for the two clip actions. Color follows currentColor, so the
// theme decides it – never a baked-in fill. aria-hidden: the visible label carries meaning.
export const ICON_REFERENCE =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">' +
  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>' +
  '<circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>';

export const ICON_COOL =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' +
  '<path d="M12 2.5l2.59 5.25 5.79.84-4.19 4.08.99 5.77L12 15.77l-5.18 2.72.99-5.77L3.62 8.59l5.79-.84z"/></svg>';
