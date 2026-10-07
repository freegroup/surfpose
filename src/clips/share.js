// Sharing via the device's share sheet; download where the browser can't share files.

/** @typedef {import('./clip-store.js').Clip} Clip */

const seconds = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** @param {Clip} clip */
function toFile(clip) {
  const date = new Date(clip.createdAt).toISOString().slice(0, 19).replace(/[T:]/g, '-');
  return new File([clip.video], `pop-up-${date}.mp4`, { type: 'video/mp4' });
}

/**
 * Must be called from a user gesture (tap).
 * @param {Clip} clip
 * @returns {Promise<'shared' | 'downloaded' | 'cancelled'>}
 */
export async function shareClip(clip) {
  const file = toFile(clip);
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `Mein Pop-up: ${seconds.format(clip.popupSeconds)} s 🤙` });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  return 'downloaded';
}
