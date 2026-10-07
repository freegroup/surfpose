// Runtime theme switching. The initial theme is set before first paint by public/theme-init.js.
// Keep STORAGE_KEY and THEMES in sync with that file.

export const THEMES = /** @type {const} */ (['dark', 'bright']);
const STORAGE_KEY = 'ok-theme';

/** @typedef {typeof THEMES[number]} ThemeName */

/** @returns {ThemeName} */
export function currentTheme() {
  return /** @type {ThemeName} */ (document.documentElement.dataset.theme);
}

/**
 * Loads the new theme stylesheet next to the old one and removes the old one only after
 * the new one has loaded – no flash of unstyled content. Fires `themechange` on window.
 * @param {string} name
 */
export function setTheme(name) {
  const theme = THEMES.find((t) => t === name);
  if (!theme || theme === currentTheme()) return;

  const current = /** @type {HTMLLinkElement} */ (document.getElementById('theme-css'));
  const next = document.createElement('link');
  next.rel = 'stylesheet';
  next.href = `themes/${theme}/index.css`;
  next.addEventListener('load', () => {
    current.remove();
    next.id = 'theme-css';
    document.documentElement.dataset.theme = theme;
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }, { once: true });
  current.after(next);

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // storage blocked – the theme still applies for this page view
  }
}
