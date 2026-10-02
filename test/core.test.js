import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacter } from '../src/game/classes/classCatalog.js';
import { StatsSystem } from '../src/game/stats/StatsSystem.js';
import { ProgressionSystem } from '../src/game/progression/ProgressionSystem.js';
import { CraftingSystem, RECIPES } from '../src/game/crafting/CraftingSystem.js';
import { DeathSystem } from '../src/game/combat/DeathSystem.js';
import { WorldGenerator } from '../src/game/world/WorldGenerator.js';
import { ChunkManager } from '../src/game/world/ChunkManager.js';
import { BiomeSystem, SAFE_ZONE } from '../src/game/world/BiomeSystem.js';
import { ResourceSystem } from '../src/game/resources/ResourceSystem.js';
import { GATHER_DURATION_MS } from '../src/game/resources/ResourceSystem.js';
import { CombatSystem } from '../src/game/combat/CombatSystem.js';
import { RANGED_ATTACK_RANGE, WARRIOR_SKILLS } from '../src/game/skills/WarriorSkills.js';
import { SkillProgression } from '../src/game/skills/SkillProgression.js';
import { DamageSystem } from '../src/game/combat/DamageSystem.js';
import { PotionSystem } from '../src/game/combat/PotionSystem.js';
import { chunkBackgroundDepth } from '../src/game/rendering/ProceduralRenderer.js';
import { EquipmentSystem, EQUIPMENT_SLOTS } from '../src/game/inventory/EquipmentSystem.js';
import { DUNGEONS, DungeonSystem } from '../src/game/combat/DungeonSystem.js';
import { MONSTERS, createMonster } from '../src/game/world/MonsterCatalog.js';
import { normalizeProfile } from '../src/game/save/ProfileNormalizer.js';

const hero = (id = 'test') => createCharacter(id, 'warrior', 'seed-test', 1000);

test('personagem nasce no centro e classe define atributos próprios', () => {
  const player = hero();
  assert.deepEqual(player.position, { x: 0, y: 0 });
  assert.equal(player.attributes.strength, 5);
  assert.equal(player.status, 'alive');
  assert.equal(player.autoEnabled, true);
  assert.deepEqual(player.autoPotion, { hpEnabled: true, manaEnabled: true, hpThreshold: 60, manaThreshold: 35 });
});

test('save antigo sem status e posição é normalizado para manter o personagem vivo e visível', () => {
  const legacyProfile = {
    seed: 'legacy-seed',
    history: [],
    character: {
      id: 'legacy-hero',
      name: 'Herói',
      classId: 'mage',
      resources: { wood: 3 },
      attributes: { strength: 1 }
    }
  };
  const normalized = normalizeProfile(legacyProfile);
  assert.equal(normalized.character.status, 'alive');
  assert.deepEqual(normalized.character.position, { x: 0, y: 0 });
  assert.equal(normalized.character.autoEnabled, true);
  assert.deepEqual(normalized.character.autoPotion, { hpEnabled: true, manaEnabled: true, hpThreshold: 60, manaThreshold: 35 });
  assert.equal(normalized.character.resources.wood, 3);
  assert.equal(normalized.character.classId, 'mage');
});

test('atributos básicos gastam ponto e derivados são calculados', () => {
  const player = hero(); player.unspentPoints = 1;
  assert.equal(StatsSystem.allocate(player, 'strength'), true);
  assert.equal(player.attributes.strength, 6);
  assert.equal(player.unspentPoints, 0);
  assert.ok(StatsSystem.derived(player).maxLife > 0);
});

test('Vida aumenta vida máxima e atual ao distribuir ponto; esquiva evita golpes físicos', () => {
  const player = hero('stats');
  player.unspentPoints = 1;
  player.currentLife = 150;
  assert.equal(StatsSystem.allocate(player, 'life'), true);
  assert.equal(StatsSystem.derived(player).maxLife, 210);
  assert.equal(player.currentLife, 160);
  player.attributes.agility = 10;
  assert.equal(DamageSystem.physicalDamage(player, 12, () => 0).dodged, true);
  assert.ok(DamageSystem.physicalDamage(player, 12, () => 0.99).damage < 12);
});

