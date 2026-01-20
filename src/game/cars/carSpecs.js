// src/game/cars/carSpecs.js
// Unidades internas: px/s, px/s^2, rad/s, coeficientes adimensionales

export const CAR_SPECS = {
  stock: {
    id: 'stock',
    name: 'Stock Kart',

    // Velocidades máximas (px/s)
    maxFwd: 620,
    maxRev: 260,

    // Dinámica longitudinal
    accel: 520,        // aceleración base
    brakeForce: 720,   // fuerza de frenado
    linearDrag: 0.065, // resistencia base

    // Dirección
    turnRate: 2.6,     // rad/s
    turnMin: 0.25      // giro mínimo a alta velocidad
  }
};
