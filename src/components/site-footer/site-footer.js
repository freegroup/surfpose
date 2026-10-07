/** @param {HTMLElement} root */
export function initSiteFooter(root) {
  return {
    /** @param {{ visible: boolean }} state */
    render({ visible }) {
      root.hidden = !visible;
    },
  };
}