test('poções infinitas restauram HP/mana e cada tipo respeita recarga de 5 segundos', () => {
  const player = hero('potions');
  player.currentLife = 100;
  player.currentMana = 0;
  const hp = PotionSystem.use(player, 'hp', 1000);
  assert.ok(hp.restored > 0);
  assert.equal(PotionSystem.use(player, 'hp', 5999), null);
  assert.ok(PotionSystem.use(player, 'hp', 6000));
  const mana = PotionSystem.use(player, 'mana', 1000);
  assert.ok(mana.restored > 0);
  assert.equal(PotionSystem.use(player, 'mana', 5999), null);
  assert.ok(PotionSystem.use(player, 'mana', 6000));
  assert.equal(player.currentMana, StatsSystem.derived(player).maxMana);
});

test('XP pode avançar nível e conceder pontos', () => {
  const player = hero();
  assert.deepEqual(ProgressionSystem.grantXp(player, 35), [2]);
  assert.equal(player.unspentPoints, 3);
  assert.equal(player.skillPoints, 1);
  assert.equal(player.xp, 5);
});

test('árvore de habilidades consome pontos e limita cada técnica ao nível 10', () => {
  const player = hero('tree');
  SkillProgression.initialize(player);
  assert.equal(player.skillLevels.warriorWhirlwind, 1);
  player.skillPoints = 12;
  for (let rank = 2; rank <= 10; rank += 1) assert.equal(SkillProgression.upgrade(player, 'warriorWhirlwind'), true);
  assert.equal(SkillProgression.rank(player, 'warriorWhirlwind'), 10);
  assert.equal(SkillProgression.upgrade(player, 'warriorWhirlwind'), false);
  assert.equal(player.skillPoints, 3);
  assert.ok(SkillProgression.effective(player, WARRIOR_SKILLS[0]).multiplier > WARRIOR_SKILLS[0].multiplier);
});

test('Slime Gel cria e equipa arma específica de monstro', () => {
  const player = hero(); player.resources = { ...player.resources, slimeGel: 12, wood: 14, branches: 8 };
  const weapon = CraftingSystem.craft(player, 'slimeGreatsword');
    assert.ok(weapon.name.endsWith('Espada grande de Slime'));
  assert.equal(player.equippedWeaponId, weapon.id);
  assert.equal(player.resources.slimeGel, 0);
});

test('oficina tem espadões metálico, verde e violeta; forja sorteia qualidade e afixos', () => {
  assert.equal(RECIPES.ironGreatsword.color, 0xb9c8ce);
  assert.equal(RECIPES.slimeGreatsword.color, 0x63da70);
  assert.equal(RECIPES.voidGreatsword.color, 0xa958ed);
  const player = hero('forge');
  player.resources = { wood: 50, stone: 40, branches: 30, slimeGel: 20, voidGel: 20, goblinScrap: 20, orcHide: 20, orcIron: 20, wraithEssence: 20 };
  const iron = CraftingSystem.craft(player, 'ironGreatsword', () => 0.08);
  assert.ok(iron.affixes.length > 0);
  assert.equal(player.equippedWeaponId, iron.id);
  const purple = CraftingSystem.craft(player, 'voidGreatsword', () => 0.08);
  assert.equal(purple.kind, 'voidGreatsword');
  assert.equal(purple.color, 0xa958ed);
});

test('slots equipam e comparam armas; desmontagem em lote cria fragmentos', () => {
  const player = hero('equipment');
  player.resources = { ...player.resources, wood: 80, stone: 60, branches: 60, slimeGel: 24 };
  const iron = CraftingSystem.craft(player, 'ironGreatsword', () => 0.08);
  const slime = CraftingSystem.craft(player, 'slimeGreatsword', () => 0.45);
  assert.equal(EQUIPMENT_SLOTS.length, 10);
  assert.equal(EquipmentSystem.equip(player, iron.id), true);
  const comparison = EquipmentSystem.compare(player, slime);
  assert.equal(comparison.current.id, iron.id);
  assert.equal(comparison.candidate.id, slime.id);
  assert.equal(EquipmentSystem.unequip(player, 'mainHand'), true);
  assert.equal(EquipmentSystem.equip(player, slime.id), true);
  const result = EquipmentSystem.salvage(player, [iron.id, slime.id]);
  assert.equal(result.removed, 2);
  assert.ok(result.fragments >= 4);
  assert.equal(player.weapons.length, 0);
  assert.equal(player.equippedWeaponId, null);
});

