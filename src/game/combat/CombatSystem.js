import { DamageSystem } from './DamageSystem.js';
import { SkillSystem } from './SkillSystem.js';
import { CLASS_CATALOG } from '../classes/classCatalog.js';
import { StatsSystem } from '../stats/StatsSystem.js';
import { WARRIOR_SKILLS } from '../skills/WarriorSkills.js';
import { SkillProgression } from '../skills/SkillProgression.js';
import { BiomeSystem } from '../world/BiomeSystem.js';

export class CombatSystem {
  constructor() { this.skills = new SkillSystem(); }
  attack(character, target, enemies = [target], now = Date.now()) {
    if (typeof enemies === 'number') { now = enemies; enemies = [target]; }
    if (!Array.isArray(enemies)) enemies = [target];
    if (BiomeSystem.isSafe(character.position.x, character.position.y)) return { hit: false, damage: 0, critical: false, skill: null, skillId: null, hits: [], defeated: false, safeZone: true };
    if (character.classId === 'warrior') {
      const effectiveSkills = WARRIOR_SKILLS.map((skill) => SkillProgression.effective(character, skill));
      const skill = this.skills.nextReady('warrior', effectiveSkills.filter((entry) => (character.currentMana ?? 0) >= entry.manaCost), now);
      if (skill) return this.useWarriorSkill(character, target, enemies, skill, now);
    }
    const result = DamageSystem.basicAttack(character, target);
    target.hp -= result.damage;
    return { ...result, skill: null, skillId: null, hits: result.hit ? [{ target, damage: result.damage }] : [], defeated: target.hp <= 0 };
  }
  getSkillStates(character, now = Date.now()) {
    return SkillProgression.catalog(character.classId).map((skill) => {
      const rank = SkillProgression.rank(character, skill.id);
      const effective = SkillProgression.effective(character, skill);
      const individualRemaining = Math.max(0, (this.skills.cooldowns.get(skill.id) ?? 0) - now);
      return { ...effective, remaining: individualRemaining, readyAt: this.skills.cooldowns.get(skill.id) ?? 0, availableMana: character.currentMana ?? 0, canAfford: (character.currentMana ?? 0) >= effective.manaCost };
    });
  }
  useWarriorSkill(character, target, enemies, skill, now) {
    this.skills.use(skill.id, now, skill.cooldown);
    character.currentMana = Math.max(0, (character.currentMana ?? 0) - skill.manaCost);
    const stats = StatsSystem.derived(character);
    const nearby = enemies.filter((enemy) => !enemy.dead && enemy.hp > 0);
    const hits = [];
    let healed = 0;
    if (skill.kind === 'areaDamage') {
      for (const enemy of nearby) {
        if (Math.hypot(enemy.x - character.position.x, enemy.y - character.position.y) > skill.radius) continue;
        const damage = Math.max(1, Math.round(stats.damage * skill.multiplier));
        enemy.hp -= damage;
        hits.push({ target: enemy, damage });
      }
    } else if (skill.kind === 'healTaunt') {
      const maxLife = stats.maxLife;
      const oldLife = character.currentLife ?? maxLife;
      character.currentLife = Math.min(maxLife, oldLife + Math.round(maxLife * skill.healRatio));
      healed = character.currentLife - oldLife;
      for (const enemy of nearby) {
        if (Math.hypot(enemy.x - character.position.x, enemy.y - character.position.y) <= skill.tauntRadius) enemy.tauntUntil = now + skill.tauntDuration;
      }
    } else if (skill.kind === 'defenseBuff') {
      character.buffs ??= {};
      character.buffs.defenseMultiplier = 1 + skill.defenseRatio;
      character.buffs.defenseUntil = now + skill.duration;
    } else if (skill.kind === 'chainPull') {
      for (const enemy of nearby) {
        const dx = character.position.x - enemy.x;
        const dy = character.position.y - enemy.y;
        const distance = Math.hypot(dx, dy);
        if (distance > skill.radius || distance === 0) continue;
        const destinationDistance = Math.min(skill.pullDistance, distance);
        const fromX = enemy.x;
        const fromY = enemy.y;
        enemy.x += dx / distance * destinationDistance;
        enemy.y += dy / distance * destinationDistance;
        enemy.tauntUntil = now + skill.tauntDuration;
        hits.push({ target: enemy, pulled: true, fromX, fromY });
      }
    }
    return {
      hit: hits.length > 0 || ['healTaunt', 'defenseBuff'].includes(skill.kind),
      damage: hits[0]?.damage ?? 0,
      skill: skill.name,
      skillId: skill.id,
      skillData: skill,
      healed,
      hits,
      defeated: target.hp <= 0
    };
  }
}
