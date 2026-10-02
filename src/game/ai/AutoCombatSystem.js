import { TargetingSystem } from '../combat/TargetingSystem.js';

export class AutoCombatSystem {
  chooseTarget(position, enemies) { return TargetingSystem.nearest(position, enemies, 330); }
  chooseResource(position, resources) { return TargetingSystem.nearest(position, resources, 190); }
  movementTarget(position, enemies, resources, now = Date.now()) {
    const aggressor = TargetingSystem.nearest(position, enemies.filter((enemy) => enemy.aggroUntil > now || Math.hypot(enemy.x - position.x, enemy.y - position.y) <= (enemy.aggroRange ?? 210)));
    if (aggressor) return aggressor;
    const enemy = this.chooseTarget(position, enemies);
    const resource = this.chooseResource(position, resources);
    if (!enemy) return resource;
    if (!resource) return enemy;
    const enemyDistance = Math.hypot(enemy.x - position.x, enemy.y - position.y);
    const resourceDistance = Math.hypot(resource.x - position.x, resource.y - position.y);
    if (enemyDistance <= (enemy.aggroRange ?? 210) + 20) return enemy;
    if (resourceDistance <= enemyDistance + 42) return resource;
    return enemy;
  }
}
