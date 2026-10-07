import '../styles/layout.css';
import { initLegalPage } from '../components/legal-page/legal-page.js';
import { initPageChrome } from './page-chrome.js';
import { wipeAllData } from './storage-wipe.js';

initPageChrome();

const legalPage = initLegalPage(/** @type {HTMLElement} */ (document.querySelector('.legal-page')));
legalPage.render({ wipe: 'idle' });

document.addEventListener('data:wipe', async () => {
  legalPage.render({ wipe: 'running' });
  try {
    await wipeAllData();
    legalPage.render({ wipe: 'done' });
  } catch (error) {
    console.error('Wipe failed', error);
    legalPage.render({ wipe: 'error' });
  }
});
