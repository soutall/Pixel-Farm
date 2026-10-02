export const BIOMES = [
  { id: 'starterForest', name: 'Floresta Inicial', zone: 'O BOSQUE SEM NOME', minDistance: 0, minLevel: 1, maxLevel: 15, tint: 0x425c3e },
  { id: 'orcMarches', name: 'Marchas dos Orcs', zone: 'FRONTEIRA DOS ORCS', minDistance: 2400, minLevel: 15, maxLevel: 20, tint: 0x56603b },
  { id: 'hauntedMarsh', name: 'Pântano Espectral', zone: 'BREJO DAS BRUMAS', minDistance: 5600, minLevel: 20, maxLevel: 30, tint: 0x465746 }
];

export const SAFE_ZONE = { id: 'centralTown', name: 'Cidade do Centro', radius: 520 };

export class BiomeSystem {
  static isSafe(x, y) { return Math.hypot(x, y) <= SAFE_ZONE.radius; }
  static clockAt(serverTime, dayLength) {
    const cycle = Math.max(1, dayLength ?? 20 * 60 * 1000);
    const phase = ((serverTime % cycle) + cycle) % cycle / cycle;
    const minuteOfDay = Math.floor(phase * 24 * 60) % (24 * 60);
    const hour = Math.floor(minuteOfDay / 60);
    return { phase, hour, minute: minuteOfDay % 60, isNight: hour >= 20 || hour < 6, isMonsterSurge: hour < 4 };
  }
  static monsterModifiers(clock) {
    return clock?.isMonsterSurge ? { attack: 1.4, speed: 1.3, aggro: 1.25, attackRate: 1.25 } : { attack: 1, speed: 1, aggro: 1, attackRate: 1 };
  }
  static at(x, y) {
    const distance = Math.hypot(x, y);
    return [...BIOMES].reverse().find((biome) => distance >= biome.minDistance) ?? BIOMES[0];
  }
  static difficultyAt(x, y) {
    const biome = BiomeSystem.at(x, y);
    const distance = Math.hypot(x, y);
    if (biome.id === 'starterForest') return Math.max(1, Math.min(15, 1 + Math.floor(distance / 100)));
    if (biome.id === 'orcMarches') return Math.max(15, Math.min(20, 15 + Math.floor((distance - biome.minDistance) / 320)));
    if (biome.id === 'hauntedMarsh') return Math.max(20, Math.min(30, 20 + Math.floor((distance - biome.minDistance) / 220)));
    return Math.max(biome.minLevel, Math.min(biome.maxLevel, biome.minLevel + Math.floor((distance - biome.minDistance) / 220)));
  }
}
