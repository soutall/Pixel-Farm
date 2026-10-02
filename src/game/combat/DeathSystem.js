export class DeathSystem {
  static respawnInTown(character, cause, now = Date.now()) {
    if (!character || !['alive', 'dead'].includes(character.status)) return null;
    const record = { characterId: character.id, name: character.name, classId: character.classId, cause, position: { ...character.position }, level: character.level, diedAt: now, respawnedAt: now };
    character.deathHistory ??= [];
    character.deathHistory.push(record);
    character.position = { x: 0, y: 0 };
    character.status = 'alive';
    character.endedAt = null;
    character.currentLife = 80 + character.attributes.life * 10;
    character.currentMana = 35 + character.attributes.intelligence * 12;
    character.autoEnabled = true;
    character.respawns = (character.respawns ?? 0) + 1;
    return record;
  }
  static kill(character, cause, now = Date.now()) {
    return DeathSystem.respawnInTown(character, cause, now);
  }
}
