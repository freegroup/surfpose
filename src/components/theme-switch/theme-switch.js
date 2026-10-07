/**
 * Pill switch between the themes. Emits `theme:select` with `{ theme }`.
 * @param {HTMLElement} root
 */
export function initThemeSwitch(root) {
  const inputs = /** @type {NodeListOf<HTMLInputElement>} */ (root.querySelectorAll('input[type="radio"]'));

  root.addEventListener('change', (event) => {
    const input = /** @type {HTMLInputElement} */ (event.target);
    root.dispatchEvent(new CustomEvent('theme:select', { detail: { theme: input.value }, bubbles: true }));
  });

  return {
    /** @param {{ theme: string }} state */
    render({ theme }) {
      inputs.forEach((input) => {
        input.checked = input.value === theme;
      });
    },
  };
}
