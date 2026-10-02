import { CHUNK_HEIGHT, CHUNK_SIZE } from './WorldGenerator.js';

export class ChunkManager {
  constructor(generator, radius = 2) { this.generator = generator; this.radius = radius; this.loaded = new Map(); }
  update(position, modifications = {}) {
    const cx = Math.floor(position.x / CHUNK_SIZE);
    const cy = Math.floor(position.y / CHUNK_HEIGHT);
    const activeKeys = new Set();
    for (let x = cx - this.radius; x <= cx + this.radius; x += 1) {
      for (let y = cy - this.radius; y <= cy + this.radius; y += 1) {
        const key = this.generator.chunkKey(x, y);
        activeKeys.add(key);
        if (!this.loaded.has(key)) this.loaded.set(key, this.generator.getChunk(x, y, modifications));
      }
    }
    for (const key of this.loaded.keys()) if (!activeKeys.has(key)) this.loaded.delete(key);
    return [...this.loaded.values()];
  }
  getLoadedPointCount() { return [...this.loaded.values()].reduce((total, chunk) => total + chunk.points.filter((point) => !point.dead && !point.collected).length, 0); }
  static coordinates(x, y) { return { cx: Math.floor(x / CHUNK_SIZE), cy: Math.floor(y / CHUNK_HEIGHT) }; }
}
