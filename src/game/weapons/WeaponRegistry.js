import { RECIPES } from '../crafting/CraftingSystem.js';

// Adicione definições de armas aqui sem alterar o loop principal.
export const WEAPON_REGISTRY = Object.fromEntries(Object.entries(RECIPES).map(([id, recipe]) => [id, { id, name: recipe.name, kind: recipe.kind, color: recipe.color, material: 'Slime Gel', particles: recipe.particleColor }]));
