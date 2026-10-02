export const EQUIPMENT_SLOTS = [
  { id: 'mainHand', name: 'Arma principal', icon: '⚔' },
  { id: 'offHand', name: 'Arma secundária', icon: '🛡' },
  { id: 'head', name: 'Capacete', icon: '⛑' },
  { id: 'chest', name: 'Armadura', icon: '♧' },
  { id: 'cape', name: 'Capa', icon: '◈' },
  { id: 'ring1', name: 'Anel I', icon: '◉' },
  { id: 'ring2', name: 'Anel II', icon: '◉' },
  { id: 'necklace', name: 'Colar', icon: '◇' },
  { id: 'boots', name: 'Botas', icon: '⌑' },
  { id: 'gloves', name: 'Luvas', icon: '♧' }
];

export class EquipmentSystem {
  static initialize(character) {
    character.equipment ??= {};
    if (character.equippedWeaponId && !character.equipment.mainHand) character.equipment.mainHand = character.equippedWeaponId;
  }
  static equip(character, itemId) {
    if (!character || character.status !== 'alive') return false;
    const item = character.weapons.find((entry) => entry.id === itemId);
    if (!item) return false;
    const slot = item.slot ?? 'mainHand';
    EquipmentSystem.initialize(character);
    character.equipment[slot] = item.id;
    if (slot === 'mainHand') character.equippedWeaponId = item.id;
    return true;
  }
  static unequip(character, slot) {
    if (!character || character.status !== 'alive') return false;
    EquipmentSystem.initialize(character);
    const itemId = character.equipment[slot];
    if (!itemId) return false;
    delete character.equipment[slot];
    if (slot === 'mainHand') character.equippedWeaponId = null;
    return true;
  }
  static compare(character, candidate, slot = candidate?.slot ?? 'mainHand') {
    EquipmentSystem.initialize(character);
    const current = character.weapons.find((weapon) => weapon.id === character.equipment[slot]);
    const stats = new Set([...(current?.affixes ?? []).map((affix) => affix.stat), ...(candidate?.affixes ?? []).map((affix) => affix.stat)]);
    const differences = [...stats].map((stat) => {
      const oldValue = current?.affixes?.filter((affix) => affix.stat === stat).reduce((sum, affix) => sum + affix.value, 0) ?? 0;
      const newValue = candidate?.affixes?.filter((affix) => affix.stat === stat).reduce((sum, affix) => sum + affix.value, 0) ?? 0;
      return { stat, current: oldValue, candidate: newValue, delta: newValue - oldValue };
    });
    const damageCurrent = current?.damage ?? 0;
    const damageCandidate = candidate?.damage ?? 0;
    return { slot, current, candidate, damageCurrent, damageCandidate, damageDelta: damageCandidate - damageCurrent, differences };
  }
  static salvage(character, itemIds = [], resourceIds = []) {
    if (!character || character.status !== 'alive') return { removed: 0, fragments: 0 };
    EquipmentSystem.initialize(character);
    let removed = 0;
    let fragments = 0;
    for (const itemId of new Set(itemIds)) {
      const index = character.weapons.findIndex((item) => item.id === itemId);
      if (index < 0) continue;
      const [item] = character.weapons.splice(index, 1);
      const slot = item.slot ?? 'mainHand';
      if (character.equipment[slot] === item.id) delete character.equipment[slot];
      if (character.equippedWeaponId === item.id) character.equippedWeaponId = null;
      const qualityBonus = item.quality === 'Perfeita' ? 8 : item.quality === 'Rara' ? 4 : item.quality === 'Aprimorada' ? 2 : 0;
      fragments += 2 + (item.affixes?.length ?? 0) * 2 + qualityBonus;
      removed += 1;
    }
    for (const resourceId of new Set(resourceIds)) {
      const amount = character.resources[resourceId] ?? 0;
      if (amount < 1 || resourceId === 'arcaneFragments') continue;
      fragments += amount;
      character.resources[resourceId] = 0;
      removed += amount;
    }
    character.resources.arcaneFragments = (character.resources.arcaneFragments ?? 0) + fragments;
    return { removed, fragments };
  }
}
