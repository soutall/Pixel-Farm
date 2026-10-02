import { createCharacter } from '../classes/classCatalog.js';

const DEFAULT_AUTO_POTION = { hpEnabled: true, manaEnabled: true, hpThreshold: 60, manaThreshold: 35 };
const DEFAULT_RESOURCES = { wood: 0, stone: 0, branches: 0, slimeGel: 0, voidGel: 0, goblinScrap: 0, orcHide: 0, orcIron: 0, wraithEssence: 0, batWing: 0, batFang: 0, arcaneFragments: 0 };

export function normalizeProfile(profile, fallbackSeed = createSeed()) {
  if (!profile || typeof profile !== 'object') {
    return { seed: fallbackSeed, character: null, history: [] };
  }

  const safeProfile = {
    ...profile,
    seed: String(profile.seed || fallbackSeed),
    history: Array.isArray(profile.history) ? profile.history : [],
    character: profile.character && typeof profile.character === 'object' ? { ...profile.character } : null
  };

  if (!safeProfile.character) return safeProfile;

  const character = safeProfile.character;
  const classId = typeof character.classId === 'string' && character.classId ? character.classId : 'warrior';
  const baseCharacter = createCharacter(character.name || 'Viajante', classId, safeProfile.seed, character.createdAt ?? Date.now());

  const mergedCharacter = {
    ...baseCharacter,
    ...character,
    id: character.id ?? baseCharacter.id,
    name: String(character.name || baseCharacter.name).trim().slice(0, 18) || 'Viajante',
    classId,
    status: character.status === 'dead' ? 'dead' : 'alive',
    position: { x: Number.isFinite(character.position?.x) ? Number(character.position.x) : 0, y: Number.isFinite(character.position?.y) ? Number(character.position.y) : 0 },
    resources: { ...DEFAULT_RESOURCES, ...(character.resources ?? {}) },
    autoEnabled: character.autoEnabled ?? true,
    autoPotion: { ...DEFAULT_AUTO_POTION, ...(character.autoPotion ?? {}) },
    exploredChunks: Array.isArray(character.exploredChunks) ? character.exploredChunks : ['0,0'],
    attributes: { ...baseCharacter.attributes, ...(character.attributes ?? {}) },
    skillLevels: character.skillLevels ?? {},
    potionCooldowns: character.potionCooldowns ?? { hp: 0, mana: 0 },
    weaponCooldowns: character.weaponCooldowns ?? {},
    equipment: character.equipment ?? {},
    weapons: Array.isArray(character.weapons) ? character.weapons : [],
    history: character.history ?? [],
    deathHistory: Array.isArray(character.deathHistory) ? character.deathHistory : [],
    modifications: character.modifications ?? {},
    dungeonCompletions: character.dungeonCompletions ?? 0,
    defeatedSlimes: character.defeatedSlimes ?? 0
  };

  if (mergedCharacter.position.x === null || Number.isNaN(mergedCharacter.position.x)) mergedCharacter.position.x = 0;
  if (mergedCharacter.position.y === null || Number.isNaN(mergedCharacter.position.y)) mergedCharacter.position.y = 0;

  safeProfile.character = mergedCharacter;
  return safeProfile;
}

function createSeed() {
  const bytes = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(bytes);
  return `${Date.now().toString(36)}-${(bytes[0] ?? Math.floor(Math.random() * 0xffffffff)).toString(36)}`;
}
