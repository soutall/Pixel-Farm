export class TargetingSystem {
  static nearest(origin, candidates, maxDistance = Infinity) {
    let chosen = null;
    let nearestDistance = maxDistance;
    for (const candidate of candidates) {
      if (candidate.dead || candidate.collected) continue;
      const distance = Math.hypot(candidate.x - origin.x, candidate.y - origin.y);
      if (distance < nearestDistance) { chosen = candidate; nearestDistance = distance; }
    }
    return chosen;
  }
}
