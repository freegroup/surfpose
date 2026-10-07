// Camera access with resolution fallbacks.

const RESOLUTIONS = [
  { width: { ideal: 1280 }, height: { ideal: 720 } },
  { width: { ideal: 640 }, height: { ideal: 480 } },
  {},
];

/**
 * Starts the front camera in the given video element.
 * @param {HTMLVideoElement} video
 */
export async function openCamera(video) {
  let lastError;
  for (const resolution of RESOLUTIONS) {
    try {
      video.srcObject = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', ...resolution },
        audio: false,
      });
      await video.play();
      return;
    } catch (error) {
      lastError = error;
      // a denied permission won't change with another resolution
      if (error instanceof DOMException && error.name === 'NotAllowedError') break;
    }
  }
  throw lastError;
}

/** @param {HTMLVideoElement} video */
export function closeCamera(video) {
  const stream = /** @type {MediaStream | null} */ (video.srcObject);
  stream?.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
}
