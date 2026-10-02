export const RESOURCE_CATALOG = {
  wood: { name: 'Madeira', icon: '▰' },
  stone: { name: 'Pedra', icon: '⬟' },
  branches: { name: 'Galhos', icon: '⌁' },
  slimeGel: { name: 'Slime Gel', icon: '●' },
  voidGel: { name: 'Gel Violeta', icon: '✺' },
  goblinScrap: { name: 'Sucata Goblin', icon: '⚙' },
  orcHide: { name: 'Couro de Orc', icon: '▧' },
  orcIron: { name: 'Ferro Orc', icon: '⬢' },
  wraithEssence: { name: 'Essência Espectral', icon: '◌' },
  batWing: { name: 'Asa de Morcego', icon: '♧' },
  batFang: { name: 'Presa de Morcego', icon: '牙' },
  arcaneFragments: { name: 'Fragmentos Arcanos', icon: '✦' }
};

export class Inventory {
  constructor(character) { this.character = character; }
  add(resourceId, amount = 1) {
    if (!(resourceId in RESOURCE_CATALOG) || amount < 1) return false;
    this.character.resources[resourceId] = (this.character.resources[resourceId] ?? 0) + amount;
    return true;
  }
  has(resourceId, amount = 1) { return (this.character.resources[resourceId] ?? 0) >= amount; }
  consume(resourceId, amount = 1) {
    if (!this.has(resourceId, amount)) return false;
    this.character.resources[resourceId] -= amount;
    return true;
  }
}
