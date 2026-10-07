const format = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Best time and number of pop-ups in this session.
 * @param {HTMLElement} root
 */
export function initStats(root) {
  const best = /** @type {HTMLElement} */ (root.querySelector('.stats__best'));
  const reps = /** @type {HTMLElement} */ (root.querySelector('.stats__reps'));

  return {
    /** @param {{ best: number | null, reps: number, newBest?: boolean }} s */
    render({ best: bestSeconds, reps: count, newBest = false }) {
      best.textContent = bestSeconds === null ? '–' : `${format.format(bestSeconds)} s`;
      reps.textContent = String(count);
      root.toggleAttribute('data-new-best', newBest);
    },
  };
}
