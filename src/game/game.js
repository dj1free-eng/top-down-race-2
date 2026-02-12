import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { RaceScene } from './scenes/RaceScene.js';

import { DEV_FACTORY } from './dev/devFlags.js';
import { CarFactoryScene } from './dev/CarFactoryScene.js';

export function createGame(parentId = 'app') {
  const scenes = [BootScene, MenuScene, RaceScene];
  if (DEV_FACTORY) scenes.splice(2, 0, CarFactoryScene); // Boot, Menu, Factory, Race

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentId,
    backgroundColor: '#0b1020',
    scene: scenes,
    dom: { createContainer: true },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
      default: 'arcade',
      arcade: { debug: false }
    },
    render: {
      pixelArt: false,
      antialias: true
    }
  });
}
