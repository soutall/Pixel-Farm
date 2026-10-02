export class SkillSystem {
  constructor() { this.cooldowns = new Map(); this.cursors = new Map(); }
  canUse(skillId, now) { return now >= (this.cooldowns.get(skillId) ?? 0); }
  use(skillId, now, cooldown = 6200) {
    if (!this.canUse(skillId, now)) return false;
    this.cooldowns.set(skillId, now + cooldown);
    return true;
  }
  cooldownRemaining(skillId, now) { return Math.max(0, (this.cooldowns.get(skillId) ?? 0) - now); }
  nextReady(classId, skills, now) {
    if (!skills.length) return null;
    const start = this.cursors.get(classId) ?? 0;
    for (let offset = 0; offset < skills.length; offset += 1) {
      const index = (start + offset) % skills.length;
      const skill = skills[index];
      if (!this.canUse(skill.id, now)) continue;
      this.cursors.set(classId, (index + 1) % skills.length);
      return skill;
    }
    return null;
  }
}
