import Phaser from 'phaser';
import { BaseScene } from './BaseScene.js';

export class TrackStudioScene extends BaseScene {

  constructor() {
    super('TrackStudioScene');
  }

  create() {
    super.create();

    const { width, height } = this.scale;

    const topBarH = 70;
    const leftBarW = 86;
    const rightPanelW = 320;
    const bottomPad = 16;

    const viewX = leftBarW;
    const viewY = topBarH;
    const viewW = width - leftBarW - rightPanelW;
    const viewH = height - topBarH - bottomPad;

    this.cameras.main.setBackgroundColor('#0b1020');

    this.add.rectangle(0, 0, width, topBarH, 0x101626).setOrigin(0);
    this.add.rectangle(0, topBarH, leftBarW, height - topBarH, 0x0f1422).setOrigin(0);
    this.add.rectangle(width - rightPanelW, topBarH, rightPanelW, height - topBarH, 0x0f1422).setOrigin(0);

    this.add.rectangle(viewX, viewY, viewW, viewH, 0x0a0d16)
      .setOrigin(0)
      .setStrokeStyle(2, 0x26324a, 0.9);

    this.add.text(24, 22, 'TRACK STUDIO', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    this.add.text(width - rightPanelW + 24, topBarH + 20, 'PROPIEDADES', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '20px',
      color: '#b7c0ff',
      fontStyle: 'bold'
    });

    const back = this.add.text(width - 110, 22, 'VOLVER', {
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial',
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#1c2540',
      padding: { x: 18, y: 8 }
    })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    back.on('pointerup', () => {
      this.scene.start('admin-hub');
    });

    this._editorWorldW = 4000;
    this._editorWorldH = 4000;

    this._gridGfx = this.add.graphics().setDepth(1);

    this._gridGfx.lineStyle(1, 0x1f2c44, 0.7);

    for (let x = 0; x <= this._editorWorldW; x += 100) {
      this._gridGfx.lineBetween(x, 0, x, this._editorWorldH);
    }

    for (let y = 0; y <= this._editorWorldH; y += 100) {
      this._gridGfx.lineBetween(0, y, this._editorWorldW, y);
    }

    this._gridGfx.lineStyle(2, 0x2d3d5c, 0.9);

    for (let x = 0; x <= this._editorWorldW; x += 500) {
      this._gridGfx.lineBetween(x, 0, x, this._editorWorldH);
    }

    for (let y = 0; y <= this._editorWorldH; y += 500) {
      this._gridGfx.lineBetween(0, y, this._editorWorldW, y);
    }

    const centerMark = this.add.graphics().setDepth(2);

    centerMark.lineStyle(3, 0x2bff88, 0.8);
    centerMark.lineBetween(this._editorWorldW/2-30,this._editorWorldH/2,this._editorWorldW/2+30,this._editorWorldH/2);
    centerMark.lineBetween(this._editorWorldW/2,this._editorWorldH/2-30,this._editorWorldW/2,this._editorWorldH/2+30);

    this._editCam = this.cameras.add(viewX + 2, viewY + 2, viewW - 4, viewH - 4);

    this._editCam.setBackgroundColor('#0a0d16');
    this._editCam.setBounds(0, 0, this._editorWorldW, this._editorWorldH);
    this._editCam.centerOn(this._editorWorldW / 2, this._editorWorldH / 2);
    this._editCam.setZoom(0.28);

    this.cameras.main.ignore([this._gridGfx, centerMark]);

    const worldObjs = [this._gridGfx, centerMark];
    const uiObjs = this.children.list.filter(o => !worldObjs.includes(o));

    this._editCam.ignore(uiObjs);

    this.input.addPointer(2);

    this._panLast = null;
    this._pinchLastDist = 0;

    this._editZoomMin = 0.12;
    this._editZoomMax = 2.5;

    const isPointerInViewport = (pointer) =>
      pointer.x >= viewX &&
      pointer.x <= viewX + viewW &&
      pointer.y >= viewY &&
      pointer.y <= viewY + viewH;

    this.input.on('pointermove', () => {

      const down = this.input.manager.pointers.filter(
        p => p.isDown && isPointerInViewport(p)
      );

      if (down.length === 1) {

        const p = down[0];

        if (this._panLast) {
          const dx = p.x - this._panLast.x;
          const dy = p.y - this._panLast.y;

          this._editCam.scrollX -= dx / this._editCam.zoom;
          this._editCam.scrollY -= dy / this._editCam.zoom;
        }

        this._panLast = { x:p.x, y:p.y };
        this._pinchLastDist = 0;

        return;
      }

      if (down.length >= 2) {

        const p1 = down[0];
        const p2 = down[1];

        const midX = (p1.x+p2.x)/2;
        const midY = (p1.y+p2.y)/2;

        const dx = p2.x-p1.x;
        const dy = p2.y-p1.y;

        const dist = Math.sqrt(dx*dx+dy*dy);

        if (!this._pinchLastDist) {
          this._pinchLastDist = dist;
          this._panLast = null;
          return;
        }

const worldBefore = this._editCam.getWorldPoint(
  midX - this._editCam.x,
  midY - this._editCam.y
);

        const ratio = dist / this._pinchLastDist;

        const newZoom = Phaser.Math.Clamp(
          this._editCam.zoom * ratio,
          this._editZoomMin,
          this._editZoomMax
        );

        this._editCam.setZoom(newZoom);

const worldAfter = this._editCam.getWorldPoint(
  midX - this._editCam.x,
  midY - this._editCam.y
);

        this._editCam.scrollX += worldBefore.x - worldAfter.x;
        this._editCam.scrollY += worldBefore.y - worldAfter.y;

        this._pinchLastDist = dist;

        return;
      }

      this._panLast = null;
      this._pinchLastDist = 0;

    });

    const resetTouch = () => {
      this._panLast = null;
      this._pinchLastDist = 0;
    };

    this.input.on('pointerup', resetTouch);
    this.input.on('pointerupoutside', resetTouch);
  }
}