test('derrota retorna ao centro e não deixa o personagem morto permanentemente', () => {
  const player = hero();
  player.position = { x: 900, y: 120 };
  const record = DeathSystem.kill(player, 'Slime');
  assert.ok(record);
  assert.equal(player.status, 'alive');
  assert.deepEqual(player.position, { x: 0, y: 0 });
  assert.equal(player.autoEnabled, true);
});

test('chunk é determinístico por seed e posição', () => {
  const generator = new WorldGenerator('abc');
  assert.deepEqual(generator.getChunk(0, 0), generator.getChunk(0, 0));
  assert.notDeepEqual(generator.getChunk(0, 0).points, new WorldGenerator('other').getChunk(0, 0).points);
});

test('praça inicial é um círculo seguro amplo sem spawn de monstros nem dano', () => {
  assert.equal(BiomeSystem.isSafe(0, 0), true);
  assert.equal(BiomeSystem.isSafe(SAFE_ZONE.radius - 1, 0), true);
  assert.equal(BiomeSystem.isSafe(SAFE_ZONE.radius + 1, 0), false);
  const chunks = [];
  const world = new WorldGenerator('safe-center');
  for (let cx = -1; cx <= 1; cx += 1) for (let cy = -1; cy <= 1; cy += 1) chunks.push(...world.getChunk(cx, cy).points);
  assert.equal(chunks.some((point) => ['monster', 'slime'].includes(point.kind) && BiomeSystem.isSafe(point.x, point.y)), false);
  const player = hero('safe-town');
  const physical = DamageSystem.physicalDamage(player, 100, () => 0.99, Date.now());
  const magical = DamageSystem.magicalDamage(player, 100);
  assert.equal(physical.safeZone, true);
  assert.equal(physical.damage, 0);
  assert.equal(magical.safeZone, true);
  assert.equal(magical.damage, 0);
});

test('mundo procedural inclui Slime Violeta e pontos de interesse reproduzíveis', () => {
  const generator = new WorldGenerator('purple-slime-world');
  const chunks = [];
  for (let x = -4; x <= 4; x += 1) for (let y = -4; y <= 4; y += 1) chunks.push(generator.getChunk(x, y));
  assert.ok(chunks.some((chunk) => chunk.points.some((point) => point.kind === 'monster' && point.monsterId === 'voidSlime')));
  assert.ok(chunks.some((chunk) => chunk.points.some((point) => point.kind === 'obstacle' && point.feature === 'lake')));
  assert.ok(chunks.some((chunk) => chunk.points.some((point) => point.kind === 'landmark' && point.feature === 'cabin')));
  const first = generator.getChunk(1, 2);
  const second = generator.getChunk(1, 2);
  assert.deepEqual(first.points, second.points);
});

test('biomas respeitam progressão de níveis e monstros têm drops próprios', () => {
  assert.deepEqual([BiomeSystem.at(0, 0).minLevel, BiomeSystem.at(0, 0).maxLevel], [1, 15]);
  assert.deepEqual([BiomeSystem.at(2500, 0).minLevel, BiomeSystem.at(2500, 0).maxLevel], [15, 20]);
  assert.deepEqual([BiomeSystem.at(5800, 0).minLevel, BiomeSystem.at(5800, 0).maxLevel], [20, 30]);
  for (const id of ['goblin', 'orc', 'wraith', 'direBat', 'batOverlord']) {
    const mob = createMonster(id, `test:${id}`, 0, 0, MONSTERS[id].minLevel, () => 0.5);
    assert.ok(Object.keys(mob.drops).length > 0);
    assert.ok(mob.maxHp > 0);
  }
});

test('árvores e pedras não aparecem no círculo seguro da cidade', () => {
  const generator = new WorldGenerator('safe-resource-world');
  for (let cx = -1; cx <= 1; cx += 1) for (let cy = -1; cy <= 1; cy += 1) {
    for (const point of generator.getChunk(cx, cy).points) {
      if (!BiomeSystem.isSafe(point.x, point.y)) continue;
      assert.notEqual(point.resource, 'wood');
      assert.notEqual(point.resource, 'stone');
    }
  }
});

