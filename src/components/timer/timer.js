const format = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** @typedef {'waiting' | 'ready' | 'running' | 'done' | 'timeout'} TimerState */

/**
 * Pop-up time with a coaching hint below it.
 * @param {HTMLElement} root
 */
export function initTimer(root) {
  const value = /** @type {HTMLElement} */ (root.querySelector('.timer__value'));
  const hint = /** @type {HTMLElement} */ (root.querySelector('.timer__hint'));

  return {
    /** @param {{ seconds: number, state: TimerState, hint: string }} s */
    render({ seconds, state, hint: text }) {
      value.textContent = `${format.format(seconds)} s`;
      hint.textContent = text;
      root.dataset.state = state;
    },
  };
}
