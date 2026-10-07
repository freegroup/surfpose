/**
 * Legal text page. If it contains the wipe section, emits `data:wipe` on the first click
 * and asks for confirmation in place (second click) – no browser dialogs.
 * @param {HTMLElement} root
 */
export function initLegalPage(root) {
  const button = /** @type {HTMLButtonElement | null} */ (root.querySelector('.legal-page__wipe-button'));
  const status = /** @type {HTMLElement | null} */ (root.querySelector('.legal-page__wipe-status'));
  let armed = false;

  button?.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      root.dataset.wipe = 'confirm';
      button.textContent = 'Wirklich alles löschen?';
      return;
    }
    root.dispatchEvent(new CustomEvent('data:wipe', { bubbles: true }));
  });

  return {
    /** @param {{ wipe: 'idle' | 'running' | 'done' | 'error' }} state */
    render({ wipe }) {
      if (!button || !status) return;
      root.dataset.wipe = wipe;
      button.disabled = wipe === 'running' || wipe === 'done';
      button.textContent = 'Alle Daten löschen';
      armed = false;
      status.textContent = {
        idle: '',
        running: 'Lösche …',
        done: 'Erledigt – alle Daten dieser App auf diesem Gerät sind gelöscht.',
        error: 'Löschen hat nicht geklappt. Bitte erneut versuchen.',
      }[wipe];
    },
  };
}
