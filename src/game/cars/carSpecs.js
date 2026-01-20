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
};
