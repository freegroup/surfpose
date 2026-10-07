const format = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** @typedef {'waiting' | 'ready' | 'running' | 'done' | 'timeout'} TimerState */

/**
 * Pop-up time with a coaching hint below it.
 * @param {HTMLElement} root
 */
export function initTimer(root) {
  const value = /** @type {HTMLElement} */ (root.querySelector('.timer__value'));
  const hint = /** @type {HTMLElement} */ (root.querySelector('.timer__hint'));
  const reps = /** @type {HTMLElement} */ (root.querySelector('.timer__reps'));

  return {
    /** @param {{ seconds: number, state: TimerState, hint: string, reps?: number }} s */
    render({ seconds, state, hint: text, reps: count = 0 }) {
      value.textContent = `${format.format(seconds)} s`;
      hint.textContent = text;
      if (reps) {
        reps.textContent = count > 0 ? `${count} ${count === 1 ? 'Pop-up' : 'Pop-ups'}` : '';
        reps.hidden = count === 0;
      }
      root.dataset.state = state;
    },
  };
}
