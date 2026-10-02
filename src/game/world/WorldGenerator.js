import { hashString, seededRandom } from './SeededRandom.js';
import { BiomeSystem, SAFE_ZONE } from './BiomeSystem.js';
import { BIOME_MONSTERS, createMonster } from './MonsterCatalog.js';

export const CHUNK_SIZE = 640;
export const CHUNK_HEIGHT = 480;
const RESOURCE_TYPES = ['wood', 'stone', 'branches'];

export class WorldGenerator {
  constructor(seed) { this.seed = String(seed); }
  chunkKey(cx, cy) { return `${cx},${cy}`; }
  getChunk(cx, cy, modifications = {}) {
    const key = this.chunkKey(cx, cy);
    const random = seededRandom(hashString(`${this.seed}:${key}`));
    const distance = Math.hypot(cx * CHUNK_SIZE, cy * CHUNK_HEIGHT);
    const biome = BiomeSystem.at(cx * CHUNK_SIZE, cy * CHUNK_HEIGHT);
    const points = [];
    const count = 15 + Math.floor(random() * 9);
    const safeSpawnPoint = (x, y) => BiomeSystem.isSafe(x, y) && !(cx === 0 && cy === 0 && x < 390);
    for (let i = 0; i < count; i += 1) {
      const x = cx * CHUNK_SIZE + 32 + random() * (CHUNK_SIZE - 64);
      const y = cy * CHUNK_HEIGHT + 34 + random() * (CHUNK_HEIGHT - 68);
      if (safeSpawnPoint(x, y) && random() < 0.93) continue;
      if (random() < 0.64) {
        const type = RESOURCE_TYPES[Math.floor(random() * RESOURCE_TYPES.length)];
        if (BiomeSystem.isSafe(x, y) && (type === 'wood' || type === 'stone')) continue;
        points.push({ id: `${key}:r${i}`, kind: 'resource', resource: type, x, y, amount: 1 + Math.floor(random() * 2), collected: Boolean(modifications[`${key}:r${i}`]) });
      } else {
        if (BiomeSystem.isSafe(x, y)) continue;
        const level = BiomeSystem.difficultyAt(x, y);
        const monsterOptions = BIOME_MONSTERS[biome.id] ?? BIOME_MONSTERS.starterForest;
        let monsterId = monsterOptions[Math.floor(random() * monsterOptions.length)];
        if (biome.id === 'starterForest' && random() > 0.7 && distance > 450) monsterId = 'voidSlime';
        const id = `${key}:${monsterId}-${i}`;
        const monster = createMonster(monsterId, id, x, y, level, random);
        if (monster) points.push({ ...monster, kind: 'monster', dead: Boolean(modifications[id]) });
      }
    }
    // Elementos estáticos são reconstruídos pela seed; apenas sua descoberta/uso exigiria persistência.
    const featureCount = 6;
    for (let index = 0; index < featureCount; index += 1) {
      const x = cx * CHUNK_SIZE + 80 + random() * (CHUNK_SIZE - 160);
      const y = cy * CHUNK_HEIGHT + 75 + random() * (CHUNK_HEIGHT - 150);
      const featureRoll = random();
      if (featureRoll < 0.2 && !BiomeSystem.isSafe(x, y)) {
        points.push({ id: `${key}:lake${index}`, kind: 'obstacle', feature: 'lake', x, y, radius: 34 + random() * 20 });
      } else if (featureRoll < 0.28 && !BiomeSystem.isSafe(x, y)) {
        points.push({ id: `${key}:cabin${index}`, kind: 'landmark', feature: 'cabin', x, y });
        points.push({ id: `${key}:fire${index}`, kind: 'landmark', feature: 'campfire', x: x + 34, y: y + 28 });
      }
    }
    if (cx === 0 && cy === 0) {
      points.push({ id: '0,0:safe-zone-boundary', kind: 'landmark', feature: 'safeBoundary', x: 0, y: 0, radius: SAFE_ZONE.radius });
    }
    // Garante uma oportunidade próxima no trecho inicial para validar o loop principal.
    if (distance < 1800 && cx === 0 && cy === 0) {
      points.push({ id: '0,0:town', kind: 'landmark', feature: 'town', x: 0, y: 0 });
      const guaranteed = [
        { id: '0,0:starter-wood', kind: 'resource', resource: 'wood', x: 540, y: 62, amount: 2 },
        { id: '0,0:starter-stone', kind: 'resource', resource: 'stone', x: 565, y: 110, amount: 1 },
        { id: '0,0:starter-branches', kind: 'resource', resource: 'branches', x: 340, y: 34, amount: 2 }
      ];
      for (const item of guaranteed) {
        if (modifications[item.id]) item.collected = true;
        points.push(item);
      }
      if (!modifications['0,0:starter-slime']) {
        const starterSlime = createMonster('slime', '0,0:starter-slime', 590, 36, 1, random);
        points.push({ ...starterSlime, name: 'Slime', kind: 'monster' });
      }
    }
    return { key, cx, cy, biome, points, distance, regenerated: true };
  }
}
