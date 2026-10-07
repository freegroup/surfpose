/**
 * Camera image with skeleton overlay and a status line. Emits `app:stop` on "Beenden"
 * and `clips:open` on "Clips".
 * Hands out its video and canvas so camera and renderer can attach to them.
 * @param {HTMLElement} root
 */
export function initCameraView(root) {
  const video = /** @type {HTMLVideoElement} */ (root.querySelector('.camera-view__video'));
  const canvas = /** @type {HTMLCanvasElement} */ (root.querySelector('.camera-view__overlay'));
  const status = /** @type {HTMLElement} */ (root.querySelector('.camera-view__status'));
  const close = /** @type {HTMLButtonElement} */ (root.querySelector('.camera-view__close'));
  const clips = /** @type {HTMLButtonElement} */ (root.querySelector('.camera-view__clips'));

  close.addEventListener('click', () => {
    root.dispatchEvent(new CustomEvent('app:stop', { bubbles: true }));
  });
  clips.addEventListener('click', () => {
    root.dispatchEvent(new CustomEvent('clips:open', { bubbles: true }));
  });

  return {
    video,
    canvas,
    /**
     * @param {{ visible: boolean, status?: string, mirrored?: boolean, clipsAvailable?: boolean,
     *   framing?: 'good' | 'bad' | 'none' }} state  framing: is the whole body in the picture?
     */
    render({ visible, status: text = '', mirrored = true, clipsAvailable = false, framing = 'none' }) {
      clips.hidden = !clipsAvailable;
      root.dataset.framing = framing;
      root.hidden = !visible;
      root.toggleAttribute('data-mirrored', mirrored);
      status.textContent = text;
      status.hidden = !text;
    },
  };
}
