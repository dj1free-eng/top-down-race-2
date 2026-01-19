import './style.css';
import { createGame } from './game/game.js';

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (e) {
      console.warn('SW register failed', e);
    }
  });
}

registerServiceWorker();
createGame('app');
