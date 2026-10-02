import { StatsSystem } from '../stats/StatsSystem.js';
import { BiomeSystem } from '../world/BiomeSystem.js';

export class DamageSystem {
  static basicAttack(character, target, random = Math.random) {
    const stats = StatsSystem.derived(character);
    const hit = random() * 100 <= stats.accuracy;
    const critical = hit && random() * 100 < stats.criticalChance;
    const attackPower = character.classId === 'mage' ? stats.magicPower * (1 + stats.magicDamage / 100) : stats.damage;
    const baseDamage = hit ? Math.max(1, Math.round(attackPower * (0.82 + random() * 0.36))) : 0;
    const damage = critical ? Math.round(baseDamage * stats.criticalDamage / 100) : baseDamage;
    if (hit && stats.lifeSteal) character.currentLife = Math.min(stats.maxLife, (character.currentLife ?? stats.maxLife) + Math.max(1, Math.round(damage * stats.lifeSteal / 100)));
    return { hit, critical, damage };
  }
  static physicalDamage(character, baseDamage, random = Math.random, now = Date.now()) {
    if (BiomeSystem.isSafe(character.position.x, character.position.y)) return { dodged: true, safeZone: true, damage: 0 };
    const stats = StatsSystem.derived(character);
    if (random() * 100 < stats.evasion) return { dodged: true, damage: 0 };
    const buff = now < (character.buffs?.defenseUntil ?? 0) ? character.buffs.defenseMultiplier ?? 1 : 1;
    const damage = Math.max(1, baseDamage - Math.floor(stats.physicalDefense * buff * 0.35));
    return { dodged: false, damage };
  }
  static magicalDamage(character, baseDamage) {
    if (BiomeSystem.isSafe(character.position.x, character.position.y)) return { dodged: true, safeZone: true, damage: 0 };
    const stats = StatsSystem.derived(character);
    return { damage: Math.max(1, Math.round(baseDamage / (1 + stats.magicDefense * 0.06))) };
  }
}
