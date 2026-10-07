/**
 * Brief "YEAH!" burst over the camera when a held stance scores well (stand mode).
 * @param {HTMLElement} root
 */
export function initCelebration(root) {
  const text = /** @type {HTMLElement} */ (root.querySelector('.celebration__text'));
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let hideTimer;

  return {
    /** @param {{ message: string }} state */
    show({ message }) {
      text.textContent = message;
      root.hidden = false;
      root.classList.remove('celebration--pop');
      void root.offsetWidth; // restart the entrance each time
      root.classList.add('celebration--pop');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => { root.hidden = true; }, 1800);
    },

    hide() {
      clearTimeout(hideTimer);
      root.hidden = true;
    },
  };
}
