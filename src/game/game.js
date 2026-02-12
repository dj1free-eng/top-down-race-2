import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { RaceScene } from './scenes/RaceScene.js';
import { CarFactoryScene } from './dev/CarFactoryScene.js';

export function createGame(parentId = 'app') {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentId,
    backgroundColor: '#0b1020',
    // IMPORTANT: si una Scene no está aquí, Vite la tree-shakea y en runtime verás
    // "ReferenceError: Can't find variable: ..." al abrirla.
    scene: [BootScene, MenuScene, RaceScene, CarFactoryScene],
    dom: {
  createContainer: true
},
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
      default: 'arcade',
      arcade: {
        debug: false
      }
    },
    render: {
  pixelArt: false,
  antialias: true
}
  });
}
