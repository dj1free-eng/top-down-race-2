import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { RaceScene } from './scenes/RaceScene.js';

import { GarageScene } from './scenes/GarageScene.js';
import { GarageDetailScene } from './scenes/GarageDetailScene.js';
import { AdminHubScene } from './scenes/AdminHubScene.js';
import { CarEditorScene } from './scenes/CarEditorScene.js';

export function createGame(parentId = 'app') {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentId,
    backgroundColor: '#0b1020',
    // IMPORTANT: si una Scene no está aquí, Vite la tree-shakea y en runtime verás
    // "ReferenceError: Can't find variable: ..." al abrirla.
scene: [BootScene, MenuScene, GarageScene, GarageDetailScene, RaceScene, AdminHubScene, CarEditorScene],
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
