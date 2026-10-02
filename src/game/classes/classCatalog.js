export const CLASS_CATALOG = {
  warrior: {
    id: 'warrior', name: 'Guerreiro', icon: '⚔', weapon: 'Espada grande', weaponKind: 'greatsword',
    color: 0xb4d77b, baseStats: { strength: 5, agility: 2, dexterity: 2, intelligence: 1, life: 12 },
    skills: ['Ciclone de Aço', 'Grito de Desafio', 'Postura de Ferro', 'Correntes da Ruína'], passive: 'Determinação'
  },
  mage: {
    id: 'mage', name: 'Mago', icon: '✧', weapon: 'Cajado', weaponKind: 'staff',
    color: 0x91b9ff, baseStats: { strength: 1, agility: 2, dexterity: 3, intelligence: 6, life: 8 },
    skills: ['Orbe arcano', 'Explosão rúnica', 'Lança de gelo', 'Nova astral'], passive: 'Fluxo arcano'
  },
  archer: {
    id: 'archer', name: 'Arqueiro', icon: '⌖', weapon: 'Arco', weaponKind: 'bow',
    color: 0xe3c276, baseStats: { strength: 2, agility: 5, dexterity: 5, intelligence: 1, life: 9 },
    skills: ['Tiro certeiro', 'Rajada', 'Flecha perfurante', 'Chuva de flechas'], passive: 'Olho de falcão'
  }
};

export function createCharacter(name, classId, seed, now = Date.now()) {
  const classData = CLASS_CATALOG[classId] ?? CLASS_CATALOG.warrior;
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `hero-${now}-${Math.floor(Math.random() * 1e6)}`,
    name: String(name || 'Viajante').trim().slice(0, 18) || 'Viajante', classId: classData.id,
    status: 'alive', createdAt: now, endedAt: null, deathHistory: [], seed,
    position: { x: 0, y: 0 }, level: 1, xp: 0, xpToNext: 30, unspentPoints: 0,
    currentLife: 80 + classData.baseStats.life * 10,
    currentMana: 35 + classData.baseStats.intelligence * 12,
    skillPoints: 0, skillLevels: {}, skillCooldowns: {}, potionCooldowns: { hp: 0, mana: 0 }, autoEnabled: true,
    autoPotion: { hpEnabled: true, manaEnabled: true, hpThreshold: 60, manaThreshold: 35 },
    attributes: { ...classData.baseStats, physicalDefense: 1, magicDefense: 1, accuracy: 78, evasion: 4 },
    resources: { wood: 0, stone: 0, branches: 0, slimeGel: 0, voidGel: 0, goblinScrap: 0, orcHide: 0, orcIron: 0, wraithEssence: 0, batWing: 0, batFang: 0, arcaneFragments: 0 },
    weapons: [], equipment: {}, equippedWeaponId: null, exploredChunks: ['0,0'], dungeonCompletions: 0,
    defeatedSlimes: 0, modifications: {}
  };
}
