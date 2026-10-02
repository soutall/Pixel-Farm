import { CHUNK_HEIGHT, CHUNK_SIZE } from '../world/WorldGenerator.js';
import { hashString, seededRandom } from '../world/SeededRandom.js';
import { MONSTERS } from '../world/MonsterCatalog.js';

export function chunkBackgroundDepth(cy) { return cy * CHUNK_HEIGHT - 1; }

export class ProceduralRenderer {
  constructor(scene, seed) { this.scene = scene; this.seed = seed; this.chunkObjects = new Map(); this.pointObjects = new Map(); }
  render(chunks) {
    const active = new Set(chunks.map((chunk) => chunk.key));
    for (const [key, object] of this.chunkObjects) if (!active.has(key)) { object.destroy(); this.chunkObjects.delete(key); }
    for (const [id, object] of this.pointObjects) if (!active.has(object.chunkKey)) { object.container.destroy(); this.pointObjects.delete(id); }
    for (const chunk of chunks) {
      if (!this.chunkObjects.has(chunk.key)) this.drawChunk(chunk);
      for (const point of chunk.points) {
        if (point.dead || point.collected || this.pointObjects.has(point.id)) continue;
        const container = this.drawPoint(point);
        this.pointObjects.set(point.id, { container, chunkKey: chunk.key, point });
      }
    }
  }
  drawChunk(chunk) {
    const { cx, cy } = chunk;
    const graphic = this.scene.add.graphics().setDepth(chunkBackgroundDepth(cy));
    graphic.fillStyle(chunk.biome.tint, 1).fillRect(cx * CHUNK_SIZE, cy * CHUNK_HEIGHT, CHUNK_SIZE, CHUNK_HEIGHT);
    const random = seededRandom(hashString(`${this.seed}:decoration:${chunk.key}`));
    for (let index = 0; index < 34; index += 1) {
      const x = cx * CHUNK_SIZE + random() * CHUNK_SIZE;
      const y = cy * CHUNK_HEIGHT + random() * CHUNK_HEIGHT;
      const radius = 5 + random() * 15;
      graphic.fillStyle(random() > 0.5 ? 0x314d35 : 0x58744a, 0.18 + random() * 0.22).fillCircle(x, y, radius);
      if (random() > 0.89) {
        graphic.lineStyle(1, 0x9aab6d, 0.16).lineBetween(x - 6, y + 5, x + 5, y - 4);
      }
    }
    graphic.lineStyle(1, 0xc4d38c, 0.12).strokeRect(cx * CHUNK_SIZE, cy * CHUNK_HEIGHT, CHUNK_SIZE, CHUNK_HEIGHT);
    this.chunkObjects.set(chunk.key, graphic);
  }
  addTransient(point, chunkKey) {
    this.removePoint(point.id);
    const container = this.drawPoint(point);
    this.pointObjects.set(point.id, { container, chunkKey, point, transient: true });
    return container;
  }
  drawPoint(point) {
    const container = this.scene.add.container(point.x, point.y).setDepth(point.y + 2);
    const art = this.scene.add.graphics();
    if (point.kind === 'resource') {
      const palette = { wood: 0x9fbd77, stone: 0xa8b4a2, branches: 0xd4bd80 };
      const color = palette[point.resource];
      art.fillStyle(0x122019, 0.25).fillEllipse(0, 10, 28, 10);
      if (point.resource === 'wood') {
        const tree = this.scene.add.container(0, 0, [art]);
        art.fillStyle(0x624c38).fillRect(-3, -2, 6, 15);
        art.fillStyle(color, 0.85).fillCircle(-4, -7, 11).fillCircle(5, -11, 10).fillCircle(2, -2, 9);
        art.lineStyle(1, 0xd5e8a2, 0.6).lineBetween(-2, -10, -5, -15).lineBetween(2, -4, 7, -10);
        container.add(tree);
        point.visual = tree;
        tree.setScale(1.5);
      } else if (point.resource === 'stone') {
        art.fillStyle(0x718274).fillPoints([{ x: -12, y: 8 }, { x: -8, y: -5 }, { x: 2, y: -12 }, { x: 12, y: -3 }, { x: 10, y: 8 }], true);
        art.lineStyle(1, 0xc7d0b7, 0.8).lineBetween(-4, -3, 2, -8);
      } else {
        art.lineStyle(3, color, 0.95).lineBetween(-11, 5, 9, -8).lineBetween(-4, 1, -8, -8).lineBetween(3, -3, 11, 1);
      }
      art.fillStyle(0xf0e7c5, 0.9).fillCircle(0, -21, 2);
    } else if (point.kind === 'slime' || point.kind === 'monster') {
      const purple = point.variant === 'voidSlime';
      const slime = ['slime', 'voidSlime'].includes(point.variant);
      const definition = MONSTERS[point.monsterId ?? point.variant];
      const color = definition?.color ?? (purple ? 0xa958ed : 0x78b96a);
      const visual = this.scene.add.container(0, 0);
      point.visual = visual;
      if (slime) {
        art.fillStyle(0x122019, 0.24).fillEllipse(0, 10, 31, 10);
        art.fillStyle(purple ? 0x7138a6 : color).fillEllipse(0, 0, 29, 23);
        art.fillStyle(purple ? 0xbd78f2 : 0xa3dc7c).fillEllipse(-2, -4, 19, 12);
        art.fillStyle(0x243326).fillCircle(-5, -1, 1.8).fillCircle(5, -1, 1.8);
        art.fillStyle(purple ? 0xf3d5ff : 0xf2d58c).fillCircle(0, 4, 2);
        art.lineStyle(1, purple ? 0xe4b5ff : 0xd4f398, 0.65).strokeEllipse(0, 0, 29, 23);
      } else if (point.monsterId === 'direBat' || point.monsterId === 'batOverlord') {
        const size = point.elite ? 1.7 : 1;
        art.fillStyle(0x15131f, 0.27).fillEllipse(0, 13, 40 * size, 9 * size);
        art.fillStyle(color, 0.9).fillEllipse(0, 0, 15 * size, 24 * size);
        art.fillStyle(color, 0.78).fillPoints([{ x: -5 * size, y: -4 }, { x: -29 * size, y: -18 * size }, { x: -23 * size, y: 4 * size }, { x: -5 * size, y: 7 * size }], true);
        art.fillStyle(color, 0.78).fillPoints([{ x: 5 * size, y: -4 }, { x: 29 * size, y: -18 * size }, { x: 23 * size, y: 4 * size }, { x: 5 * size, y: 7 * size }], true);
        art.fillStyle(0xff6c80, 1).fillCircle(-4 * size, -5 * size, 2.2 * size).fillCircle(4 * size, -5 * size, 2.2 * size);
        art.fillStyle(0xf5e3e9, 1).fillPoints([{ x: -4, y: 8 }, { x: -2, y: 14 }, { x: 0, y: 8 }, { x: 2, y: 8 }, { x: 4, y: 14 }, { x: 5, y: 7 }], true);
      } else {
        const scale = point.monsterId === 'orc' ? 1.3 : point.monsterId === 'wraith' ? 1.1 : 0.94;
        art.fillStyle(0x101611, 0.3).fillEllipse(0, 14, 35 * scale, 10 * scale);
        art.fillStyle(color).fillRoundedRect(-8 * scale, -4, 16 * scale, 19 * scale, 4);
        art.fillStyle(color, 0.9).fillCircle(0, -11 * scale, 8 * scale);
        art.fillStyle(0x2c241c).fillRoundedRect(-10 * scale, 4, 6 * scale, 16 * scale, 2).fillRoundedRect(4 * scale, 4, 6 * scale, 16 * scale, 2);
        art.fillStyle(point.monsterId === 'orc' ? 0xffe087 : 0xe8ee9c).fillCircle(-3.5 * scale, -12 * scale, 1.8).fillCircle(3.5 * scale, -12 * scale, 1.8);
        art.lineStyle(3 * scale, color).lineBetween(-9 * scale, -2, -16 * scale, 6).lineBetween(9 * scale, -2, 16 * scale, 6);
        if (point.monsterId === 'goblin') art.lineStyle(2, 0xd6c88a).lineBetween(14, 4, 20, -2);
        if (point.monsterId === 'orc') art.fillStyle(0xf1ead0).fillPoints([{ x: -5, y: -7 }, { x: -2, y: -1 }, { x: 0, y: -7 }, { x: 3, y: -7 }, { x: 6, y: -1 }, { x: 7, y: -7 }], true);
        if (point.monsterId === 'wraith') { art.fillStyle(color, 0.25).fillEllipse(0, -15, 34, 22); art.fillStyle(0xe5fff8).fillCircle(-3, -12, 1.5).fillCircle(3, -12, 1.5); }
      }
      if (purple) {
        art.lineStyle(2, 0xe0a5ff, 0.7).lineBetween(-10, -10, -14, -16).lineBetween(10, -10, 14, -16);
        art.fillStyle(0xe2a8ff, 0.9).fillCircle(0, -4, 2);
      }
      visual.add(art);
      if (point.elite) {
        const crown = this.scene.add.graphics().lineStyle(2, 0xffdd8d, 1).strokeCircle(0, -31, 22);
        visual.add(crown);
      }
      container.add(visual);
      const hpWidth = point.elite ? 48 : 28;
      const hpBar = this.scene.add.graphics().setPosition(0, point.elite ? -42 : -25);
      hpBar.fillStyle(0x263629, 0.9).fillRoundedRect(-hpWidth / 2, 0, hpWidth, point.elite ? 5 : 3, 2);
      hpBar.fillStyle(point.elite ? 0xf0bc67 : point.monsterId === 'direBat' ? 0xaa8af0 : 0xe78a76).fillRoundedRect(-hpWidth / 2, 0, hpWidth, point.elite ? 5 : 3, 2);
      container.add(hpBar);
      point.hpBar = hpBar;
    } else if (point.kind === 'obstacle' && point.feature === 'lake') {
      const water = this.scene.add.graphics();
      water.fillStyle(0x101b17, 0.32).fillEllipse(2, 7, point.radius * 2.15, point.radius * 1.24);
      water.fillStyle(0x285e69, 0.92).fillEllipse(0, 0, point.radius * 2, point.radius * 1.18);
      water.fillStyle(0x4f9da0, 0.38).fillEllipse(-point.radius * 0.23, -point.radius * 0.14, point.radius * 0.75, point.radius * 0.22);
      water.lineStyle(2, 0x96d5bb, 0.6).strokeEllipse(0, 0, point.radius * 2, point.radius * 1.18);
      container.add(water);
      point.collisionRadius = point.radius * 0.72;
      point.visual = water;
    } else if (point.kind === 'landmark' && point.feature === 'cabin') {
      art.fillStyle(0x182019, 0.3).fillEllipse(0, 14, 68, 22);
      art.fillStyle(0x72533b).fillRect(-24, -5, 48, 27);
      art.fillStyle(0x906448).fillPoints([{ x: -31, y: -4 }, { x: 0, y: -26 }, { x: 31, y: -4 }, { x: 24, y: 1 }, { x: 0, y: -16 }, { x: -24, y: 1 }], true);
      art.lineStyle(2, 0xc69a63).lineBetween(-28, -4, 0, -26).lineBetween(0, -26, 28, -4);
      art.fillStyle(0x30271e).fillRect(-7, 7, 14, 15);
      art.fillStyle(0xe9bd6f, 0.8).fillRect(13, 2, 7, 8);
      art.lineStyle(1, 0xd0a76a, 0.7).strokeRect(13, 2, 7, 8);
    } else if (point.kind === 'landmark' && point.feature === 'town') {
      art.fillStyle(0x172018, 0.25).fillEllipse(0, 20, 1050, 860);
      art.fillStyle(0x78756b, 0.9).fillEllipse(0, 0, 980, 780);
      art.fillStyle(0x969184, 0.8).fillEllipse(0, 0, 880, 680);
      art.lineStyle(5, 0xd8c793, 0.85).strokeEllipse(0, 0, 990, 790);
      art.lineStyle(2, 0xc5b890, 0.5).strokeEllipse(0, 0, 850, 650);
      for (let row = -5; row <= 5; row += 1) for (let column = -6; column <= 6; column += 1) {
        const tileX = column * 57 + (row % 2) * 28;
        const tileY = row * 49;
        if ((tileX * tileX) / (420 * 420) + (tileY * tileY) / (310 * 310) > 0.78) continue;
        art.lineStyle(1, 0xd8cfb9, 0.3).strokeRect(tileX - 25, tileY - 21, 50, 42);
      }
      for (let index = 0; index < 8; index += 1) {
        const angle = Math.PI * 2 * index / 8;
        const px = Math.cos(angle) * 345; const py = Math.sin(angle) * 265;
        art.fillStyle(0x496047).fillEllipse(px, py + 13, 48, 21);
        art.fillStyle(0x5b7c4e).fillCircle(px, py, 18);
      }
      art.fillStyle(0x665644).fillRoundedRect(-95, -75, 190, 138, 8);
      art.fillStyle(0x9c8059).fillPoints([{ x: -112, y: -71 }, { x: 0, y: -146 }, { x: 112, y: -71 }, { x: 88, y: -55 }, { x: 0, y: -113 }, { x: -88, y: -55 }], true);
      art.lineStyle(4, 0xc4a976).lineBetween(-108, -71, 0, -146).lineBetween(0, -146, 108, -71);
      art.fillStyle(0x30271e).fillRoundedRect(-19, 10, 38, 53, 5);
      art.fillStyle(0xffd885, 0.82).fillRect(-73, -43, 23, 24).fillRect(50, -43, 23, 24);
      art.lineStyle(2, 0xe9d393).strokeRect(-75, -45, 27, 28).strokeRect(48, -45, 27, 28);
      art.fillStyle(0x55544d).fillEllipse(0, 138, 76, 45);
      art.fillStyle(0x193743).fillEllipse(0, 134, 49, 25);
      art.lineStyle(4, 0xb4a483).strokeEllipse(0, 132, 72, 39);
      art.lineStyle(5, 0x79583c).lineBetween(77, 147, 112, 164).lineBetween(82, 162, 115, 143);
      art.fillStyle(0xffa94f, 0.3).fillCircle(98, 145, 28);
      art.fillStyle(0xef8c41).fillPoints([{ x: 98, y: 127 }, { x: 111, y: 145 }, { x: 104, y: 157 }, { x: 90, y: 154 }, { x: 86, y: 142 }], true);
      art.fillStyle(0xffe18a).fillPoints([{ x: 98, y: 136 }, { x: 104, y: 146 }, { x: 99, y: 153 }, { x: 93, y: 148 }], true);
      point.isLightSource = true;
    } else if (point.kind === 'landmark' && point.feature === 'safeBoundary') {
      art.lineStyle(3, 0xa8d979, 0.7).strokeCircle(0, 0, point.radius);
      art.lineStyle(1, 0xd8efad, 0.42).strokeCircle(0, 0, point.radius - 8);
      for (let index = 0; index < 24; index += 1) {
        const angle = Math.PI * 2 * index / 24;
        art.fillStyle(index % 3 === 0 ? 0xffe5a0 : 0xb9e489, 0.9).fillCircle(Math.cos(angle) * point.radius, Math.sin(angle) * point.radius, index % 3 === 0 ? 3 : 1.4);
      }
      point.isLightSource = true;
    } else if (point.kind === 'landmark' && point.feature === 'campfire') {
      art.lineStyle(4, 0x715336, 1).lineBetween(-11, 9, 10, 15).lineBetween(-9, 15, 10, 8);
      art.fillStyle(0xf1a94f, 0.3).fillCircle(0, 2, 15);
      art.fillStyle(0xf08d40).fillPoints([{ x: 0, y: -15 }, { x: 8, y: -3 }, { x: 5, y: 6 }, { x: -5, y: 6 }, { x: -8, y: -3 }], true);
      art.fillStyle(0xffe28b).fillPoints([{ x: 0, y: -8 }, { x: 4, y: 0 }, { x: 2, y: 5 }, { x: -3, y: 5 }, { x: -4, y: 0 }], true);
      point.visual = art;
      point.isLightSource = true;
    }
    if (point.kind === 'resource' && point.resource !== 'wood') container.add(art);
    if (point.kind === 'landmark' && point.feature === 'cabin') container.add(art);
    if (point.kind === 'landmark' && point.feature === 'campfire') container.add(art);
    if (point.kind === 'landmark' && point.feature === 'town') container.add(art);
    if (point.kind === 'landmark' && point.feature === 'safeBoundary') container.add(art);
    return container;
  }
  updatePoint(point) {
    const object = this.pointObjects.get(point.id);
    if (!object) return;
    if (point.kind === 'slime' || point.kind === 'monster') {
      object.container.setAlpha(1);
      if (point.visual && this.scene.time.now >= (point.hitUntil ?? 0)) {
        const pulse = Math.sin(this.scene.time.now / (point.monsterId === 'direBat' ? 100 : 260) + point.x) * (point.monsterId === 'direBat' ? 0.11 : 0.025);
        point.visual.setScale(1 + pulse, 1 - pulse * 0.4);
        if (point.monsterId === 'direBat' || point.monsterId === 'batOverlord') point.visual.setY(Math.sin(this.scene.time.now / 180 + point.x) * 5);
        else if (point.monsterId && point.monsterId !== 'slime' && point.monsterId !== 'voidSlime') point.visual.setY(Math.sin(this.scene.time.now / 320 + point.x) * 1.5);
      }
    }
    if (point.resource === 'wood' && point.visual) point.visual.setRotation(Math.sin(this.scene.time.now / 850 + point.x * 0.02) * 0.035);
    if (point.feature === 'campfire' && point.visual) point.visual.setScale(0.94 + Math.sin(this.scene.time.now / 110) * 0.06);
    if (point.feature === 'lake' && point.visual) point.visual.setAlpha(0.9 + Math.sin(this.scene.time.now / 800 + point.x) * 0.08);
    if (point.hpBar && point.maxHp) {
      const hpRatio = Math.max(0, point.hp / point.maxHp);
      if (Math.abs(hpRatio - (point.lastRenderedHpRatio ?? 1)) < 0.005) return;
      point.lastRenderedHpRatio = hpRatio;
      const width = point.elite ? 48 : 28;
      const height = point.elite ? 5 : 3;
      const color = point.elite ? 0xf0bc67 : point.monsterId === 'direBat' ? 0xaa8af0 : 0xe78a76;
      point.hpBar.clear().fillStyle(0x263629, 0.85).fillRoundedRect(-width / 2, 0, width, height, 2).fillStyle(color, 1).fillRoundedRect(-width / 2, 0, width * hpRatio, height, 2);
    }
  }
  hitPoint(point) {
    const object = this.pointObjects.get(point.id);
    if (!object || !point.visual) return;
    point.hitUntil = this.scene.time.now + 240;
    this.scene.tweens.killTweensOf(point.visual);
    point.visual.setScale(1, 1).setY(0).setAngle(0);
    this.scene.tweens.add({
      targets: point.visual,
      scaleX: 0.72,
      scaleY: 1.28,
      y: -4,
      angle: (Math.random() - 0.5) * 8,
      duration: 85,
      yoyo: true,
      ease: 'Sine.Out',
      onComplete: () => point.visual?.setScale(1, 1).setPosition(0, 0).setAngle(0)
    });
  }
  attackPoint(point) {
    const object = this.pointObjects.get(point.id);
    if (!object?.point.visual) return;
    const visual = object.point.visual;
    this.scene.tweens.killTweensOf(visual);
    const originalX = visual.x;
    const originalRotation = visual.rotation;
    this.scene.tweens.add({
      targets: visual,
      x: originalX + (point.attackStyle === 'ranged' ? 0 : -7),
      rotation: originalRotation + (point.attackStyle === 'ranged' ? 0.12 : -0.24),
      scaleX: 1.2, scaleY: 0.82,
      duration: 105, yoyo: true, ease: 'Cubic.Out',
      onComplete: () => visual.setPosition(originalX, 0).setRotation(originalRotation).setScale(1)
    });
  }
  pullPoint(point, fromX, fromY, duration = 240) {
    const object = this.pointObjects.get(point.id);
    if (!object) return;
    object.container.setPosition(fromX, fromY);
    this.scene.tweens.add({
      targets: object.container,
      x: point.x,
      y: point.y,
      duration,
      ease: 'Back.Out',
      onComplete: () => object.container.setDepth(point.y + 2)
    });
  }
  removePoint(id) { const object = this.pointObjects.get(id); if (object) { object.container.destroy(); this.pointObjects.delete(id); } }
  destroy() { for (const item of this.chunkObjects.values()) item.destroy(); for (const item of this.pointObjects.values()) item.container.destroy(); this.chunkObjects.clear(); this.pointObjects.clear(); }
}