test('relógio servidor define reforço de monstros entre 00h e 04h; coleta tem tempos corretos', () => {
  const cycle = 20 * 60 * 1000;
  const midnight = BiomeSystem.clockAt(0, cycle);
  const three = BiomeSystem.clockAt(cycle * 3 / 24, cycle);
  const four = BiomeSystem.clockAt(cycle * 4 / 24, cycle);
  assert.equal(midnight.hour, 0);
  assert.equal(three.hour, 3);
  assert.equal(midnight.isMonsterSurge, true);
  assert.equal(three.isMonsterSurge, true);
  assert.equal(four.isMonsterSurge, false);
  assert.deepEqual(BiomeSystem.monsterModifiers(midnight), { attack: 1.4, speed: 1.3, aggro: 1.25, attackRate: 1.25 });
  assert.equal(GATHER_DURATION_MS.stone, 4000);
  assert.equal(GATHER_DURATION_MS.wood, 3000);
  assert.equal(GATHER_DURATION_MS.branches, 2000);
});

test('derrota respawna na cidade mantendo o personagem vivo e automático', () => {
  const player = hero('respawn');
  player.position = { x: 2800, y: 100 };
  player.currentLife = 0;
  player.autoEnabled = false;
  const record = DeathSystem.respawnInTown(player, 'Orc', 12345);
  assert.equal(record.cause, 'Orc');
  assert.deepEqual(player.position, { x: 0, y: 0 });
  assert.equal(player.status, 'alive');
  assert.equal(player.autoEnabled, true);
  assert.equal(player.respawns, 1);
});

test('Cripta dos Morcegos aceita solo e grupo com quatro, mas rejeita grupo parcial', () => {
  const player = hero('dungeon'); player.level = 18;
  const dungeon = new DungeonSystem();
  assert.equal(dungeon.canEnter(DUNGEONS[0].id, player).reason.includes('Cidade Segura'), true);
  player.position = { x: SAFE_ZONE.radius + 20, y: 0 };
  const solo = dungeon.enter(DUNGEONS[0].id, player, null, 5000);
  assert.equal(solo.allowed, true);
  assert.equal(solo.enemies.length, 3);
  assert.equal(dungeon.canEnter(DUNGEONS[0].id, player).allowed, false);
  dungeon.fail(5500);
  const partial = dungeon.canEnter(DUNGEONS[0].id, player, { members: [{}, {}] });
  assert.equal(partial.allowed, false);
  const full = dungeon.enter(DUNGEONS[0].id, player, { members: [{}, {}, {}, {}] }, 6000);
  assert.equal(full.allowed, true);
});

test('gerenciador limita chunks carregados e biomas acompanham distância', () => {
  const manager = new ChunkManager(new WorldGenerator('seed'), 1);
  assert.equal(manager.update({ x: 0, y: 0 }).length, 9);
  assert.equal(manager.update({ x: 4000, y: 0 }).length, 9);
  assert.equal(BiomeSystem.at(0, 0).id, 'starterForest');
  assert.equal(BiomeSystem.at(6000, 0).id, 'hauntedMarsh');
  assert.equal(BiomeSystem.at(6000, 0).maxLevel, 30);
});

test('loop integrado coleta recursos, derrota Slime, sobe nível e equipa arma', () => {
  const player = hero('loop');
  const chunk = new WorldGenerator(player.seed).getChunk(0, 0);
  const starterResources = chunk.points.filter((point) => point.id.includes(':starter-') && point.kind === 'resource');
  for (const resource of starterResources) assert.equal(ResourceSystem.collect(player, resource), true);
  assert.ok(player.resources.wood > 0 && player.resources.stone > 0 && player.resources.branches > 0);

  const slime = chunk.points.find((point) => point.id === '0,0:starter-slime');
  player.position = { x: 540, y: 0 };
  player.attributes.accuracy = 100;
  const combat = new CombatSystem();
  let result;
  while (slime.hp > 0) result = combat.attack(player, slime, Date.now() + slime.maxHp - slime.hp + 10000);
  assert.equal(result.defeated, true);
  player.resources.slimeGel = 12; player.resources.wood = 14; player.resources.branches = 8;
  assert.deepEqual(ProgressionSystem.grantXp(player, 35), [2]);
  assert.equal(StatsSystem.allocate(player, 'strength'), true);
  const weapon = CraftingSystem.craft(player, 'slimeGreatsword');
  assert.equal(player.equippedWeaponId, weapon.id);
  assert.equal(player.level, 2);
});

