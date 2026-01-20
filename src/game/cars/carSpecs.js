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
}
    ,touring: {
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
  }
};
