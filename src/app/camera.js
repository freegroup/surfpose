// Camera access with resolution fallbacks.

// Front sensors are natively 4:3 – asking for 16:9 makes the browser crop top and bottom,
// exactly the vertical field of view we need to see a body from lying to standing. So we ask
// for 4:3 to get the sensor's full height. We can't widen beyond the lens; this just stops the crop.
const RESOLUTIONS = [
  { width: { ideal: 1280 }, height: { ideal: 960 } },
  { width: { ideal: 640 }, height: { ideal: 480 } },
  {},
];

/**
 * The front camera is mandatory – the surfer has to see the screen. There is no "zoom out"
 * past the lens; the most field of view we can get is the sensor's native 4:3 at its widest zoom.
 * @param {HTMLVideoElement} video
 */
export async function openCamera(video) {
  let lastError;
  for (const resolution of RESOLUTIONS) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', ...resolution },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      widenToMax(stream);
      return;
    } catch (error) {
      lastError = error;
      // a denied permission won't change with another resolution
      if (error instanceof DOMException && error.name === 'NotAllowedError') break;
    }
  }
  throw lastError;
}

/**
 * Where the device exposes a zoom control (mostly Android Chrome), set it to the widest value,
 * so a camera that starts zoomed in shows as much as it can. A no-op where zoom isn't supported.
 * @param {MediaStream} stream
 */
function widenToMax(stream) {
  const track = stream.getVideoTracks()[0];
  const caps = /** @type {{ zoom?: { min: number } }} */ (track?.getCapabilities?.() ?? {});
  if (caps.zoom) {
    const advanced = /** @type {any} */ ([{ zoom: caps.zoom.min }]);
    track.applyConstraints({ advanced }).catch(() => {});
  }
}

/** @param {HTMLVideoElement} video */
export function closeCamera(video) {
  const stream = /** @type {MediaStream | null} */ (video.srcObject);
  stream?.getTracks().forEach((track) => track.stop());
  video.srcObject = null;
}
