/**
 * Landing screen. Emits `app:start` when START is pressed.
 * @param {HTMLElement} root
 */
export function initStartScreen(root) {
  const start = /** @type {HTMLButtonElement} */ (root.querySelector('.start-screen__start'));

  start.addEventListener('click', () => {
    root.dispatchEvent(new CustomEvent('app:start', { bubbles: true }));
  });

  return {
    /** @param {{ visible: boolean }} state */
    render({ visible }) {
      root.hidden = !visible;
    },
  };
}
