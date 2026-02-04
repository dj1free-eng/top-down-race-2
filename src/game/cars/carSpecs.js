// src/game/cars/carSpecs.js
// Unidades internas: px/s, px/s^2, rad/s, coeficientes adimensionales

export const CAR_SPECS = {
  stock: {
    id: 'stock',
    name: 'Stock Kart',

    // Velocidades máximas (px/s)
    maxFwd: 460,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 640,
    brakeForce: 980,
    engineBrake: 260,
    linearDrag: 0.030,

    // Dirección
    turnRate: 3.4,
    turnMin: 0.28,

    // Agarres laterales
    gripCoast: 0.22,
    gripDrive: 0.06,
    gripBrake: 0.14
  },

  touring: {
    id: 'touring',
    name: 'Touring (suave y estable)',

    // Un pelín más de punta y suavidad
    maxFwd: 520,
    maxRev: 260,

    accel: 580,
    brakeForce: 920,
    engineBrake: 220,
    linearDrag: 0.034,

    turnRate: 3.1,
    turnMin: 0.26,

    // Más agarre acelerando = menos derrape bajo carga
    gripCoast: 0.24,
    gripDrive: 0.10,
    gripBrake: 0.16
  },

  power: {
    id: 'power',
    name: 'Power (más nervioso)',
steeringProfile: 'DIRECT',
    // Más punta y más empuje
    maxFwd: 600,
    maxRev: 260,

    accel: 760,
    brakeForce: 1050,
    engineBrake: 260,
    linearDrag: 0.028,

    turnRate: 3.6,
    turnMin: 0.30,

    // Menos grip al acelerar = derrape más “picante”
    gripCoast: 0.22,
    gripDrive: 0.05,
    gripBrake: 0.14
  },

  // =========================================================
  // VEHÍCULOS OFICIALES (15) — listos para skins + UI
  // =========================================================

  helix_spark: {
    id: 'helix_spark',
    name: 'HÉLIX Spark',
    brand: 'HÉLIX',
    country: 'España',
    category: 'Starter',
    role: 'Principiante',

    // UI / Colección
    collectionNo: 1,
    rarity: 'Común',
    skin: 'skin_helix_spark.webp',
    visualScale: 1.00,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 53, ACC: 56, GIR: 67, EST: 61, FRN: 58 },

    // Velocidades máximas (px/s)
    maxFwd: 532.7,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 745.9,
    brakeForce: 1074.5,
    engineBrake: 260,
    linearDrag: 0.031,

    // Dirección
    turnRate: 3.8,
    turnMin: 0.27,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.26,
    gripDrive: 0.10,
    gripBrake: 0.18
  },

  helix_comet: {
    id: 'helix_comet',
    name: 'HÉLIX Comet',
    brand: 'HÉLIX',
    country: 'España',
    category: 'All-Rounder',
    role: 'Transición',
steeringProfile: 'DIRECT',
    // UI / Colección
    collectionNo: 2,
    rarity: 'Poco común',
    skin: 'skin_helix_comet.webp',
    visualScale: 1.03,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 62, ACC: 60, GIR: 64, EST: 55, FRN: 63 },

    // Velocidades máximas (px/s)
    maxFwd: 555.6,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 756.5,
    brakeForce: 1089.8,
    engineBrake: 260,
    linearDrag: 0.031,

    // Dirección
    turnRate: 3.8,
    turnMin: 0.28,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.25,
    gripDrive: 0.08,
    gripBrake: 0.18
  },

  helix_pulse: {
    id: 'helix_pulse',
    name: 'HÉLIX Pulse',
    brand: 'HÉLIX',
    country: 'España',
    category: 'All-Rounder',
    role: 'Competitivo ligero',

    // UI / Colección
    collectionNo: 3,
    rarity: 'Poco común',
    skin: 'skin_helix_pulse.webp',
    visualScale: 1.02,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 64, ACC: 63, GIR: 72, EST: 56, FRN: 62 },

    // Velocidades máximas (px/s)
    maxFwd: 560.7,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 764.5,
    brakeForce: 1086.7,
    engineBrake: 260,
    linearDrag: 0.031,

    // Dirección
    turnRate: 3.91,
    turnMin: 0.27,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.25,
    gripDrive: 0.08,
    gripBrake: 0.18
  },

  crown_axis: {
    id: 'crown_axis',
    name: 'CROWN Axis',
    brand: 'CROWN',
    country: 'Reino Unido',
    category: 'All-Rounder',
    role: 'Competitivo estándar',

    // UI / Colección
    collectionNo: 4,
    rarity: 'Poco común',
    skin: 'skin_crown_axis.webp',
    visualScale: 1.03,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 64, ACC: 61, GIR: 72, EST: 63, FRN: 66 },

    // Velocidades máximas (px/s)
    maxFwd: 560.7,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 759.2,
    brakeForce: 1099.0,
    engineBrake: 260,
    linearDrag: 0.032,

    // Dirección
    turnRate: 3.91,
    turnMin: 0.27,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.26,
    gripDrive: 0.08,
    gripBrake: 0.19
  },

  crown_vector: {
    id: 'crown_vector',
    name: 'CROWN Vector',
    brand: 'CROWN',
    country: 'Reino Unido',
    category: 'All-Rounder',
    role: 'Competitivo avanzado',
steeringProfile: 'DIRECT',
    // UI / Colección
    collectionNo: 5,
    rarity: 'Raro',
    skin: 'skin_crown_vector.webp',
    visualScale: 1.04,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 71, ACC: 63, GIR: 74, EST: 62, FRN: 64 },

    // Velocidades máximas (px/s)
    maxFwd: 578.6,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 764.5,
    brakeForce: 1092.9,
    engineBrake: 260,
    linearDrag: 0.031,

    // Dirección
    turnRate: 3.94,
    turnMin: 0.27,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.25,
    gripDrive: 0.08,
    gripBrake: 0.18
  },

  crown_equinox: {
    id: 'crown_equinox',
    name: 'CROWN Equinox',
    brand: 'CROWN',
    country: 'Reino Unido',
    category: 'All-Rounder',
    role: 'Alta competición',

    // UI / Colección
    collectionNo: 6,
    rarity: 'Raro',
    skin: 'skin_crown_equinox.webp',
    visualScale: 1.06,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 73, ACC: 71, GIR: 66, EST: 61, FRN: 69 },

    // Velocidades máximas (px/s)
    maxFwd: 583.7,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 785.7,
    brakeForce: 1108.2,
    engineBrake: 260,
    linearDrag: 0.031,

    // Dirección
    turnRate: 3.83,
    turnMin: 0.27,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.25,
    gripDrive: 0.08,
    gripBrake: 0.19
  },

  avenir_gripline: {
    id: 'avenir_gripline',
    name: 'AVENIR Gripline',
    brand: 'AVENIR',
    country: 'Francia',
    category: 'Técnico (Grip)',
    role: 'Técnico accesible',

    // UI / Colección
    collectionNo: 7,
    rarity: 'Poco común',
    skin: 'skin_avenir_gripline.webp',
    visualScale: 1.02,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 57, ACC: 55, GIR: 82, EST: 64, FRN: 71 },

    // Velocidades máximas (px/s)
    maxFwd: 542.9,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 743.3,
    brakeForce: 1114.3,
    engineBrake: 260,
    linearDrag: 0.032,

    // Dirección
    turnRate: 4.26,
    turnMin: 0.26,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.27,
    gripDrive: 0.12,
    gripBrake: 0.20
  },

  avenir_apex: {
    id: 'avenir_apex',
    name: 'AVENIR Apex',
    brand: 'AVENIR',
    country: 'Francia',
    category: 'Técnico (Grip)',
    role: 'Técnico agresivo',

    // UI / Colección
    collectionNo: 8,
    rarity: 'Raro',
    skin: 'skin_avenir_apex.webp',
    visualScale: 1.03,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 63, ACC: 61, GIR: 84, EST: 58, FRN: 66 },

    // Velocidades máximas (px/s)
    maxFwd: 558.2,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 759.2,
    brakeForce: 1099.0,
    engineBrake: 260,
    linearDrag: 0.031,

    // Dirección
    turnRate: 4.29,
    turnMin: 0.26,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.26,
    gripDrive: 0.12,
    gripBrake: 0.19
  },

  avenir_torque: {
    id: 'avenir_torque',
    name: 'AVENIR Torque',
    brand: 'AVENIR',
    country: 'Francia',
    category: 'Técnico (Grip)',
    role: 'Técnico élite',

    // UI / Colección
    collectionNo: 9,
    rarity: 'Élite',
    skin: 'skin_avenir_torque.webp',
    visualScale: 1.04,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 66, ACC: 63, GIR: 91, EST: 62, FRN: 73 },

    // Velocidades máximas (px/s)
    maxFwd: 565.8,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 764.5,
    brakeForce: 1120.4,
    engineBrake: 260,
    linearDrag: 0.031,

    // Dirección
    turnRate: 4.39,
    turnMin: 0.25,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.27,
    gripDrive: 0.12,
    gripBrake: 0.20
  },

  veloce_flash: {
    id: 'veloce_flash',
    name: 'VELOCE Flash',
    brand: 'VELOCE',
    country: 'Italia',
    category: 'Velocidad',
    role: 'Velocidad temprana',

    // UI / Colección
    collectionNo: 10,
    rarity: 'Poco común',
    skin: 'skin_veloce_flash.webp',
    visualScale: 0.99,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 72, ACC: 71, GIR: 55, EST: 52, FRN: 54 },

    // Velocidades máximas (px/s)
    maxFwd: 581.1,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 785.7,
    brakeForce: 1062.2,
    engineBrake: 260,
    linearDrag: 0.027,

    // Dirección
    turnRate: 3.67,
    turnMin: 0.28,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.22,
    gripDrive: 0.05,
    gripBrake: 0.16
  },

  veloce_surge: {
    id: 'veloce_surge',
    name: 'VELOCE Surge',
    brand: 'VELOCE',
    country: 'Italia',
    category: 'Velocidad',
    role: 'Alta velocidad',

    // UI / Colección
    collectionNo: 11,
    rarity: 'Raro',
    skin: 'skin_veloce_surge.webp',
    visualScale: 0.98,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 82, ACC: 81, GIR: 46, EST: 51, FRN: 53 },

    // Velocidades máximas (px/s)
    maxFwd: 606.6,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 812.2,
    brakeForce: 1059.2,
    engineBrake: 260,
    linearDrag: 0.027,

    // Dirección
    turnRate: 3.54,
    turnMin: 0.29,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.22,
    gripDrive: 0.05,
    gripBrake: 0.16
  },

  veloce_photon: {
    id: 'veloce_photon',
    name: 'VELOCE Photon',
    brand: 'VELOCE',
    country: 'Italia',
    category: 'Velocidad',
    role: 'Velocidad élite',
steeringProfile: 'DIRECT',
    // UI / Colección
    collectionNo: 12,
    rarity: 'Élite',
    skin: 'skin_veloce_photon.webp',
    visualScale: 0.97,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 91, ACC: 84, GIR: 44, EST: 45, FRN: 62 },

    // Velocidades máximas (px/s)
    maxFwd: 629.6,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 820.2,
    brakeForce: 1086.7,
    engineBrake: 260,
    linearDrag: 0.026,

    // Dirección
    turnRate: 3.51,
    turnMin: 0.30,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.22,
    gripDrive: 0.05,
    gripBrake: 0.17
  },

  forge_hammer: {
    id: 'forge_hammer',
    name: 'FORGE Hammer',
    brand: 'FORGE',
    country: 'EE.UU.',
    category: 'Potencia',
    role: 'Todoterreno militar',

    // UI / Colección
    collectionNo: 13,
    rarity: 'Raro',
    skin: 'skin_forge_hammer.webp',
    visualScale: 1.25,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 66, ACC: 82, GIR: 33, EST: 83, FRN: 64 },

    // Velocidades máximas (px/s)
    maxFwd: 565.8,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 863.8,
    brakeForce: 1092.9,
    engineBrake: 260,
    linearDrag: 0.037,

    // Dirección
    turnRate: 2.89,
    turnMin: 0.33,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.30,
    gripDrive: 0.04,
    gripBrake: 0.18
  },

  forge_anvil: {
    id: 'forge_anvil',
    name: 'FORGE Anvil',
    brand: 'FORGE',
    country: 'EE.UU.',
    category: 'Potencia',
    role: 'Monster truck',
steeringProfile: 'DIRECT',
    // UI / Colección
    collectionNo: 14,
    rarity: 'Élite',
    skin: 'skin_forge_anvil.webp',
    visualScale: 1.35,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 63, ACC: 92, GIR: 31, EST: 81, FRN: 62 },

    // Velocidades máximas (px/s)
    maxFwd: 558.2,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 891.9,
    brakeForce: 1086.7,
    engineBrake: 260,
    linearDrag: 0.037,

    // Dirección
    turnRate: 2.86,
    turnMin: 0.33,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.30,
    gripDrive: 0.04,
    gripBrake: 0.18
  },

  forge_colossus: {
    id: 'forge_colossus',
    name: 'FORGE Colossus',
    brand: 'FORGE',
    country: 'EE.UU.',
    category: 'Potencia',
    role: 'Cabina camión',

    // UI / Colección
    collectionNo: 15,
    rarity: 'Legendario',
    skin: 'skin_forge_colossus.webp',
    visualScale: 1.45,

    // Stats diseño (01–99): VEL/ACC/GIR/EST/FRN
    designStats: { VEL: 71, ACC: 86, GIR: 24, EST: 99, FRN: 73 },

    // Velocidades máximas (px/s)
    maxFwd: 578.6,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 875.0,
    brakeForce: 1120.4,
    engineBrake: 260,
    linearDrag: 0.040,

    // Dirección
    turnRate: 2.78,
    turnMin: 0.34,

    // Agarre lateral (más alto = más estable)
    gripCoast: 0.32,
    gripDrive: 0.04,
    gripBrake: 0.19
  }
};
