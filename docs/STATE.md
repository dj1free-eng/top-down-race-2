Top-Down Race 2 — STATE (Fuente de verdad)

Regla de oro

El estado real del proyecto lo determina:
	1.	El ZIP adjunto más reciente (si lo hay)
	2.	Este documento STATE.md actualizado

Nunca se asume nada “de memoria” si puede haber cambiado.

⸻

Entorno
	•	Dispositivo principal de edición: iPhone (GitHub app)
	•	Limitación clave: no hay búsqueda dentro del código
	•	Flujo de trabajo:
	•	Cambios paso a paso
	•	No se avanza hasta confirmación explícita del paso (“hecho”)

⸻

Estado actual del proyecto (verificado)

Estado final verificado — Enero 2026

Circuitos y render
	•	Cambio Track 01 / Track 02:
	•	RaceScene respeta trackKey
	•	Persistencia correcta en localStorage
	•	Huecos / rejilla al moverse:
	•	Eliminados de forma estructural
	•	Sustitución de tileSprite por image en chunks de asfalto
	•	Máscara estable por celda (sin bleeding ni grid visible)
	•	Culling de pista:
	•	Sistema por celdas operativo
	•	Toggle ON/OFF funcional
	•	En OFF: pinta todas las celdas reales sin loops gigantes
	•	Al volver a ON: limpieza y reconstrucción correctas
	•	Bordes de pista:
	•	Dibujados globalmente (fuera del culling)
	•	Correcta superposición sobre asfalto

Cámara y UI
	•	Zoom en iPhone usable:
	•	Controles táctiles + / −
	•	uiCam separada para HUD (HUD no escala)
	•	Controles táctiles:
	•	touchUI correctamente ignorado por mainCam
	•	No se ve afectado por zoom ni por culling
	•	HUD principal:
	•	Información de vuelta, sectores y tiempos estable
	•	Autoajuste de tamaño (_fitHud)

Start lights / Semáforo (F1-style)
	•	Sistema de semáforo funcional y verificado
	•	PNGs cargados correctamente desde BootScene
	•	Corrección aplicada:
	•	Se eliminó el uso de una key inexistente (startlights_f1)
	•	El semáforo base usa start_base
	•	Secuencia start_l1 → start_l6 funciona correctamente
	•	Modal de salida:
	•	Bloquea el coche hasta “lights out”
	•	Cronómetro arranca exactamente en lights out
	•	Sistema _hideMissingTextures():
	•	Activo
	•	Oculta correctamente cualquier objeto con textura missing
	•	Ya no afecta al semáforo

Gameplay / lógica
	•	Penalización fuera de pista:
	•	Pérdida fuerte de velocidad
	•	Reducción de capacidad de giro
	•	Recuperación costosa pero posible
	•	Detección de vueltas:
	•	Meta + checkpoints (CP1 / CP2)
	•	Orden obligatorio (anti-exploit)
	•	Cooldowns robustos
	•	Timing:
	•	lastLap, bestLap, s1, s2, s3 funcionando
	•	Inicio exacto sincronizado con salida

Debug y herramientas DEV
	•	Todo el debug encapsulado mediante:

const DEV_TOOLS = true / false

•	DEV HUD:
	•	Oculto por defecto
	•	Activación mediante gesto multitouch (3 dedos + hold)
	•	Logs en pantalla:
	•	Centralizados
	•	No rompen producción
	•	Debug gráfico de físicas:
	•	Forzado a OFF en producción
	•	Limpieza garantizada si existió antes

⸻

Archivos clave (para pedir fragmentos)
	•	src/game/scenes/RaceScene.js
	•	src/game/tracks/TrackBuilder.js
	•	src/game/tracks/track01_oval.js
	•	src/game/tracks/track02_technical.js
	•	src/game/scenes/BootScene.js
	•	src/game/scenes/MenuScene.js (solo si afecta carga o flujo de escenas)

⸻

SUPERPROMPT — DEV (para abrir DEV v2 / v3)

Proyecto: Top-Down Race 2
Stack: Phaser 3 + Vite — PWA desplegada en GitHub Pages

Este chat es SOLO para:
	•	Programación
	•	Debugging
	•	Rendimiento
	•	Arquitectura

Reglas obligatorias
	1.	iPhone-only: el usuario no puede buscar en el código
	2.	Paso a paso: no avanzas hasta que el usuario diga “hecho”
	3.	Cambios quirúrgicos:
	•	Archivo/ruta exacta
	•	Bloque exacto desde…hasta… (copiar/pegar)
	4.	Si no ves el estado actual:
	•	Pides el fragmento exacto antes de modificar
	5.	Una sola tarea por iteración
	•	Prohibido mezclar frentes

Estado de partida
	•	El usuario adjuntará el ZIP del repo actualizado
	•	STATE.md es fuente de verdad junto con el ZIP

Objetivo inmediato (cuando se reabra DEV)
	•	Consolidación final de RaceScene.js:
	•	Comentarios estructurales
	•	Puntos de ataque claros
	•	Preparar terreno para:
	•	Sectores coloreados (verde / rojo / morado)
	•	Banda sonora dinámica
	•	Modo progresión

⸻

Plantilla de “Paso” (DEV)

PASO X:
1) Archivo/ruta:
2) Reemplaza EXACTAMENTE este bloque (desde … hasta …):
3) Pega este bloque nuevo:
4) Qué debes ver (criterio de éxito):

Último ZIP
	•	Nombre del ZIP: (pendiente)
	•	Fecha: (pendiente)
	•	Nota breve de cambios:
	•	Corrección semáforo (keys de texturas)
	•	Limpieza sintaxis RaceScene
	•	Estado estable verificado en iPhone
