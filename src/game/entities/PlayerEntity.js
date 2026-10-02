import { CLASS_CATALOG } from '../classes/classCatalog.js';

export class PlayerEntity {
  constructor(scene, character) {
    this.scene = scene;
    this.character = character;
    this.body = scene.add.container(0, 0).setDepth(10);
    this.shadow = scene.add.graphics();
    this.legs = [scene.add.graphics(), scene.add.graphics()];
    this.cape = scene.add.graphics();
    this.chest = scene.add.graphics();
    this.head = scene.add.graphics();
    this.body.add([this.shadow, ...this.legs, this.cape, this.chest, this.head]);
    this.draw();
  }
  draw() {
    const classData = CLASS_CATALOG[this.character.classId];
    const color = classData.color;
    this.shadow.clear().fillStyle(0x132019, 0.3).fillEllipse(0, 13, 28, 12);

    this.legs.forEach((leg, index) => {
      leg.clear().fillStyle(0x25382a).fillRoundedRect(-3.5, 0, 7, 12, 3);
      leg.setPosition(index === 0 ? -5 : 5, 2);
    });

    this.chest.clear();
    this.chest.fillStyle(color, 0.94).fillPoints([{ x: 0, y: -14 }, { x: 12, y: -5 }, { x: 9, y: 8 }, { x: -9, y: 8 }, { x: -12, y: -5 }], true);
    this.chest.lineStyle(1, 0xf0efdc, 0.75).strokePoints([{ x: 0, y: -14 }, { x: 12, y: -5 }, { x: 9, y: 8 }, { x: -9, y: 8 }, { x: -12, y: -5 }], true);
    if (this.character.classId === 'warrior') {
      this.cape.clear().fillStyle(0x6c3734, 0.95).fillPoints([{ x: -8, y: -8 }, { x: -15, y: -3 }, { x: -12, y: 13 }, { x: -5, y: 8 }, { x: 7, y: 8 }, { x: 12, y: 13 }, { x: 15, y: -3 }, { x: 8, y: -8 }], true);
      this.chest.fillStyle(0x718087, 0.96).fillPoints([{ x: 0, y: -12 }, { x: 8, y: -5 }, { x: 6, y: 6 }, { x: -6, y: 6 }, { x: -8, y: -5 }], true);
      this.chest.lineStyle(1.2, 0xd8e0d5, 0.9).strokePoints([{ x: 0, y: -12 }, { x: 8, y: -5 }, { x: 6, y: 6 }, { x: -6, y: 6 }, { x: -8, y: -5 }], true);
      this.chest.fillStyle(0x394449, 1).fillPoints([{ x: -12, y: -7 }, { x: -7, y: -12 }, { x: -3, y: -8 }, { x: -5, y: -2 }, { x: -11, y: -2 }], true);
      this.chest.fillStyle(0x394449, 1).fillPoints([{ x: 12, y: -7 }, { x: 7, y: -12 }, { x: 3, y: -8 }, { x: 5, y: -2 }, { x: 11, y: -2 }], true);
      this.chest.lineStyle(1, 0xe2c77c, 0.95).lineBetween(-6, 7, 6, 7).lineBetween(0, -3, 0, 5);
      this.chest.fillStyle(0xe0c77c, 1).fillCircle(0, 2, 1.7);
      this.chest.lineStyle(2, 0xb6c1bc, 0.95).lineBetween(-11, -4, -13, 3).lineBetween(11, -4, 13, 3);
      this.cape.setPosition(0, 0);
    }

    this.head.clear().fillStyle(0xe6c6a1).fillCircle(0, -13, 6);
    if (this.character.classId === 'warrior') {
      this.head.fillStyle(0x59666a).fillPoints([{ x: -7, y: -13 }, { x: -7, y: -19 }, { x: -3, y: -23 }, { x: 3, y: -23 }, { x: 7, y: -19 }, { x: 7, y: -13 }, { x: 4, y: -10 }, { x: -4, y: -10 }], true);
      this.head.lineStyle(1, 0xd9e0d5, 0.9).strokePoints([{ x: -7, y: -13 }, { x: -7, y: -19 }, { x: -3, y: -23 }, { x: 3, y: -23 }, { x: 7, y: -19 }, { x: 7, y: -13 }], false);
      this.head.fillStyle(0x233238).fillRoundedRect(-5, -16, 10, 3, 1);
      this.head.fillStyle(0xf2d478).fillCircle(2, -15, 1.1);
      this.head.fillStyle(0x9f493c).fillPoints([{ x: -2, y: -22 }, { x: 0, y: -29 }, { x: 4, y: -22 }], true);
    } else {
      this.head.fillStyle(0x2c342a).fillRoundedRect(-7, -18, 14, 6, 3);
    }
    this.head.fillStyle(0xf2f2d4).fillCircle(2, -13, 1.2);
  }
  update(time, moving = false) {
    const breath = Math.sin(time / 760);
    // A respiração desloca e expande somente o peito; cabeça e sombra ficam estáveis.
    this.chest.setScale(1, 1 + breath * 0.025);
    this.chest.setY(-0.35 + breath * 0.35);
    const stride = moving ? Math.sin(time / 105) * 0.13 : 0;
    this.legs[0].setRotation(stride);
    this.legs[1].setRotation(-stride);
    this.legs[0].y = 2 + Math.max(0, stride) * 2;
    this.legs[1].y = 2 + Math.max(0, -stride) * 2;
  }
  setPosition(x, y) { this.body.setPosition(x, y); this.body.setDepth(y + 10); }
  destroy() { this.body.destroy(); }
}
