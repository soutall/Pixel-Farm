export const MONSTERS = {
  slime: { id: 'slime', name: 'Slime', biome: 'starterForest', minLevel: 1, maxLevel: 15, color: 0x78b96a, hp: 22, attack: 6, range: 48, speed: 34, aggro: 210, leash: 470, drops: { slimeGel: [2, 4] } },
  voidSlime: { id: 'voidSlime', name: 'Slime Violeta', biome: 'starterForest', minLevel: 5, maxLevel: 15, color: 0xa958ed, hp: 38, attack: 10, range: 220, speed: 26, aggro: 260, leash: 500, drops: { voidGel: [2, 4] } },
  goblin: { id: 'goblin', name: 'Goblin Saqueador', biome: 'orcMarches', minLevel: 15, maxLevel: 18, color: 0x8ba850, hp: 92, attack: 17, range: 48, speed: 58, aggro: 270, leash: 540, drops: { goblinScrap: [3, 6], wood: [1, 3] } },
  orc: { id: 'orc', name: 'Orc Guardião', biome: 'orcMarches', minLevel: 17, maxLevel: 20, color: 0x657f43, hp: 160, attack: 25, range: 54, speed: 38, aggro: 300, leash: 590, drops: { orcHide: [3, 6], orcIron: [2, 5] } },
  wraith: { id: 'wraith', name: 'Espectro Errante', biome: 'hauntedMarsh', minLevel: 20, maxLevel: 25, color: 0x64a7a0, hp: 230, attack: 30, range: 190, speed: 36, aggro: 310, leash: 630, drops: { wraithEssence: [3, 6] } },
  direBat: { id: 'direBat', name: 'Morcego da Cripta', biome: 'crypt', minLevel: 18, maxLevel: 22, color: 0x7867a8, hp: 44, attack: 14, range: 180, speed: 60, aggro: 300, leash: 520, drops: { batWing: [2, 4], batFang: [1, 2] } },
  batOverlord: { id: 'batOverlord', name: 'Vesper, Senhor da Cripta', biome: 'crypt', minLevel: 22, maxLevel: 24, color: 0xc17aeb, hp: 620, attack: 44, range: 210, speed: 48, aggro: 450, leash: 700, drops: { batWing: [12, 20], batFang: [8, 12], arcaneFragments: [4, 8] }, elite: true }
};

export const BIOME_MONSTERS = {
  starterForest: ['slime', 'voidSlime'],
  orcMarches: ['goblin', 'orc'],
  hauntedMarsh: ['wraith'],
  crypt: ['direBat', 'batOverlord']
};

export function createMonster(monsterId, id, x, y, level, random = Math.random) {
  const definition = MONSTERS[monsterId];
  if (!definition) return null;
  const scaledLevel = Math.max(definition.minLevel, Math.min(definition.maxLevel, level ?? definition.minLevel));
  const scale = 1 + Math.max(0, scaledLevel - definition.minLevel) * 0.13;
  return {
    id, kind: 'monster', variant: monsterId, monsterId, biomeId: definition.biome, name: definition.name, x, y,
    level: scaledLevel, hp: Math.round(definition.hp * scale), maxHp: Math.round(definition.hp * scale),
    attackDamage: Math.round(definition.attack * scale), attackRange: definition.range,
    speed: definition.speed, aggroRange: definition.aggro, leashDistance: definition.leash,
    drops: structuredClone(definition.drops), dead: false, elite: Boolean(definition.elite),
    attackStyle: definition.range > 65 ? 'ranged' : 'melee', randomSeed: Math.floor(random() * 0xffffffff)
  };
}
