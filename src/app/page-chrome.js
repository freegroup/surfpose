import { initThemeSwitch } from '../components/theme-switch/theme-switch.js';
import { currentTheme, setTheme } from './theme.js';

/** Shared by every page: theme switching and marking the current page in the site header. */
export function initPageChrome() {
  const themeSwitch = initThemeSwitch(/** @type {HTMLElement} */ (document.querySelector('.theme-switch')));
  themeSwitch.render({ theme: currentTheme() });
  document.addEventListener('theme:select', (e) => setTheme(/** @type {CustomEvent} */ (e).detail.theme));

  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.site-header__link').forEach((link) => {
    if (/** @type {HTMLAnchorElement} */ (link).pathname.endsWith(page)) link.setAttribute('aria-current', 'page');
  });
}
