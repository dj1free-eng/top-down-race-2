# Top-Down Race 2 — STATE (Fuente de verdad)

## Regla de oro
El estado real del proyecto lo determina:
1) El ZIP adjunto más reciente (si lo hay)
2) Este documento STATE.md actualizado

Nunca se asume nada “de memoria” si puede haber cambiado.

---

## Entorno
- Dispositivo principal de edición: iPhone (GitHub app)
- Limitación clave: no puedo buscar dentro del código
- Flujo: cambios paso a paso, y solo se avanza con confirmación del paso anterior

---

## Problema actual (prioridad #1)
Render del circuito:
- Césped OK
- Asfalto con textura: OK “parcial”
- Problema pendiente: se sigue viendo rejilla / fondo detrás en huecos al mover/culling
Objetivo: que el asfalto sea sólido, sin “huecos” y con borde visible.

---

## Archivos clave (para pedir fragmentos)
- src/game/scenes/RaceScene.js
- src/game/tracks/TrackBuilder.js
- src/game/tracks/track01_oval.js
- src/game/scenes/BootScene.js / MenuScene.js (solo si afecta carga/escenas)

---

## SUPERPROMPT — DEV (para abrir DEV v2/v3 cuando se agote el chat)
Proyecto: Top-Down Race 2 (Phaser 3 + Vite, PWA, GitHub Pages).
Este chat es SOLO para programación: código, debugging, rendimiento, arquitectura.
Reglas obligatorias:
1) iPhone-only: el usuario no puede buscar en el código.
2) Paso a paso: no avanzas hasta que el usuario diga “hecho”.
3) Cambios quirúrgicos: siempre indicas archivo/ruta y el bloque exacto a reemplazar (copiar/pegar).
4) Si no ves el estado actual, pides el fragmento exacto antes de modificar.
5) Una sola tarea por iteración. Nada de mezclar frentes.
Estado actual:
- El usuario adjuntará el ZIP del repo en su estado actual.
- Prioridad #1: Render del circuito sin huecos (rejilla visible al moverse/culling).
Objetivo inmediato:
- Diagnosticar qué capa está quedando debajo (bgGrid u otra) y por qué se ve a través del asfalto.
- Corregirlo con un enfoque estable (sin parches sueltos).
Salidas esperadas:
- Instrucciones paso a paso, verificables en cada paso.
- Si hay debug temporal, debe ser fácil de activar/desactivar y eliminar al cerrar el bug.

---

## Plantilla de “Paso” (para el DEV chat)
PASO X:
1) Archivo/ruta:
2) Reemplaza EXACTAMENTE este bloque (desde … hasta …):
3) Pega este bloque nuevo:
4) Qué debes ver (criterio de éxito):
Cuando lo veas, me dices: “Paso X hecho”.

---

## Último ZIP (rellenar cuando adjuntes)
- Nombre del ZIP:
- Fecha:
- Nota breve de cambios:
