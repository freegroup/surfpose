/**
 * Camera image with skeleton overlay and a status line. The site header (in the chrome bar)
 * handles leaving and navigation; this component only owns the picture and status.
 * Hands out its video and canvas so camera and renderer can attach to them.
 * @param {HTMLElement} root
 */
export function initCameraView(root) {
  const video = /** @type {HTMLVideoElement} */ (root.querySelector('.camera-view__video'));
  const canvas = /** @type {HTMLCanvasElement} */ (root.querySelector('.camera-view__overlay'));
  const status = /** @type {HTMLElement} */ (root.querySelector('.camera-view__status'));

  return {
    video,
    canvas,
    /**
     * @param {{ visible: boolean, status?: string, mirrored?: boolean,
     *   framing?: 'good' | 'bad' | 'none' }} state  framing: is the whole body in the picture?
     */
    render({ visible, status: text = '', mirrored = true, framing = 'none' }) {
      root.dataset.framing = framing;
      root.hidden = !visible;
      root.toggleAttribute('data-mirrored', mirrored);
      status.textContent = text;
      status.hidden = !text;
    },
  };
}
