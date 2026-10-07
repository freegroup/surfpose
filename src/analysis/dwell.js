/** Holds when a condition has been true for a minimum time; `since` is when it became true. */
export function createDwell() {
  /** @type {number | null} */
  let since = null;
  return {
    /** @param {boolean} cond @param {number} t @param {number} ms */
    hold(cond, t, ms) {
      if (!cond) {
        since = null;
        return false;
      }
      since ??= t;
      return t - since >= ms;
    },
    since: () => /** @type {number} */ (since),
    reset() {
      since = null;
    },
  };
}
