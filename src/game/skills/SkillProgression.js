import { WARRIOR_SKILLS } from './WarriorSkills.js';

export class SkillProgression {
  static catalog(classId) {
    return classId === 'warrior' ? WARRIOR_SKILLS : [];
  }
  static initialize(character) {
    character.skillPoints ??= 0;
    character.skillLevels ??= {};
    for (const skill of SkillProgression.catalog(character.classId)) character.skillLevels[skill.id] ??= 1;
  }
  static rank(character, skillId) {
    SkillProgression.initialize(character);
    return Math.max(1, Math.min(10, character.skillLevels[skillId] ?? 1));
  }
  static upgrade(character, skillId) {
    if (!character || character.status !== 'alive') return false;
    const skill = SkillProgression.catalog(character.classId).find((item) => item.id === skillId);
    if (!skill) return false;
    SkillProgression.initialize(character);
    const rank = character.skillLevels[skillId] ?? 1;
    if (rank >= 10 || character.skillPoints < 1) return false;
    character.skillLevels[skillId] = rank + 1;
    character.skillPoints -= 1;
    return true;
  }
  static effective(character, skill, rankOverride = null) {
    const rank = rankOverride === null ? SkillProgression.rank(character, skill.id) : Math.max(1, Math.min(10, rankOverride));
    const bonusRanks = rank - 1;
    const result = { ...skill, rank };
    result.manaCost = Math.max(4, skill.manaCost - Math.floor(bonusRanks / 3));
    if (skill.id === 'warriorWhirlwind') result.multiplier = skill.multiplier + bonusRanks * 0.12;
    if (skill.id === 'warriorWarCry') result.healRatio = Math.min(0.4, skill.healRatio + bonusRanks * 0.02);
    if (skill.id === 'warriorIronWill') result.defenseRatio = skill.defenseRatio + bonusRanks * 0.02;
    if (skill.id === 'warriorChains') result.radius = skill.radius + bonusRanks * 12;
    result.cooldown = Math.max(4000, Math.round(skill.cooldown * (1 - bonusRanks * 0.025)));
    return result;
  }
}
