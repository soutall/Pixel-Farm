import { Inventory } from '../inventory/Inventory.js';

export const GATHER_DURATION_MS = { stone: 4000, wood: 3000, branches: 2000 };

export class ResourceSystem {
  static duration(point) { return GATHER_DURATION_MS[point?.resource] ?? 2500; }
  static collect(character, point) {
    if (point.kind !== 'resource' || point.collected || character.status !== 'alive') return false;
    point.collected = true;
    new Inventory(character).add(point.resource, point.amount);
    character.modifications[point.id] = true;
    return true;
  }
}
