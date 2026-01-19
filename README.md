# Top-Down Race 2 (PWA)

Base del proyecto (Fase 1): Vite + Phaser 3 + PWA (manifest + service worker) listo para GitHub Pages.

## Requisitos
- Node 20+

## Comandos
```bash
npm i
npm run dev
npm run build
npm run preview
```

## GitHub Pages
El workflow `.github/workflows/deploy.yml` despliega `dist/` a Pages cuando haces push a `main`.

## Offline
Tras la primera carga, el Service Worker cachea el shell y assets visitados.
