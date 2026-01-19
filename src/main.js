import './style.css';
import { createGame } from './game/game.js';

function showFatal(msg) {
  const el = document.getElementById('app');
  if (!el) return;
  el.innerHTML = `
    <div style="padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#fff;">
      <h2 style="margin:0 0 8px 0;">Pantalla en blanco: error detectado</h2>
      <pre style="white-space:pre-wrap;word-break:break-word;background:#11172e;padding:12px;border-radius:10px;border:1px solid rgba(183,192,255,.25);color:#b7c0ff;">${msg}</pre>
      <p style="color:#b7c0ff;margin:10px 0 0 0;">
        Si ves esto en iPhone, haz captura y pégamela.
      </p>
    </div>
  `;
}

window.addEventListener('error', (e) => {
  const msg = e?.error?.stack || e?.message || String(e);
  showFatal(msg);
});

window.addEventListener('unhandledrejection', (e) => {
  const msg = e?.reason?.stack || e?.reason?.message || String(e?.reason || e);
  showFatal(`UnhandledPromiseRejection:\n${msg}`);
});

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');

      // Si hay un SW nuevo esperando, lo activamos y recargamos una vez
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            nw.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Recarga dura tras activar el nuevo SW
        window.location.reload();
      });
    } catch (e) {
      console.warn('SW register failed', e);
    }
  });
}

registerServiceWorker();
createGame('app');
