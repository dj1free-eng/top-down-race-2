import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';

export function createGame(parentId = 'app') {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentId,
    backgroundColor: '#0b1020',
    scene: [BootScene, MenuScene],
    scale: {
      mode: Phaser.Scale.RESIZE,      // usa tamaño real del contenedor
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    render: {
      pixelArt: false,
      antialias: true
    }
  });
}