test('Ciclone de Aço atinge vários inimigos próximos sem atingir os distantes', () => {
  const player = hero('skills');
  player.position = { x: 521, y: 0 };
  const enemies = [
    { id: 'near-1', kind: 'slime', x: 551, y: 0, hp: 100, level: 1 },
    { id: 'near-2', kind: 'slime', x: 621, y: 0, hp: 100, level: 1 },
    { id: 'far', kind: 'slime', x: 721, y: 0, hp: 100, level: 1 }
  ];
  const result = new CombatSystem().attack(player, enemies[0], enemies, 10000);
  assert.equal(result.skillId, 'warriorWhirlwind');
  assert.equal(result.hits.length, 2);
  assert.ok(enemies[0].hp < 100 && enemies[1].hp < 100);
  assert.equal(enemies[2].hp, 100);
  assert.equal(player.currentMana, 35);
});

test('fundo de chunks negativos continua atrás dos personagens na mesma faixa', () => {
  const y = -1450;
  const cy = Math.floor(y / 480);
  assert.ok(chunkBackgroundDepth(cy) < y + 10);
  assert.ok(chunkBackgroundDepth(3) < 3 * 480 + 10);
});

test('Grito cura e provoca; Postura concede defesa e Correntes puxam alvos', () => {
  const player = hero('skills');
  player.position = { x: 521, y: 0 };
  const enemy = { id: 'slime', kind: 'slime', x: 760, y: 0, hp: 100, level: 1 };
  const combat = new CombatSystem();
  player.currentLife = 100;
  const cry = combat.attack(player, enemy, [enemy], 10000);
  assert.equal(cry.skillId, 'warriorWhirlwind');
  const warCry = combat.attack(player, enemy, [enemy], 14200);
  assert.equal(warCry.skillId, 'warriorWarCry');
  assert.equal(warCry.healed, 40);
  assert.equal(enemy.tauntUntil, 24200);
  const defense = combat.attack(player, enemy, [enemy], 18400);
  assert.equal(defense.skillId, 'warriorIronWill');
  assert.equal(player.buffs.defenseMultiplier, 1.1);
  player.currentMana = StatsSystem.derived(player).maxMana;
  const before = enemy.x;
  const chains = combat.attack(player, enemy, [enemy], 22600);
  assert.equal(chains.skillId, 'warriorChains');
  assert.ok(enemy.x < before);
  assert.equal(WARRIOR_SKILLS.length, 4);
});

test('Mago e Arqueiro possuem alcance básico maior que o corpo a corpo', () => {
  assert.ok(RANGED_ATTACK_RANGE.mage > 46);
  assert.ok(RANGED_ATTACK_RANGE.archer > RANGED_ATTACK_RANGE.mage);
});

test('habilidades consomem mana e afixos alteram críticos/precisão', () => {
  const player = hero('mana-affix');
  player.position = { x: 600, y: 0 };
  const target = { id: 'slime', kind: 'slime', x: 25, y: 0, hp: 100, level: 1 };
  const combat = new CombatSystem();
  const result = combat.attack(player, target, [target], 10000);
  assert.equal(result.skillId, 'warriorWhirlwind');
  assert.equal(player.currentMana, StatsSystem.derived(player).maxMana - result.skillData.manaCost);
  player.weapons.push({ id: 'crafted', damage: 4, affixes: [{ stat: 'criticalChance', value: 20 }, { stat: 'accuracy', value: 8 }] });
  player.equippedWeaponId = 'crafted';
  assert.equal(StatsSystem.derived(player).criticalChance, 26);
  assert.equal(StatsSystem.derived(player).accuracy, 82);
});
