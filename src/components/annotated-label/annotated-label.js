let count = 0;

/** Nearest ancestor that clips its content – the tooltip has to fit inside it. @param {HTMLElement} el */
function clippingParent(el) {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (getComputedStyle(p).overflowX !== 'visible') return p;
  }
  return document.documentElement;
}

/**
 * A label with a (?) help icon. Hovering or focusing the icon shows the help text as a tooltip.
 * Markup: `<span class="annotated-label" data-help="…">Ist</span>` – or pass the help text in.
 * The label text stays as written; icon and tooltip are added here.
 * @param {HTMLElement} root
 * @param {string} [help] help text, defaults to the root's `data-help`
 */
export function initAnnotatedLabel(root, help = root.dataset.help ?? '') {
  const id = `annotated-label-${++count}`;

  const icon = document.createElement('button');
  icon.type = 'button';
  icon.className = 'annotated-label__icon';
  icon.textContent = '?';
  icon.setAttribute('aria-label', `Erklärung: ${root.textContent?.trim() ?? ''}`);
  icon.setAttribute('aria-describedby', id);

  const tip = document.createElement('span');
  tip.className = 'annotated-label__tip';
  tip.id = id;
  tip.setAttribute('role', 'tooltip');
  tip.textContent = help;

  root.append(icon, tip);

  // open towards the side with more room inside the clipping container
  const place = () => {
    const box = root.getBoundingClientRect();
    const area = clippingParent(root).getBoundingClientRect();
    root.dataset.align = box.left + box.width / 2 > area.left + area.width / 2 ? 'end' : 'start';
  };
  icon.addEventListener('mouseenter', place);
  icon.addEventListener('focus', place);
  icon.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') icon.blur();
  });
}

/**
 * Activates every `.annotated-label` below `container` that isn't active yet – one call per page.
 * @param {ParentNode} [container]
 */
export function initAnnotatedLabels(container = document) {
  container.querySelectorAll('.annotated-label:not([data-ready])').forEach((el) => {
    const label = /** @type {HTMLElement} */ (el);
    label.dataset.ready = '';
    initAnnotatedLabel(label);
  });
}
