# 🏎️ TOP-DOWN RACE 2 · KANBAN

Reglas del proyecto:
- Un chat = una disciplina
- Una tarea = una iteración
- Cero conjeturas, solo hechos verificables
- Hasta que algo no pasa a HECHO, no se toca lo siguiente
- Fuente de verdad: ZIP + docs/STATE.md

---

## 🔧 EN PROCESO

- [ ] **Perfiles de conducción**
  - DIRECT (kart / F1) → definido y validado
  - ARCADE (turismos / GT)
  - F1_DOWNFORCE
  - RALLY_LOOSE
  - DRIFT
  - HEAVY_TRUCK

---

## 📌 POR HACER (ORDEN RECOMENDADO)

### 🚗 VEHÍCULOS · FÍSICA Y CONDUCCIÓN
- [ ] Definir y ajustar **perfil ARCADE**
- [ ] Definir **mapas de motor** (ECO / SPORT / RACE)
- [ ] Aceleración progresiva (curva suave)
- [ ] Coast real (soltar gas ≠ frenar)
- [ ] Frenado separado y creíble
- [ ] Ajustar grip por superficie
- [ ] Sistema de upgrades de coche
- [ ] La velocidad de marcha atrás no se ve afectada por el terreno
- [ ] (preparar arquitectura)

---

### 🛠️ TOOLING · DESARROLLO INTERNO
- [ ] Menú DEV in-game (oculto)
- [ ] Sistema de overrides en caliente (localStorage)
- [ ] Import / Export JSON de tuning
- [ ] Carga de JSON externo (handling-overrides.json)
- [ ] Aplicar cambios en pista sin recargar

---

### 🏭 CAR FACTORY (EDITOR DE COCHES)
- [ ] Migrar coches a JSON como fuente de datos
- [ ] Herramienta Car Factory (web interna)
- [ ] Crear coche desde formulario (nombre, marca, skin)
- [ ] Selección de perfiles (giro, motor, neumáticos)
- [ ] Stats base abstractos
- [ ] Probar coche en pista
- [ ] Ajuste fino desde DEV menu
- [ ] Validar coche
- [ ] Exportar JSON final / bloque de código

---

### 🖥️ UI / UX
- [ ] Selector de coches con scroll correcto
- [ ] Tarjetas de coche con stats claras
- [ ] HUD mínimo viable
  - velocidad
  - tiempo actual
  - mejor tiempo
  - delta (+/-)
  - sectores
- [ ] Menú pausa funcional

---

### 🛣️ CIRCUITOS
- [ ] Refinar Track Builder
- [ ] Ajustar materiales top-down realistas
- [ ] Superficies: asfalto / césped / grava
- [ ] Pistas técnicas
- [ ] Pistas tipo kart
- [ ] Pistas especiales / locales

---

### 🔊 AUDIO
- [ ] Música de menú definitiva
- [ ] FX de derrape
- [ ] FX de frenada
- [ ] FX de colisión
- [ ] Sistema básico de mezcla de audio

---

### 🎮 GAMEPLAY
- [ ] Time Trial completo
- [ ] Modo carrera
- [ ] Sistema de progresión
- [ ] Desbloqueo de coches
- [ ] Guardado de progreso

---

### 🌐 FUTURO / ESCALADO
- [ ] Backend serverless (opcional)
- [ ] Guardar presets online
- [ ] Compartir coches
- [ ] Telemetría básica
- [ ] Balanceo avanzado

---

## ✅ HECHO

- [x] Arquitectura base del proyecto
- [x] Desarrollo mobile-first (iPhone)
- [x] Separación RaceScene / resolveCarParams
- [x] Perfil DIRECT de giro (kart / F1)
- [x] Steering modular por perfiles
- [x] Visión clara de Car Factory
- [x] Backlog completo definido

---

## 🧭 NORMA DE USO
- Solo **una tarea** puede estar en EN PROCESO
- Cuando se completa, se mueve a HECHO
- La siguiente se sube desde POR HACER
