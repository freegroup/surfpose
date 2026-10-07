// Runs synchronously in <head> before the first paint, so a page never flashes in the wrong theme.
// document.write keeps the theme stylesheet render-blocking like a normal <link>.
// Keep STORAGE_KEY and THEMES in sync with src/app/theme.js.
(function () {
  var STORAGE_KEY = 'ok-theme';
  var THEMES = ['dark', 'bright'];
  var saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    // storage blocked (private mode) – fall back to system preference
  }
  var theme = THEMES.indexOf(saved) >= 0
    ? saved
    : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'bright' : 'dark');
  document.documentElement.dataset.theme = theme;
  document.write('<link id="theme-css" rel="stylesheet" href="themes/' + theme + '/index.css">');
})();
