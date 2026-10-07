/**
 * How to set up camera and body before the first pop-up.
 * @param {HTMLElement} root
 */
export function initSetupHints(root) {
  return {
    /** @param {{ visible: boolean }} state */
    render({ visible }) {
      root.hidden = !visible;
    },
  };
}
