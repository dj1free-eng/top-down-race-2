// src/game/dev/CarFactoryScene.js
import Phaser from 'phaser';
import { CAR_SPECS } from '../cars/carSpecs.js';
import { HANDLING_PROFILES } from '../cars/handlingProfiles.js';

// ═══════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const CATEGORIES = ['sport', 'rally', 'drift', 'truck', 'classic', 'concept'];
const RARITIES = ['common', 'rare', 'epic', 'legendary'];

const NUM_LIMITS = {
  maxFwd: { min: 50, max: 500 },
  maxRev: { min: 10, max: 200 },
  accel: { min: 10, max: 300 },
  brakeForce: { min: 50, max: 500 },
  engineBrake: { min: 0, max: 100 },
  linearDrag: { min: 0, max: 5 },
  turnRate: { min: 0.5, max: 10 },
  turnMin: { min: 0, max: 10 },
  gripCoast: { min: 0, max: 1 },
  gripDrive: { min: 0, max: 1 },
  gripBrake: { min: 0, max: 1 },
};

const FIELD_GROUPS = {
  IDENTIDAD: ['id', 'name', 'brand', 'country', 'skin'],
  META: ['category', 'rarity', 'handlingProfile'],
  FÍSICAS: [
    'maxFwd',
    'maxRev',
    'accel',
    'brakeForce',
    'engineBrake',
    'linearDrag',
    'turnRate',
    'turnMin',
    'gripCoast',
    'gripDrive',
    'gripBrake',
  ],
};

const COLORS = {
  bg: 0x0a0e27,
  panelBg: 0x1a1f3a,
  panelStroke: 0x2a3f5f,
  glow: 0x00d9ff,
  cardBg: 0x252b48,
  cardStroke: 0x3a4a6a,
  textPrimary: 0xffffff,
  textSecondary: 0xa0b0d0,
  accent: 0xffcc00,
  buttonBg: 0x4a5a8a,
  buttonHover: 0x5a6a9a,
};

// ═══════════════════════════════════════════════════════════════════════════
//  SCENE
// ═══════════════════════════════════════════════════════════════════════════

