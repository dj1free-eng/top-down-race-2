# Top-Down Race 2 — CORE

## Qué es
Juego de carreras top-down, PWA móvil-first, sesiones cortas, controles simples, progresión con upgrades.

## Stack
- Phaser 3 + Vite
- Deploy en GitHub Pages
- Offline tras primera carga (service worker)

## Reglas de trabajo (obligatorias)
1) Paso a paso: no se avanza sin confirmación explícita del paso anterior.
2) iPhone-only: no asumimos que se puede buscar en el código.
3) Cambios quirúrgicos: siempre se indica archivo/ruta y el bloque exacto “desde… hasta…”.
4) Si el estado actual importa, se pide el fragmento actualizado antes de editar.
5) Una feature/arreglo por iteración. Nada de mezclar frentes.

## Prioridades actuales
1) Render del circuito sólido (césped + asfalto texturizado + bordes) sin huecos ni rejilla visible al mover/culling.
2) Rendimiento estable.
3) Eliminar debug temporal cuando el punto 1 esté cerrado.
