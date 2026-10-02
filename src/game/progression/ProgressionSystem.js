export class ProgressionSystem {
  static grantXp(character, amount) {
    if (character.status !== 'alive') return [];
    character.xp += amount;
    const levels = [];
    while (character.xp >= character.xpToNext) {
      character.xp -= character.xpToNext;
      character.level += 1;
      character.unspentPoints += 3;
      character.skillPoints = (character.skillPoints ?? 0) + 1;
      character.xpToNext = Math.floor(30 * Math.pow(character.level, 1.35));
      levels.push(character.level);
    }
    return levels;
  }
}
