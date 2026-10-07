// Logo and result badge burned into the clips. Font and colors come from the active theme.

/** @param {string} name */
const themeVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** @param {number} size px */
async function displayFont(size) {
  const font = `italic 800 ${size}px ${themeVar('--font-display')}`;
  await document.fonts.load(font);
  return font;
}

/**
 * "OCEAN ~ KRAFT" wordmark (placeholder until the real logo file exists).
 * @param {number} videoHeight px
 */
export async function renderLogo(videoHeight) {
  const size = Math.round(videoHeight * 0.06);
  const canvas = new OffscreenCanvas(Math.round(size * 4), Math.round(size * 2.4));
  const ctx = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.font = await displayFont(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = themeVar('--color-clip-logo');
  ctx.shadowColor = themeVar('--color-clip-shadow');
  ctx.shadowBlur = size * 0.3;

  const cx = canvas.width / 2;
  ctx.fillText('OCEAN', cx, size * 1.05);
  ctx.fillRect(size * 0.3, size * 1.22, canvas.width - size * 0.6, size * 0.08);
  ctx.fillText('KRAFT', cx, size * 2.25);
  return canvas.transferToImageBitmap();
}

/**
 * Result badge, e.g. "0,87 s · Regular".
 * @param {string} text
 * @param {number} videoHeight px
 */
export async function renderBadge(text, videoHeight) {
  const size = Math.round(videoHeight * 0.075);
  const font = await displayFont(size);
  const measure = new OffscreenCanvas(1, 1).getContext('2d');
  /** @type {OffscreenCanvasRenderingContext2D} */ (measure).font = font;
  const textWidth = /** @type {OffscreenCanvasRenderingContext2D} */ (measure).measureText(text).width;

  const pad = size * 0.45;
  const canvas = new OffscreenCanvas(Math.ceil(textWidth + pad * 2), Math.round(size * 1.4));
  const ctx = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.fillStyle = themeVar('--color-clip-badge-bg');
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, size * 0.2);
  ctx.fill();
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = themeVar('--color-clip-badge-text');
  ctx.fillText(text, pad, canvas.height / 2 + size * 0.05);
  return canvas.transferToImageBitmap();
}
