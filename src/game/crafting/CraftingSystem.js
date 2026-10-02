import { Inventory } from '../inventory/Inventory.js';
import { CLASS_CATALOG } from '../classes/classCatalog.js';

export const RECIPES = {
  ironGreatsword: {
    id: 'ironGreatsword', name: 'Espadão de Ferro', allowedClasses: ['warrior'], materials: { wood: 24, stone: 30, branches: 18 }, damage: 10,
    kind: 'ironGreatsword', color: 0xb9c8ce, particleColor: 0xe3f2fa
  },
  slimeGreatsword: {
    id: 'slimeGreatsword', name: 'Espada grande de Slime', allowedClasses: ['warrior'], materials: { slimeGel: 12, wood: 14, branches: 8 }, damage: 7,
    kind: 'slimeGreatsword', color: 0x63da70, particleColor: 0xc8ff86
  },
  voidGreatsword: {
    id: 'voidGreatsword', name: 'Espadão do Slime Violeta', allowedClasses: ['warrior'], materials: { voidGel: 16, wood: 18, branches: 10 }, damage: 15,
    kind: 'voidGreatsword', color: 0xa958ed, particleColor: 0xe29bff
  },
  goblinDagger: {
    id: 'goblinDagger', name: 'Adaga do Saqueador', allowedClasses: ['archer', 'mage'], materials: { goblinScrap: 18, wood: 8 }, damage: 12,
    kind: 'goblinDagger', color: 0xabc767, particleColor: 0xd8ee85
  },
  orcCleave: {
    id: 'orcCleave', name: 'Lâmina do Guardião Orc', allowedClasses: ['warrior'], materials: { orcHide: 18, orcIron: 15, wood: 12 }, damage: 23,
    kind: 'orcCleave', color: 0x9eb269, particleColor: 0xc6e87b
  },
  wraithStaff: {
    id: 'wraithStaff', name: 'Cajado da Bruma', allowedClasses: ['mage'], materials: { wraithEssence: 18, voidGel: 6, branches: 10 }, damage: 21,
    kind: 'wraithStaff', color: 0x69c9bd, particleColor: 0xa8fff0
  },
  batWingBow: {
    id: 'batWingBow', name: 'Arco das Asas da Cripta', allowedClasses: ['archer'], materials: { batWing: 24, batFang: 12, branches: 16 }, damage: 24,
    kind: 'batWingBow', color: 0x9a82d2, particleColor: 0xd0b9ff
  },
  vesperScepter: {
    id: 'vesperScepter', name: 'Cetro de Vesper', allowedClasses: ['mage'], materials: { batWing: 30, batFang: 18, arcaneFragments: 12 }, damage: 30,
    kind: 'vesperScepter', color: 0xd087ee, particleColor: 0xffc7f7
  }
};

const AFFIX_POOL = [
  { id: 'keen', name: 'Afiada', stat: 'criticalChance', min: 2, max: 8, unit: '%' },
  { id: 'brutal', name: 'Brutal', stat: 'criticalDamage', min: 8, max: 25, unit: '%' },
  { id: 'arcane', name: 'Arcana', stat: 'magicDamage', min: 3, max: 12, unit: '%' },
  { id: 'precise', name: 'Precisa', stat: 'accuracy', min: 2, max: 9, unit: '%' },
  { id: 'swift', name: 'Veloz', stat: 'attackSpeed', min: 2, max: 7, unit: '%' },
  { id: 'piercing', name: 'Perfurante', stat: 'armorPenetration', min: 1, max: 5, unit: '' },
  { id: 'vampiric', name: 'Sedenta', stat: 'lifeSteal', min: 1, max: 4, unit: '%' },
  { id: 'warded', name: 'Protetora', stat: 'magicDefense', min: 1, max: 5, unit: '' },
  { id: 'vital', name: 'Vital', stat: 'maxLife', min: 4, max: 12, unit: '%' },
  { id: 'charged', name: 'Energizada', stat: 'maxMana', min: 4, max: 15, unit: '%' },
  { id: 'evasive', name: 'Ligeira', stat: 'evasion', min: 1, max: 6, unit: '%' },
  { id: 'armored', name: 'Blindada', stat: 'physicalDefense', min: 1, max: 5, unit: '' },
  { id: 'flowing', name: 'Fluida', stat: 'manaRegeneration', min: 5, max: 25, unit: '%' }
];

export function rollAffixes(classId, random = Math.random) {
  const count = random() < 0.12 ? 3 : random() < 0.52 ? 2 : random() < 0.82 ? 1 : 0;
  const pool = [...AFFIX_POOL].filter((affix) => classId !== 'mage' || affix.stat !== 'criticalChance');
  const affixes = [];
  while (affixes.length < count && pool.length) {
    const index = Math.floor(random() * pool.length);
    const affix = pool.splice(index, 1)[0];
    const value = affix.min + Math.floor(random() * (affix.max - affix.min + 1));
    affixes.push({ ...affix, value });
  }
  return affixes;
}

export class CraftingSystem {
  static canCraft(character, recipeId) {
    const recipe = RECIPES[recipeId];
    return Boolean(recipe && (!recipe.allowedClasses || recipe.allowedClasses.includes(character.classId)) && Object.entries(recipe.materials).every(([id, amount]) => (character.resources[id] ?? 0) >= amount));
  }
  static craft(character, recipeId, random = Math.random) {
    const recipe = RECIPES[recipeId];
    if (!recipe || !CraftingSystem.canCraft(character, recipeId) || character.status !== 'alive') return null;
    const inventory = new Inventory(character);
    for (const [id, amount] of Object.entries(recipe.materials)) inventory.consume(id, amount);
    const affixes = rollAffixes(character.classId, random);
    const qualityRoll = random();
    const quality = qualityRoll > 0.94 ? 'Perfeita' : qualityRoll > 0.7 ? 'Rara' : qualityRoll > 0.35 ? 'Aprimorada' : 'Comum';
    const qualityMultiplier = quality === 'Perfeita' ? 1.5 : quality === 'Rara' ? 1.25 : quality === 'Aprimorada' ? 1.1 : 1;
    const weapon = { id: `weapon-${Date.now()}-${Math.floor(random() * 1e9).toString(36)}`, ...recipe, name: `${affixes[0]?.name ? `${affixes[0].name} ` : ''}${recipe.name}`, damage: Math.round(recipe.damage * qualityMultiplier), quality, affixes, classWeapon: CLASS_CATALOG[character.classId].weaponKind, createdAt: Date.now() };
    character.weapons.push(weapon);
    character.equippedWeaponId = weapon.id;
    character.equipment ??= {};
    character.equipment.mainHand = weapon.id;
    return weapon;
  }
}
