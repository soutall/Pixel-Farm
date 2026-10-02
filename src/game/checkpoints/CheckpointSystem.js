export class CheckpointSystem {
  constructor() { this.checkpoints = []; }
  build(character, type, position) {
    if (!['campfire', 'cabin'].includes(type) || character.status !== 'alive') return null;
    const checkpoint = { id: `checkpoint-${Date.now()}`, type, position: { ...position }, ownerId: character.id, createdAt: Date.now(), revives: false };
    this.checkpoints.push(checkpoint);
    return checkpoint;
  }
  nearest(position) { return [...this.checkpoints].sort((a, b) => Math.hypot(a.position.x - position.x, a.position.y - position.y) - Math.hypot(b.position.x - position.x, b.position.y - position.y))[0] ?? null; }
}