export default class CarFactoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CarFactoryScene' });
  }

  create() {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(0, 0, width, height, COLORS.bg).setOrigin(0);

    // State
    this._factoryCar = null;
    this._selectedCarId = null;
    this._currentTab = 'IDENTIDAD';

    // refs / containers
    this._catalogItems = [];
    this._cardRefs = [];
    this._modalContainer = null;

    this._topBarCont = null;
    this._catalogCont = null;
    this._previewCont = null;
    this._editorCont = null;

    // Layout
    const isMobile = width < 768;
    const catalogWidth = isMobile ? Math.max(180, width * 0.32) : 240;
    const previewWidth = isMobile ? Math.max(220, width * 0.33) : 280;
    const editorWidth = Math.max(260, width - catalogWidth - previewWidth - 60);

    this._layout = {
      catalogX: 10,
      catalogY: 60,
      catalogW: catalogWidth,
      catalogH: height - 70,
      previewX: catalogWidth + 20,
      previewY: 60,
      previewW: previewWidth,
      previewH: height - 70,
      editorX: catalogWidth + previewWidth + 30,
      editorY: 60,
      editorW: editorWidth,
      editorH: height - 70,
    };

    // Build UI
    this.buildTopBar();
    this.buildCatalog();
    this.buildPreviewPanel();
    this.buildEditorPanel();

    // Select first car
    const firstKey = Object.keys(CAR_SPECS)[0];
    if (firstKey) this.selectCarFromCatalog(firstKey);
  }

  // ───────────────────────────────────────────────────────────────────────
  //  TOP BAR
  // ───────────────────────────────────────────────────────────────────────

  buildTopBar() {
    if (this._topBarCont) this._topBarCont.destroy();

    const { width } = this.scale;
    const cont = this.add.container(0, 0);
    this._topBarCont = cont;

    const title = this.add
      .text(width / 2, 25, 'CAR FACTORY', {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '28px',
        fontStyle: '900',
        color: '#fff',
      })
      .setOrigin(0.5);

    const menuBtn = this.createButton(10, 10, 110, 40, 'MENU', () => {
      this.scene.start('MenuScene');
    });

    let devBtn = null;
    if (this.scene.get('DevAddonScene')) {
      devBtn = this.createButton(width - 120, 10, 110, 40, 'DEV', () => {
        this.scene.launch('DevAddonScene');
      });
    }

    cont.add([title, menuBtn]);
    if (devBtn) cont.add(devBtn);
  }

  // ───────────────────────────────────────────────────────────────────────
  //  CATALOG (Left Panel)
  // ───────────────────────────────────────────────────────────────────────

  buildCatalog() {
    if (this._catalogCont) this._catalogCont.destroy();

    const { catalogX, catalogY, catalogW, catalogH } = this._layout;
    const cont = this.add.container(0, 0);
    this._catalogCont = cont;

    cont.add(this.drawPanel(catalogX, catalogY, catalogW, catalogH));

    cont.add(
      this.add
        .text(catalogX + catalogW / 2, catalogY + 15, 'CATALOG', {
          fontFamily: 'system-ui',
          fontSize: '16px',
          fontStyle: '800',
          color: '#00d9ff',
        })
        .setOrigin(0.5, 0)
    );

    const btnY = catalogY + 45;
    const btnH = 40;
    const btnGap = 8;

    cont.add(
      this.createButton(
        catalogX + 5,
        btnY,
        catalogW - 10,
        btnH,
        'NEW BASE',
        () => this.newBaseCar(),
        COLORS.accent,
        '#000'
      )
    );

    cont.add(
      this.createButton(
        catalogX + 5,
        btnY + (btnH + btnGap) * 1,
        catalogW - 10,
        btnH,
        'CLONE',
        () => this.cloneSelected(),
        COLORS.buttonBg
      )
    );

    cont.add(
      this.createButton(
        catalogX + 5,
        btnY + (btnH + btnGap) * 2,
        catalogW - 10,
        btnH,
        'EXPORT',
        () => this.exportJSON(),
        COLORS.buttonBg
      )
    );

    cont.add(
      this.createButton(
        catalogX + 5,
        btnY + (btnH + btnGap) * 3,
        catalogW - 10,
        btnH,
        'TEST DRIVE',
        () => this.testDrive(),
        COLORS.buttonBg
      )
    );

    const listY = btnY + (btnH + btnGap) * 4 + 12;
    const listH = catalogH - (listY - catalogY) - 10;

    this._catalogListY = listY;
    this._catalogListH = listH;

    this._catalogContainer = this.add.container(catalogX + 5, listY);
    cont.add(this._catalogContainer);

    this._catalogMask = this.add.graphics();
    this._catalogMask.fillStyle(0xffffff, 1);
    this._catalogMask.fillRect(catalogX + 5, listY, catalogW - 10, listH);
    const mask = this._catalogMask.createGeometryMask();
    this._catalogMask.setVisible(false);
    this._catalogContainer.setMask(mask);
    cont.add(this._catalogMask);

    this.populateCatalog();

    this._catalogScrollY = 0;

    const applyCatalogScroll = () => {
      const bounds = this._catalogContainer.getBounds();
      const contentH = bounds.height || 0;
      const minY = Math.min(0, listH - contentH);
      this._catalogScrollY = Phaser.Math.Clamp(this._catalogScrollY, minY, 0);
      this._catalogContainer.y = listY + this._catalogScrollY;
    };

    // Wheel (desktop)
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const inside =
        pointer.x >= catalogX &&
        pointer.x <= catalogX + catalogW &&
        pointer.y >= listY &&
        pointer.y <= listY + listH;

      if (!inside) return;
      this._catalogScrollY -= deltaY * 0.5;
      applyCatalogScroll();
    });

    // Drag (mobile)
    const dragZone = this.add
      .rectangle(catalogX + 5, listY, catalogW - 10, listH, 0x000000, 0.001)
      .setOrigin(0)
      .setInteractive();

    cont.add(dragZone);

    let dragging = false;
    let startY = 0;
    let startScroll = 0;

    dragZone.on('pointerdown', (p) => {
      dragging = true;
      startY = p.y;
      startScroll = this._catalogScrollY;
    });

    this.input.on('pointerup', () => (dragging = false));
    this.input.on('pointermove', (p) => {
      if (!dragging) return;
      const dy = p.y - startY;
      this._catalogScrollY = startScroll + dy;
      applyCatalogScroll();
    });
  }

  populateCatalog() {
    this._catalogItems.forEach((item) => item.destroy());
    this._catalogItems = [];

    let offsetY = 0;
    const itemHeight = 54;
    const itemWidth = this._layout.catalogW - 20;

    Object.keys(CAR_SPECS).forEach((carId) => {
      const spec = CAR_SPECS[carId];
      const isSelected = carId === this._selectedCarId;

      const bg = this.add
        .rectangle(0, offsetY, itemWidth, itemHeight - 6, COLORS.cardBg)
        .setOrigin(0)
        .setStrokeStyle(2, isSelected ? COLORS.glow : COLORS.cardStroke)
        .setInteractive({ useHandCursor: true });

      const nameText = this.add
        .text(10, offsetY + 10, spec.name || carId, {
          fontFamily: 'system-ui',
          fontSize: '14px',
          fontStyle: '800',
          color: isSelected ? '#00d9ff' : '#fff',
        })
        .setOrigin(0);

      const categoryText = this.add
        .text(10, offsetY + 32, spec.category || 'unknown', {
          fontFamily: 'system-ui',
          fontSize: '11px',
          color: '#a0b0d0',
        })
        .setOrigin(0);

      bg.on('pointerdown', () => this.selectCarFromCatalog(carId));

      this._catalogContainer.add([bg, nameText, categoryText]);
      this._catalogItems.push(bg, nameText, categoryText);

      offsetY += itemHeight;
    });
  }

  selectCarFromCatalog(carId) {
    this._selectedCarId = carId;
    this._factoryCar = JSON.parse(JSON.stringify(CAR_SPECS[carId]));
    this.populateCatalog();
    this.refreshPreview();
    this.refreshCards();
  }

  newBaseCar() {
    const baseId = 'stock_roadster';
    if (!CAR_SPECS[baseId]) {
      alert('Base car not found!');
      return;
    }

    const timestamp = Date.now();
    const newId = `custom_${timestamp}`;
    const newCar = JSON.parse(JSON.stringify(CAR_SPECS[baseId]));
    newCar.id = newId;
    newCar.name = `Custom ${timestamp}`;

    CAR_SPECS[newId] = newCar;
    this.selectCarFromCatalog(newId);
  }

  cloneSelected() {
    if (!this._selectedCarId) {
      alert('No car selected!');
      return;
    }

    const timestamp = Date.now();
    const newId = `${this._selectedCarId}_clone_${timestamp}`;
    const newCar = JSON.parse(JSON.stringify(this._factoryCar));
    newCar.id = newId;
    newCar.name = `${newCar.name || newId} (Clone)`;

    CAR_SPECS[newId] = newCar;
    this.selectCarFromCatalog(newId);
  }

  exportJSON() {
    if (!this._factoryCar) {
      alert('No car to export!');
      return;
    }

    const json = JSON.stringify(this._factoryCar, null, 2);
    console.log('EXPORTED CAR:\n', json);

    if (navigator.clipboard) {
      navigator.clipboard.writeText(json).then(() => alert('Car JSON copied to clipboard!'));
    } else {
      alert('Car JSON logged to console!');
    }
  }

  testDrive() {
    if (!this._factoryCar) {
      alert('No car to test!');
      return;
    }

    CAR_SPECS.__test_drive__ = JSON.parse(JSON.stringify(this._factoryCar));
    this.scene.start('GameScene', { testCarId: '__test_drive__' });
  }

  // ───────────────────────────────────────────────────────────────────────
  //  PREVIEW PANEL
  // ───────────────────────────────────────────────────────────────────────

  buildPreviewPanel() {
    if (this._previewCont) this._previewCont.destroy();

    const { previewX, previewY, previewW, previewH } = this._layout;
    const cont = this.add.container(0, 0);
    this._previewCont = cont;

    cont.add(this.drawPanel(previewX, previewY, previewW, previewH));

    cont.add(
      this.add
        .text(previewX + previewW / 2, previewY + 15, 'PREVIEW', {
          fontFamily: 'system-ui',
          fontSize: '16px',
          fontStyle: '800',
          color: '#00d9ff',
        })
        .setOrigin(0.5, 0)
    );

    this._previewSprite = this.add
      .rectangle(previewX + previewW / 2, previewY + previewH / 2 - 50, 100, 50, 0x4a5a8a)
      .setOrigin(0.5);

    cont.add(this._previewSprite);

    this._previewText = this.add
      .text(previewX + previewW / 2, previewY + previewH / 2 + 40, '', {
        fontFamily: 'system-ui',
        fontSize: '13px',
        color: '#a0b0d0',
        align: 'center',
        wordWrap: { width: previewW - 20 },
      })
      .setOrigin(0.5, 0);

    cont.add(this._previewText);

    this.refreshPreview();
  }

  refreshPreview() {
    if (!this._previewText || !this._previewSprite) return;

    if (!this._factoryCar) {
      this._previewText.setText('No car selected');
      return;
    }

    const car = this._factoryCar;
    this._previewText.setText(
      [
        `ID: ${car.id || '—'}`,
        `Name: ${car.name || '—'}`,
        `Brand: ${car.brand || '—'}`,
        `Category: ${car.category || '—'}`,
        `Rarity: ${car.rarity || '—'}`,
      ].join('\n')
    );

    const categoryColors = {
      sport: 0xff4444,
      rally: 0xffaa44,
      drift: 0xaa44ff,
      truck: 0x44ff44,
      classic: 0x4444ff,
      concept: 0xff44ff,
    };
    this._previewSprite.setFillStyle(categoryColors[car.category] || 0x4a5a8a);
  }

  // ───────────────────────────────────────────────────────────────────────
  //  EDITOR PANEL (CARDS + MODAL)
  // ───────────────────────────────────────────────────────────────────────

  buildEditorPanel() {
    if (this._editorCont) this._editorCont.destroy();

    const { editorX, editorY, editorW, editorH } = this._layout;
    const cont = this.add.container(0, 0);
    this._editorCont = cont;

    cont.add(this.drawPanel(editorX, editorY, editorW, editorH));

    cont.add(
      this.add
        .text(editorX + editorW / 2, editorY + 15, 'EDITOR', {
          fontFamily: 'system-ui',
          fontSize: '16px',
          fontStyle: '800',
          color: '#00d9ff',
        })
        .setOrigin(0.5, 0)
    );

    const tabY = editorY + 45;
    const tabH = 42;
    const tabW = editorW / 3 - 4;

    this._tabButtons = [];

    ['IDENTIDAD', 'META', 'FÍSICAS'].forEach((tab, i) => {
      const isActive = this._currentTab === tab;
      const btn = this.createButton(
        editorX + 2 + i * (tabW + 2),
        tabY,
        tabW,
        tabH,
        tab,
        () => this.switchTab(tab),
        isActive ? COLORS.glow : COLORS.buttonBg,
        isActive ? '#000' : '#fff'
      );
      this._tabButtons.push({ tab, btn });
      cont.add(btn);
    });

    this._cardGridY = tabY + tabH + 10;
    this._cardGridH = editorH - (this._cardGridY - editorY) - 10;

    this.buildCardGrid();
  }

  switchTab(tab) {
    if (this._currentTab === tab) return;
    this._currentTab = tab;
    this.buildEditorPanel();
    this.refreshCards();
  }

  buildCardGrid() {
    this._cardRefs.forEach((ref) => {
      ref.shadow.destroy();
      ref.bg.destroy();
      ref.label.destroy();
      ref.value.destroy();
      if (ref.subtitle) ref.subtitle.destroy();
    });
    this._cardRefs = [];

    const { editorX, editorW } = this._layout;
    const fields = FIELD_GROUPS[this._currentTab] || [];

    const isMobile = this.scale.width < 768;
    const cols = isMobile ? 1 : 2;
    const cardW = editorW / cols - 10;
    const cardH = 92;
    const gap = 10;

    let row = 0;
    let col = 0;

    fields.forEach((fieldKey) => {
      const x = editorX + 5 + col * (cardW + gap);
      const y = this._cardGridY + row * (cardH + gap);

      this.createCard(x, y, cardW, cardH, fieldKey);

      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
    });
  }

  createCard(x, y, w, h, fieldKey) {
    if (!this._factoryCar) return;

    const value = this._factoryCar[fieldKey];
    const displayValue = this.formatValue(fieldKey, value);

    const shadow = this.add.rectangle(x + 3, y + 3, w, h, 0x000000, 0.35).setOrigin(0);

    const bg = this.add
      .rectangle(x, y, w, h, COLORS.cardBg)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.cardStroke)
      .setInteractive({ useHandCursor: true });

    const label = this.add
      .text(x + 12, y + 10, this.formatLabel(fieldKey), {
        fontFamily: 'system-ui',
        fontSize: '12px',
        fontStyle: '800',
        color: '#a0b0d0',
      })
      .setOrigin(0);

    const valueText = this.add
      .text(x + w / 2, y + h / 2 + 6, displayValue, {
        fontFamily: 'system-ui',
        fontSize: '22px',
        fontStyle: '900',
        color: '#fff',
      })
      .setOrigin(0.5);

    let subtitle = null;
    const subtitleStr = this.getSubtitle(fieldKey);
    if (subtitleStr) {
      subtitle = this.add
        .text(x + w / 2, y + h - 12, subtitleStr, {
          fontFamily: 'system-ui',
          fontSize: '10px',
          color: '#6a7a9a',
        })
        .setOrigin(0.5);
    }

    bg.on('pointerdown', () => this.tweenPress(bg, () => this.openEditModal(fieldKey)));

    this._editorCont.add([shadow, bg, label, valueText]);
    if (subtitle) this._editorCont.add(subtitle);

    this._cardRefs.push({ fieldKey, shadow, bg, label, value: valueText, subtitle });
  }

  refreshCards() {
    if (!this._factoryCar) return;
    this._cardRefs.forEach((ref) => ref.value.setText(this.formatValue(ref.fieldKey, this._factoryCar[ref.fieldKey])));
  }

  formatLabel(key) {
    return key.replace(/([A-Z])/g, ' $1').toUpperCase().trim();
  }

  formatValue(key, value) {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') return this.fmtNum(value);
    return String(value);
  }

  fmtNum(n) {
    return Number(n).toFixed(3).replace(/\.?0+$/, '');
  }

  getSubtitle(key) {
    const limits = NUM_LIMITS[key];
    if (limits) return `${limits.min} – ${limits.max}`;
    if (key === 'category') return CATEGORIES.join(' · ');
    if (key === 'rarity') return RARITIES.join(' · ');
    if (key === 'handlingProfile') return Object.keys(HANDLING_PROFILES).join(' · ');
    if (key === 'id') return 'text (lowercase + _ )';
    if (['name', 'brand', 'country', 'skin'].includes(key)) return 'text';
    return null;
  }

  // ───────────────────────────────────────────────────────────────────────
  //  MODAL (BIG + RELIABLE)
  // ───────────────────────────────────────────────────────────────────────

  openEditModal(fieldKey) {
    if (!this._factoryCar) return;

    if (this._modalContainer) {
      this._modalContainer.destroy();
      this._modalContainer = null;
    }

    const { width, height } = this.scale;
    const car = this._factoryCar;
    const currentValue = car[fieldKey];

    const root = this.add.container(0, 0);
    this._modalContainer = root;

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.65).setOrigin(0).setInteractive();

    const modalW = Math.min(560, width - 40);
    const modalH = Math.min(520, height - 120);
    const modalX = width / 2 - modalW / 2;
    const modalY = height / 2 - modalH / 2;

    const shadow = this.add.rectangle(modalX + 6, modalY + 6, modalW, modalH, 0x000000, 0.35).setOrigin(0);

    const modalBg = this.add
      .rectangle(modalX, modalY, modalW, modalH, COLORS.panelBg)
      .setOrigin(0)
      .setStrokeStyle(3, COLORS.glow)
      .setInteractive(); // swallow taps so overlay doesn't close immediately

    overlay.on('pointerdown', () => this.closeModal());
    modalBg.on('pointerdown', () => {}); // swallow

    const title = this.add
      .text(modalX + modalW / 2, modalY + 18, this.formatLabel(fieldKey), {
        fontFamily: 'system-ui',
        fontSize: '22px',
        fontStyle: '900',
        color: '#00d9ff',
      })
      .setOrigin(0.5, 0);

    const valueDisplay = this.add
      .text(modalX + modalW / 2, modalY + 56, this.formatValue(fieldKey, currentValue), {
        fontFamily: 'system-ui',
        fontSize: '34px',
        fontStyle: '900',
        color: '#fff',
      })
      .setOrigin(0.5, 0);

    const controls = this.add.container(0, 0);

    const controlsTop = modalY + 120;
    let newValue = currentValue;

    const limits = NUM_LIMITS[fieldKey];

    if (limits) {
      const sliderX = modalX + 40;
      const sliderY = controlsTop + 18;
      const sliderW = modalW - 80;

      const sliderBg = this.add.rectangle(sliderX, sliderY, sliderW, 10, COLORS.cardStroke).setOrigin(0, 0.5);
      const sliderFill = this.add.rectangle(sliderX, sliderY, sliderW * 0.5, 10, COLORS.glow).setOrigin(0, 0.5);

      const sliderHandle = this.add
        .circle(sliderX + sliderW * 0.5, sliderY, 22, COLORS.accent)
        .setStrokeStyle(2, 0x000000, 0.25)
        .setInteractive({ draggable: true, useHandCursor: true });

      const updateSlider = (val) => {
        const clamped = Phaser.Math.Clamp(val, limits.min, limits.max);
        const ratio = (clamped - limits.min) / (limits.max - limits.min || 1);
        sliderHandle.x = sliderX + sliderW * ratio;
        sliderFill.width = sliderW * ratio;
        valueDisplay.setText(this.fmtNum(clamped));
        newValue = clamped;
      };

      sliderHandle.on('drag', (pointer) => {
        const ratio = Phaser.Math.Clamp((pointer.x - sliderX) / sliderW, 0, 1);
        const val = limits.min + ratio * (limits.max - limits.min);
        updateSlider(val);
      });

      updateSlider(typeof currentValue === 'number' ? currentValue : limits.min);

      const step = Math.max(0.001, (limits.max - limits.min) * 0.02);
      const minusBtn = this.createButton(modalX + modalW / 2 - 120, sliderY + 52, 110, 52, '–', () => updateSlider(newValue - step), COLORS.buttonBg);
      const plusBtn = this.createButton(modalX + modalW / 2 + 10, sliderY + 52, 110, 52, '+', () => updateSlider(newValue + step), COLORS.buttonBg);

      controls.add([sliderBg, sliderFill, sliderHandle, minusBtn, plusBtn]);
    } else if (fieldKey === 'category') {
      controls.add(this.buildPickerControls(modalX, modalW, controlsTop, CATEGORIES, currentValue, (val) => {
        newValue = val;
        valueDisplay.setText(String(val));
      }));
    } else if (fieldKey === 'rarity') {
      controls.add(this.buildPickerControls(modalX, modalW, controlsTop, RARITIES, currentValue, (val) => {
        newValue = val;
        valueDisplay.setText(String(val));
      }));
    } else if (fieldKey === 'handlingProfile') {
      const opts = Object.keys(HANDLING_PROFILES);
      controls.add(this.buildPickerControls(modalX, modalW, controlsTop, opts.length ? opts : ['default'], currentValue, (val) => {
        newValue = val;
        valueDisplay.setText(String(val));
      }));
    } else {
      const editBtn = this.createButton(modalX + modalW / 2 - 120, controlsTop + 12, 240, 56, 'EDIT TEXT', () => {
        const result = window.prompt(`Enter new value for ${this.formatLabel(fieldKey)}:`, String(currentValue ?? ''));
        if (result === null) return;
        if (fieldKey === 'id') newValue = String(result).trim().toLowerCase().replace(/\s+/g, '_');
        else newValue = String(result);
        valueDisplay.setText(this.formatValue(fieldKey, newValue));
      }, COLORS.buttonBg);
      controls.add(editBtn);
    }

    const btnY = modalY + modalH - 72;
    const cancelBtn = this.createButton(modalX + 20, btnY, modalW / 2 - 30, 54, 'CANCEL', () => this.closeModal(), COLORS.buttonBg);
    const applyBtn = this.createButton(modalX + modalW / 2 + 10, btnY, modalW / 2 - 30, 54, 'APPLY', () => {
      this.applyFieldUpdate(fieldKey, newValue);
      this.closeModal();
    }, COLORS.accent, '#000');

    root.add([overlay, shadow, modalBg, title, valueDisplay, controls, cancelBtn, applyBtn]);
    root.setDepth(10000);

    // simple entrance
    [shadow, modalBg, title, valueDisplay, controls, cancelBtn, applyBtn].forEach((t) => t.setAlpha(0));
    modalBg.y = modalY - 30;
    shadow.y = modalY - 30;

    this.tweens.add({ targets: [shadow, modalBg, title, valueDisplay, controls, cancelBtn, applyBtn], alpha: 1, duration: 160, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: [shadow, modalBg], y: modalY, duration: 220, ease: 'Back.easeOut' });
  }

  buildPickerControls(modalX, modalW, startY, options, currentValue, onChange) {
    const cont = this.add.container(0, 0);

    const btnW = Math.min(150, (modalW - 60) / 3);
    const btnH = 54;
    const gap = 10;

    let x = modalX + 20;
    let y = startY;

    options.forEach((opt) => {
      const isActive = String(opt) === String(currentValue);

      const btn = this.createButton(
        x, y, btnW, btnH,
        String(opt).toUpperCase(),
        () => onChange(opt),
        isActive ? COLORS.glow : COLORS.buttonBg,
        isActive ? '#000' : '#fff'
      );

      cont.add(btn);

      x += btnW + gap;
      if (x + btnW > modalX + modalW - 20) {
        x = modalX + 20;
        y += btnH + gap;
      }
    });

    return cont;
  }

  closeModal() {
    if (this._modalContainer) {
      this._modalContainer.destroy();
      this._modalContainer = null;
    }
  }

  applyFieldUpdate(fieldKey, value) {
    if (!this._factoryCar) return;

    const limits = NUM_LIMITS[fieldKey];
    if (limits && typeof value === 'number') value = Phaser.Math.Clamp(value, limits.min, limits.max);

    if (fieldKey === 'id') value = String(value).trim().toLowerCase().replace(/\s+/g, '_');

    this._factoryCar[fieldKey] = value;

    if (fieldKey === 'id' && this._selectedCarId !== value) {
      delete CAR_SPECS[this._selectedCarId];
      CAR_SPECS[value] = this._factoryCar;
      this._selectedCarId = value;
      this.populateCatalog();
    } else if (this._selectedCarId) {
      CAR_SPECS[this._selectedCarId] = this._factoryCar;
    }

    this.refreshPreview();
    this.refreshCards();
  }

  // ───────────────────────────────────────────────────────────────────────
  //  UI HELPERS
  // ───────────────────────────────────────────────────────────────────────

  drawPanel(x, y, w, h) {
    const cont = this.add.container(0, 0);

    cont.add(this.add.rectangle(x + 4, y + 4, w, h, COLORS.panelBg, 0.5).setOrigin(0));
    cont.add(this.add.rectangle(x, y, w, h, COLORS.panelBg).setOrigin(0).setStrokeStyle(2, COLORS.panelStroke));
    cont.add(this.add.rectangle(x + 2, y + 2, w - 4, h - 4, COLORS.glow, 0.05).setOrigin(0));

    return cont;
  }

  // IMPORTANT: returns a CONTAINER (so it can be nested)
  createButton(x, y, w, h, text, callback, bgColor = COLORS.buttonBg, textColor = '#fff') {
    const cont = this.add.container(0, 0);

    const shadow = this.add.rectangle(x + 3, y + 3, w, h, 0x000000, 0.35).setOrigin(0);

    const bg = this.add
      .rectangle(x, y, w, h, bgColor)
      .setOrigin(0)
      .setStrokeStyle(2, COLORS.cardStroke)
      .setInteractive({ useHandCursor: true });

    const label = this.add
      .text(x + w / 2, y + h / 2, text, {
        fontFamily: 'system-ui',
        fontSize: Math.min(16, Math.floor(h * 0.42)) + 'px',
        fontStyle: '900',
        color: textColor,
      })
      .setOrigin(0.5);

    bg.on('pointerdown', () => this.tweenPress(bg, callback));
    bg.on('pointerover', () => bg.setFillStyle(COLORS.buttonHover));
    bg.on('pointerout', () => bg.setFillStyle(bgColor));

    cont.add([shadow, bg, label]);
    return cont;
  }

  tweenPress(target, callback) {
    this.tweens.add({
      targets: target,
      scaleX: 0.96,
      scaleY: 0.96,
      duration: 80,
      yoyo: true,
      onComplete: () => callback && callback(),
    });
  }
}
