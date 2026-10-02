const PRIMARY = new Set(['strength', 'agility', 'dexterity', 'intelligence', 'life']);

export class StatsSystem {
  static allocate(character, attribute) {
    if (!PRIMARY.has(attribute) || character.unspentPoints < 1 || character.status !== 'alive') return false;
    const oldMaxLife = StatsSystem.derived(character).maxLife;
    character.attributes[attribute] = (character.attributes[attribute] ?? 0) + 1;
    if (attribute === 'life' && Number.isFinite(character.currentLife)) {
      character.currentLife = Math.min(oldMaxLife + 10, character.currentLife + 10);
    }
    if (attribute === 'intelligence' && Number.isFinite(character.currentMana)) {
      character.currentMana = Math.min(StatsSystem.derived(character).maxMana, character.currentMana + 12);
    }
    character.unspentPoints -= 1;
    return true;
  }

  static derived(character) {
    const a = character.attributes;
    character.equipment ??= {};
    const weapon = character.weapons.find((item) => item.id === (character.equipment.mainHand ?? character.equippedWeaponId));
    const weaponBonus = weapon?.damage ?? 0;
    const equippedItems = [...new Set(Object.values(character.equipment))].map((id) => character.weapons.find((item) => item.id === id)).filter(Boolean);
    if (weapon && !equippedItems.includes(weapon)) equippedItems.push(weapon);
    const affixes = Object.fromEntries(equippedItems.flatMap((item) => item.affixes ?? []).reduce((totals, affix) => totals.set(affix.stat, (totals.get(affix.stat) ?? 0) + affix.value), new Map()));
    return {
      maxLife: Math.floor((80 + a.life * 10) * (1 + (affixes.maxLife ?? 0) / 100)),
      maxMana: Math.floor((35 + a.intelligence * 12) * (1 + (affixes.maxMana ?? 0) / 100)),
      physicalDefense: Math.floor(a.strength * 0.6 + a.agility * 0.2 + (affixes.physicalDefense ?? 0)),
      magicDefense: Math.floor(a.intelligence * 0.7 + a.life * 0.15 + (affixes.magicDefense ?? 0)),
      accuracy: Math.min(99, 70 + a.dexterity * 2 + (affixes.accuracy ?? 0)),
      evasion: Math.min(45, Math.floor(a.agility * 1.5 + (affixes.evasion ?? 0))),
      criticalChance: Math.min(75, 5 + a.dexterity * 0.5 + (affixes.criticalChance ?? 0)),
      criticalDamage: 150 + (affixes.criticalDamage ?? 0),
      magicDamage: affixes.magicDamage ?? 0,
      attackSpeed: affixes.attackSpeed ?? 0,
      armorPenetration: affixes.armorPenetration ?? 0,
      lifeSteal: affixes.lifeSteal ?? 0,
      manaRegeneration: 1.5 * (1 + (affixes.manaRegeneration ?? 0) / 100),
      damage: 5 + a.strength * 1.5 + a.dexterity * 0.35 + weaponBonus,
      magicPower: 4 + a.intelligence * 1.8 + a.dexterity * 0.25 + weaponBonus
    };
  }
}
