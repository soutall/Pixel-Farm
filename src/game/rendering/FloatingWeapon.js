import * as Phaser from 'phaser';
import { CLASS_CATALOG } from '../classes/classCatalog.js';
import { hashString, seededRandom } from '../world/SeededRandom.js';

export class FloatingWeapon {
  constructor(scene, character) {
    this.scene = scene;
    this.character = character;
    this.art = scene.add.graphics().setDepth(12);
    this.lastPerfectSpark = 0;
  }
  update(time, x, y, attacking = false) {
    const equipped = this.character.weapons.find((weapon) => weapon.id === this.character.equippedWeaponId);
    const classData = CLASS_CATALOG[this.character.classId];
    const isWarrior = classData.weaponKind === 'greatsword';
    const color = equipped?.color ?? (isWarrior ? 0xb9c8ce : classData.color);
    const angle = Math.sin(time / 420) * 0.12 + (attacking ? -0.48 : 0);
    const offsetX = (isWarrior ? 25 : 24) + Math.sin(time / 360) * 2 + (attacking ? 7 : 0);
    const offsetY = -10 + Math.cos(time / 510) * 4;
    this.art.clear();
    this.art.lineStyle(2, color, 0.95);
    this.art.fillStyle(color, 0.18);
    this.art.save();
    this.art.translateCanvas(x + offsetX, y + offsetY);
    this.art.rotateCanvas(angle);
    if (isWarrior) {
      const shapeSeed = hashString(equipped?.id ?? `${this.character.id}:starter-steel`);
      const random = seededRandom(shapeSeed);
      const bladeLength = 23 + random() * 7;
      const bladeWidth = 5 + random() * 3;
      const tipWidth = bladeWidth * (0.22 + random() * 0.28);
      const shoulder = 7 + random() * 3;
      const blade = [
        { x: 0, y: -bladeLength - 6 }, { x: tipWidth, y: -bladeLength + 1 },
        { x: bladeWidth, y: -shoulder }, { x: bladeWidth * 0.76, y: 8 },
        { x: -bladeWidth * 0.76, y: 8 }, { x: -bladeWidth, y: -shoulder },
        { x: -tipWidth, y: -bladeLength + 1 }
      ];
      this.art.fillStyle(color, equipped ? 0.35 : 0.2).fillPoints(blade, true);
      this.art.lineStyle(equipped?.quality === 'Perfeita' ? 3 : 2, color, 1).strokePoints(blade, true);
      this.art.lineStyle(1, 0xf5f2dc, 0.82).lineBetween(-bladeWidth * 0.45, -bladeLength + 1, -bladeWidth * 0.34, 4);
      if (equipped?.kind === 'slimeGreatsword' || equipped?.kind === 'voidGreatsword') {
        this.art.fillStyle(color, 0.95).fillPoints([{ x: 0, y: -bladeLength * 0.6 }, { x: 2.5, y: -bladeLength * 0.48 }, { x: 0, y: -bladeLength * 0.36 }, { x: -2.5, y: -bladeLength * 0.48 }], true);
        this.art.fillStyle(equipped.kind === 'voidGreatsword' ? 0xe7a5ff : 0xd6ff9f, 0.95).fillCircle(0, -bladeLength * 0.48, 1.4);
      }
      this.art.lineStyle(3.5, equipped?.kind === 'voidGreatsword' ? 0x65377d : 0x756449, 1).lineBetween(-shoulder, 9, shoulder, 9);
      this.art.lineStyle(4, equipped?.kind === 'voidGreatsword' ? 0x3f2d4b : 0x473c32, 1).lineBetween(0, 10, 0, 20);
      this.art.lineStyle(1, equipped?.kind === 'voidGreatsword' ? 0xdcadf1 : 0xd7c7a2, 0.8).lineBetween(-2, 12, 2, 18);
      const pommel = 2 + random() * 1.7;
      this.art.fillStyle(equipped?.kind === 'voidGreatsword' ? 0xc977f2 : 0xc9b47d, 1).fillCircle(0, 21, pommel);
      if (equipped?.quality === 'Perfeita' || equipped?.quality === 'Rara') this.art.lineStyle(1, 0xffed9c, 0.9).strokeCircle(0, -bladeLength * 0.45, bladeWidth + 2);
    } else if (classData.weaponKind === 'staff') {
      this.art.lineStyle(3, 0x9caedc, 1).lineBetween(0, -21, 0, 20);
      this.art.fillStyle(color, 0.9).fillCircle(0, -23, 6);
      this.art.lineStyle(1, 0xe1edff, 0.9).strokeCircle(0, -23, 8);
    } else {
      this.art.beginPath();
      this.art.arc(0, 0, 19, -1.15, 1.15, false);
      this.art.strokePath();
      this.art.lineBetween(-17, -16, 17, 16);
      this.art.lineBetween(0, -3, -15, 0);
    }
    this.art.restore();
    this.art.setDepth(y + 16);
    if (equipped?.quality === 'Perfeita' && time - this.lastPerfectSpark > 135) {
      this.lastPerfectSpark = time;
      const spark = this.scene.add.star(x + offsetX + (Math.random() - 0.5) * 15, y + offsetY + (Math.random() - 0.5) * 25, 4, 1, 3, Math.random() > 0.5 ? 0xffe989 : 0xafffe6).setDepth(y + 25).setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({ targets: spark, y: spark.y - 16 - Math.random() * 14, x: spark.x + (Math.random() - 0.5) * 18, alpha: 0, scale: 0.1, angle: 120, duration: 420 + Math.random() * 180, onComplete: () => spark.destroy() });
    }
  }
  destroy() { this.art.destroy(); }
}
