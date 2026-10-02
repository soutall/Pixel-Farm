import * as Phaser from 'phaser';

export class EffectRenderer {
  constructor(scene) { this.scene = scene; }
  hit(x, y, color = 0xf7df9b, strong = false) {
    const ring = this.scene.add.graphics().setDepth(40);
    ring.lineStyle(strong ? 3 : 2, color, 0.9).strokeCircle(0, 0, strong ? 9 : 5);
    ring.setPosition(x, y);
    this.scene.tweens.add({ targets: ring, scale: strong ? 4.2 : 3, alpha: 0, duration: strong ? 400 : 270, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
    const amount = strong ? 12 : 6;
    for (let index = 0; index < amount; index += 1) {
      const particle = this.scene.add.circle(x, y, strong ? 2.5 : 1.8, color, 1).setDepth(41);
      const angle = Math.PI * 2 * index / amount + Math.random() * 0.3;
      const distance = 14 + Math.random() * (strong ? 28 : 18);
      this.scene.tweens.add({ targets: particle, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance, alpha: 0, scale: 0.2, duration: 320 + Math.random() * 240, ease: 'Cubic.Out', onComplete: () => particle.destroy() });
    }
  }
  damageFlash(x, y, scale = 1) {
    const flash = this.scene.add.container(x, y - 3).setDepth(y + 44);
    const red = this.scene.add.graphics();
    red.fillStyle(0xff5366, 0.56).fillEllipse(0, 0, 34 * scale, 27 * scale);
    red.lineStyle(2, 0xffccd1, 0.98).strokeEllipse(0, 0, 34 * scale, 27 * scale);
    const white = this.scene.add.graphics();
    white.lineStyle(3, 0xffffff, 0.96).lineBetween(-12 * scale, -2, -4 * scale, 5 * scale).lineBetween(4 * scale, -7 * scale, 13 * scale, 2);
    flash.add([red, white]);
    this.scene.tweens.add({ targets: flash, alpha: 0, scale: 1.35, duration: 170, ease: 'Cubic.Out', onComplete: () => flash.destroy() });
  }
  projectile(fromX, fromY, toX, toY, color = 0xd7f18e) {
    const orb = this.scene.add.circle(fromX, fromY, 4, color, 1).setDepth(42).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: orb, x: toX, y: toY, scale: 1.8, duration: 180, ease: 'Quad.In', onComplete: () => { orb.destroy(); this.hit(toX, toY, color, true); } });
  }
  rangedProjectile(classId, fromX, fromY, toX, toY, color) {
    if (classId === 'archer') {
      const arrow = this.scene.add.graphics().setDepth(42);
      arrow.lineStyle(2, 0xe8d09a, 1).lineBetween(-10, 0, 8, 0);
      arrow.lineStyle(1, 0xded2ab).lineBetween(5, -3, 9, 0).lineBetween(5, 3, 9, 0);
      arrow.setPosition(fromX, fromY);
      arrow.rotation = Math.atan2(toY - fromY, toX - fromX);
      this.scene.tweens.add({ targets: arrow, x: toX, y: toY, duration: 230, ease: 'Cubic.In', onComplete: () => { arrow.destroy(); this.hit(toX, toY, color, true); } });
      return;
    }
    this.projectile(fromX, fromY, toX, toY, color);
  }
  meleeSlash(x, y, color, direction = 1, time = 0) {
    const slash = this.scene.add.graphics().setDepth(y + 36);
    const facing = direction >= 0 ? 1 : -1;
    slash.lineStyle(6, color, 0.98).beginPath().arc(0, 0, 39, facing > 0 ? -1.3 : 0.2, facing > 0 ? 1.25 : 2.8, false).strokePath();
    slash.lineStyle(2, 0xf4f1d8, 0.95).beginPath().arc(0, 0, 32, facing > 0 ? -1.15 : 0.35, facing > 0 ? 1.1 : 2.65, false).strokePath();
    slash.setPosition(x + 12 * facing, y - 3);
    this.scene.tweens.add({ targets: slash, angle: facing * 34, scaleX: 1.55, scaleY: 1.2, alpha: 0, duration: 220, ease: 'Cubic.Out', onComplete: () => slash.destroy() });
    this.scene.cameras.main.shake(75, 0.0012);
  }
  gatherSuccess(x, y, color = 0xd6e99b) {
    const bar = this.scene.add.graphics().setDepth(y + 50).setPosition(x, y - 30);
    bar.fillStyle(0x111811, 0.8).fillRoundedRect(-16, 0, 32, 4, 2);
    bar.fillStyle(color, 1).fillRoundedRect(-15, 1, 0, 2, 1);
    this.scene.tweens.addCounter({ from: 0, to: 15, duration: 420, onUpdate: (tween) => {
      const width = tween.getValue();
      bar.clear().fillStyle(0x111811, 0.8).fillRoundedRect(-16, 0, 32, 4, 2).fillStyle(color, 1).fillRoundedRect(-15, 1, width, 2, 1);
    }, onComplete: () => {
      bar.destroy();
      this.hit(x, y - 14, color, false);
    } });
  }
  gatherTool(x, y, resource, time = 0) {
    const axe = resource === 'wood';
    const tool = this.scene.add.graphics().setDepth(y + 35);
    const side = Math.sin(time / 400) >= 0 ? 1 : -1;
    tool.lineStyle(4, 0x75533b, 1).lineBetween(-2, 3, 10, -13);
    if (axe) {
      tool.lineStyle(4, 0xc0ccd0, 1).lineBetween(8, -13, 16, -17).lineBetween(8, -13, 12, -5);
      tool.lineStyle(1, 0xffffff, 0.85).lineBetween(11, -13, 16, -16);
    } else {
      tool.lineStyle(4, 0xaab9c2, 1).lineBetween(6, -11, 17, -16);
      tool.lineStyle(1, 0xf5fbff, 0.85).lineBetween(14, -15, 19, -17);
    }
    tool.setPosition(x + side * 9, y - 7);
    this.scene.tweens.add({ targets: tool, angle: side * (axe ? -62 : -46), scale: 1.15, duration: 125, yoyo: true, ease: 'Cubic.Out', onComplete: () => tool.destroy() });
    const sparkColor = axe ? 0xd9bb76 : 0xdff5ff;
    this.hit(x + side * 24, y - 5, sparkColor, false);
    const impact = this.scene.add.graphics().setDepth(y + 34);
    impact.lineStyle(2, sparkColor, 0.92).lineBetween(x + side * 22, y - 7, x + side * 29, y - 13).lineBetween(x + side * 22, y - 7, x + side * 31, y - 5);
    this.scene.tweens.add({ targets: impact, alpha: 0, scale: 1.5, duration: 180, onComplete: () => impact.destroy() });
  }
  createGatherBar(x, y, label) {
    const bar = this.scene.add.graphics().setDepth(y + 60).setPosition(x, y - 32);
    bar.setData('gatherLabel', label);
    return bar;
  }
  updateGatherBar(bar, progress) {
    if (!bar?.active) return;
    const width = 42;
    bar.clear().fillStyle(0x101710, 0.9).fillRoundedRect(-width / 2 - 1, -1, width + 2, 7, 3)
      .fillStyle(0xc6d7ad, 0.85).fillRoundedRect(-width / 2, 0, width, 5, 2)
      .fillStyle(bar.getData('gatherLabel') === 'stone' ? 0xa7d2e3 : 0xd6ad64, 1).fillRoundedRect(-width / 2, 0, width * Math.max(0, Math.min(1, progress)), 5, 2);
  }
  finishGatherBar(bar) { if (bar?.active) bar.destroy(); }
  levelUp(x, y) {
    const colors = [0xf5d779, 0xb7ed85, 0x8edcf2];
    this.expandingRing(x, y, colors[0], 20, 520, 3);
    for (let index = 0; index < 26; index += 1) {
      const color = colors[index % colors.length];
      const particle = this.scene.add.star(x, y, 4, 2, 5, color).setDepth(y + 60);
      const angle = Math.random() * Math.PI * 2;
      const distance = 32 + Math.random() * 72;
      this.scene.tweens.add({ targets: particle, x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance - 32, angle: 180 + Math.random() * 360, alpha: 0, scale: 0.2, duration: 700 + Math.random() * 380, ease: 'Cubic.Out', onComplete: () => particle.destroy() });
    }
    this.scene.cameras.main.flash(220, 246, 223, 147, false);
  }
  warriorWhirlwind(x, y, color, radius = 145) {
    const cyclone = this.scene.add.container(x, y).setDepth(y + 30);
    for (let index = 0; index < 3; index += 1) {
      const slash = this.scene.add.graphics();
      slash.lineStyle(4 - index, color, 0.9 - index * 0.16);
      slash.beginPath();
      slash.arc(0, 0, radius * (0.45 + index * 0.17), -2.3, 1.9, false);
      slash.strokePath();
      slash.lineStyle(2, 0xf4e7b3, 0.78);
      slash.lineBetween(radius * 0.32, -radius * 0.38, radius * 0.58, -radius * 0.55);
      cyclone.add(slash);
    }
    const ring = this.scene.add.graphics().lineStyle(2, color, 0.72).strokeCircle(0, 0, radius * 0.58);
    cyclone.add(ring);
    this.scene.tweens.add({ targets: cyclone, angle: 720, alpha: 0, scale: 1.14, duration: 940, ease: 'Cubic.Out', onComplete: () => cyclone.destroy() });
    this.scene.cameras.main.shake(160, 0.002);
  }
  warriorWarCry(x, y, color) {
    this.expandingRing(x, y, color, 44, 430, 3);
    this.expandingRing(x, y, 0xe9d89b, 25, 330, 1.5, 110);
    this.scene.cameras.main.shake(260, 0.004);
    this.hit(x, y, color, true);
  }
  warriorDefenseAura(x, y, color) {
    const aura = this.scene.add.container(x, y).setDepth(y + 28);
    const circle = this.scene.add.graphics();
    circle.lineStyle(3, color, 0.9).strokeCircle(0, 0, 35);
    circle.lineStyle(1, 0xe9e5bc, 0.65).strokeCircle(0, 0, 46);
    for (let index = 0; index < 6; index += 1) {
      const angle = Math.PI * 2 * index / 6;
      circle.fillStyle(0xe9e5bc, 0.95).fillCircle(Math.cos(angle) * 42, Math.sin(angle) * 42, 2.5);
    }
    aura.add(circle);
    this.scene.tweens.add({ targets: aura, scale: 2.1, alpha: 0, duration: 950, ease: 'Cubic.Out', onComplete: () => aura.destroy() });
  }
  warriorChains(x, y, targets, color) {
    const chains = this.scene.add.graphics().setDepth(45);
    chains.lineStyle(4, 0x342d28, 0.9);
    for (const target of targets) {
      chains.lineBetween(x, y, target.x, target.y);
      chains.lineStyle(1.5, color, 0.92);
      const steps = 8;
      for (let index = 1; index < steps; index += 2) {
        const progress = index / steps;
        const next = (index + 1) / steps;
        const sx = x + (target.x - x) * progress;
        const sy = y + (target.y - y) * progress;
        const ex = x + (target.x - x) * next;
        const ey = y + (target.y - y) * next;
        chains.lineBetween(sx, sy, ex, ey);
      }
      chains.lineStyle(4, 0x342d28, 0.9);
    }
    this.scene.tweens.add({ targets: chains, alpha: 0, duration: 420, ease: 'Cubic.Out', onComplete: () => chains.destroy() });
    this.expandingRing(x, y, color, 70, 350, 2);
    this.scene.cameras.main.shake(230, 0.003);
  }
  expandingRing(x, y, color, radius, duration, width = 2, delay = 0) {
    const ring = this.scene.add.graphics().lineStyle(width, color, 0.9).strokeCircle(0, 0, radius).setPosition(x, y).setDepth(y + 29);
    this.scene.tweens.add({ targets: ring, scale: 4, alpha: 0, delay, duration, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
    return ring;
  }
}
