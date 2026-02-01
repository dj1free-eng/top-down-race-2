// === ERROR OVERLAY (diagnóstico iPhone) ===
(function () {
  function show(msg) {
    try {
      const pre = document.createElement('pre');
      pre.style.cssText =
        'position:fixed;inset:0;z-index:99999;margin:0;padding:12px;' +
        'background:#0b1020;color:#ff6b6b;font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;' +
        'white-space:pre-wrap;overflow:auto;';
      pre.textContent = msg;
      document.body.appendChild(pre);
    } catch {}
  }

  window.addEventListener('error', (e) => {
    show('window.error:\n' + (e?.message || 'unknown') + '\n' + (e?.filename || '') + ':' + (e?.lineno || '') + ':' + (e?.colno || '') + '\n\n' + (e?.error?.stack || ''));
  });

  window.addEventListener('unhandledrejection', (e) => {
    const r = e?.reason;
    show('unhandledrejection:\n' + (r?.message || String(r)) + '\n\n' + (r?.stack || ''));
  });
})();

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

// --- LANDSCAPE-ONLY gate (no rompe escenas) ---
let __game = null;

function __isLandscape() {
  return window.innerWidth >= window.innerHeight;
}

function __setOverlayVisible(visible) {
  const ov = document.getElementById('rotateOverlay');
  if (!ov) return;
  ov.style.display = visible ? 'flex' : 'none';
  ov.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function __sleepGame() {
  try { __game?.loop?.sleep?.(); } catch {}
}

function __wakeGame() {
  try { __game?.loop?.wake?.(); } catch {}
}

function __tickOrientation() {
  const landscape = __isLandscape();

  // Overlay
  __setOverlayVisible(!landscape);

  // Arranque diferido
  if (landscape && !__game) {
    __game = createGame('app');
    return;
  }

  // Si ya existe, dormimos/despertamos el loop
  if (__game) {
    if (landscape) __wakeGame();
    else __sleepGame();
  }
}

// Primer chequeo + eventos
__tickOrientation();
window.addEventListener('resize', __tickOrientation);
window.addEventListener('orientationchange', __tickOrientation);
