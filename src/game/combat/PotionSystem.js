import { StatsSystem } from '../stats/StatsSystem.js';

const POTIONS = {
  hp: { current: 'currentLife', maximum: 'maxLife', ratio: 0.4, label: 'vida' },
  mana: { current: 'currentMana', maximum: 'maxMana', ratio: 0.5, label: 'mana' }
};

export class PotionSystem {
  static use(character, kind, now) {
    const potion = POTIONS[kind];
    if (!character || character.status !== 'alive' || !potion) return null;
    character.potionCooldowns ??= { hp: 0, mana: 0 };
    if (now < (character.potionCooldowns[kind] ?? 0)) return null;
    const stats = StatsSystem.derived(character);
    const maximum = stats[potion.maximum];
    const current = character[potion.current] ?? maximum;
    if (current >= maximum) return null;
    const before = current;
    character[potion.current] = Math.min(maximum, current + Math.ceil(maximum * potion.ratio));
    character.potionCooldowns[kind] = now + 5000;
    return { kind, restored: Math.round(character[potion.current] - before), cooldownUntil: character.potionCooldowns[kind], label: potion.label };
  }
}
