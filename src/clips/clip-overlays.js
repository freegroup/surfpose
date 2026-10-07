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
 * The Ocean Kraft logo burned into the clips, rasterized from the same inline SVG the UI uses
 * (read from the DOM, recolored to the clip-logo color). A soft shadow keeps it legible on video.
 * @param {number} videoHeight px
 */
export async function renderLogo(videoHeight) {
  const source = /** @type {SVGElement | null} */ (document.querySelector('.brand-logo'));
  if (!source) return null;

  const height = Math.round(videoHeight * 0.1);
  const svg = /** @type {SVGElement} */ (source.cloneNode(true));
  const ratio = (() => {
    const vb = (svg.getAttribute('viewBox') ?? '0 0 2 1').split(/\s+/).map(Number);
    return vb[2] / vb[3] || 2;
  })();
  const width = Math.round(height * ratio);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('fill', themeVar('--color-clip-logo'));

  const data = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
  await img.decode();

  const pad = Math.round(height * 0.2);
  const canvas = new OffscreenCanvas(width + pad * 2, height + pad * 2);
  const ctx = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.shadowColor = themeVar('--color-clip-shadow');
  ctx.shadowBlur = height * 0.18;
  ctx.drawImage(img, pad, pad, width, height);
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
