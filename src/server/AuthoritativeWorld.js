import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { timingSafeEqual } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { createCharacter, CLASS_CATALOG } from '../game/classes/classCatalog.js';
import { WorldGenerator, CHUNK_HEIGHT, CHUNK_SIZE } from '../game/world/WorldGenerator.js';
import { BiomeSystem } from '../game/world/BiomeSystem.js';
import { AutoCombatSystem } from '../game/ai/AutoCombatSystem.js';
import { CombatSystem } from '../game/combat/CombatSystem.js';
import { DamageSystem } from '../game/combat/DamageSystem.js';
import { PotionSystem } from '../game/combat/PotionSystem.js';
import { DeathSystem } from '../game/combat/DeathSystem.js';
import { ResourceSystem } from '../game/resources/ResourceSystem.js';
import { ProgressionSystem } from '../game/progression/ProgressionSystem.js';
import { StatsSystem } from '../game/stats/StatsSystem.js';
import { SkillProgression } from '../game/skills/SkillProgression.js';
import { CraftingSystem } from '../game/crafting/CraftingSystem.js';
import { RECIPES } from '../game/crafting/CraftingSystem.js';
import { EquipmentSystem } from '../game/inventory/EquipmentSystem.js';
import { RESOURCE_CATALOG } from '../game/inventory/Inventory.js';
import { DungeonSystem, DUNGEONS } from '../game/combat/DungeonSystem.js';
import { RANGED_ATTACK_RANGE, MELEE_ATTACK_RANGE } from '../game/skills/WarriorSkills.js';

const TICK_MS = 50;
const SNAPSHOT_MS = 100;
const SAVE_MS = 5000;
const MAX_MESSAGE_BYTES = 8192;
const MAX_PLAYERS = 100;
const MAX_WORLD_COORDINATE = 100000;
const VALID_CLASSES = new Set(Object.keys(CLASS_CATALOG));
const VALID_ATTRIBUTES = new Set(['strength', 'agility', 'dexterity', 'intelligence', 'life']);
const VALID_POTIONS = new Set(['hp', 'mana']);
const VALID_AUTO_POTION_KEYS = new Set(['hpEnabled', 'manaEnabled', 'hpThreshold', 'manaThreshold']);

export class AuthoritativeWorld {
  constructor({ stateFile = null, seed = randomUUID(), now = () => Date.now() } = {}) {
    this.stateFile = stateFile;
    this.now = now;
    this.players = new Map();
    this.sessions = new Map();
    this.points = new Map();
    this.chunks = new Map();
    this.worldFlags = {};
    this.pointStates = {};
    this.events = [];
    this.dungeonSystem = new DungeonSystem();
    this.dungeonEnemies = [];
    this.dungeonParticipantIds = new Set();
    this.dungeonAnchor = null;
    this.lastSnapshotAt = 0;
    this.lastSaveAt = 0;
    this.ai = new AutoCombatSystem();
    this.worldSeed = seed;
    if (stateFile && existsSync(stateFile)) this.restore();
    this.generator = new WorldGenerator(this.worldSeed);
  }

  restore() {
    try {
      const saved = JSON.parse(readFileSync(this.stateFile, 'utf8'));
      if (typeof saved.worldSeed === 'string') this.worldSeed = saved.worldSeed;
      this.worldFlags = saved.worldFlags && typeof saved.worldFlags === 'object' ? saved.worldFlags : {};
      this.pointStates = saved.pointStates && typeof saved.pointStates === 'object' ? saved.pointStates : {};
      this.sessions = new Map(Object.entries(saved.sessions ?? {}));
    } catch { /* arquivo corrompido não impede o servidor de iniciar um mundo novo */ }
  }

  persist(force = false) {
    if (!this.stateFile) return;
    const current = this.now();
    if (!force && current - this.lastSaveAt < SAVE_MS) return;
    this.lastSaveAt = current;
    mkdirSync(path.dirname(this.stateFile), { recursive: true });
    const tempFile = `${this.stateFile}.tmp`;
    writeFileSync(tempFile, JSON.stringify({ worldSeed: this.worldSeed, worldFlags: this.worldFlags, pointStates: this.pointStates, sessions: Object.fromEntries(this.sessions) }));
    renameSync(tempFile, this.stateFile);
  }

  join(socket, request) {
    const token = typeof request.sessionToken === 'string' && /^[a-f0-9]{64}$/.test(request.sessionToken) ? request.sessionToken : randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    if (this.players.size >= MAX_PLAYERS && !this.players.has(token)) return { error: 'Servidor cheio; tente novamente mais tarde.' };
    const oldSession = this.sessions.get(token);
    const session = oldSession ?? this.createSession(request.character);
    if (!oldSession) this.sessions.set(token, session);
    const replaced = this.players.get(token);
    if (replaced) {
      replaced.socket.close(4001, 'Sessão reconectada');
      this.players.delete(token);
    }
    const savedPosition = oldSession?.character?.position;
    const position = savedPosition && Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)
      ? { x: clamp(savedPosition.x, -MAX_WORLD_COORDINATE, MAX_WORLD_COORDINATE), y: clamp(savedPosition.y, -MAX_WORLD_COORDINATE, MAX_WORLD_COORDINATE) }
      : this.findSpawn();
    const player = {
      id: token,
      token,
      socket,
      character: session.character,
      position,
      facing: 1,
      autoEnabled: session.character.autoEnabled !== false,
      lastAttackAt: 0,
      gather: null,
      combat: new CombatSystem(),
      buffs: session.character.buffs ?? {},
      connectedAt: this.now()
    };
    player.character.position = { ...position };
    player.character.status = 'alive';
    player.character.currentLife ??= StatsSystem.derived(player.character).maxLife;
    player.character.currentMana ??= StatsSystem.derived(player.character).maxMana;
    player.character.autoEnabled = player.autoEnabled;
    this.players.set(token, player);
    this.sessions.set(token, session);
    this.ensureChunks(position);
    return { player, token };
  }

  createSession(input = {}) {
    const source = input?.profile && typeof input.profile === 'object' ? input.profile : input;
    const name = cleanName(source?.name ?? input?.name);
    const classId = VALID_CLASSES.has(source?.classId) ? source.classId : VALID_CLASSES.has(input?.classId) ? input.classId : 'warrior';
    const character = migrateCharacter(source, name, classId, this.worldSeed, this.now());
    EquipmentSystem.initialize(character);
    return { character, createdAt: this.now() };
  }

  findSpawn() {
    const index = this.players.size;
    const angle = index * 2.399963229728653;
    const radius = 28 * Math.sqrt(index);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  disconnect(player) {
    if (this.players.get(player.token) !== player) return;
    this.players.delete(player.token);
    this.sessions.set(player.token, { character: player.character, createdAt: this.sessions.get(player.token)?.createdAt ?? this.now() });
    this.persist(true);
  }

  handle(player, message, findParty = () => null) {
    if (this.players.get(player.token) !== player || !message || typeof message !== 'object') return;
    const current = this.now();
    if (current - (player.rateWindowAt ?? 0) >= 1000) { player.rateWindowAt = current; player.messagesInWindow = 0; }
    player.messagesInWindow = (player.messagesInWindow ?? 0) + 1;
    if (player.messagesInWindow > 80) { player.socket.close(4008, 'Taxa de mensagens excedida'); return; }
    if (message.type === 'action') this.action(player, message.action, message.data ?? {}, findParty);
    if (message.type === 'intent' && message.autoEnabled !== undefined) {
      player.autoEnabled = Boolean(message.autoEnabled);
      player.character.autoEnabled = player.autoEnabled;
    }
  }

  action(player, action, data, findParty) {
    const character = player.character;
    if (character.status !== 'alive') return;
    if (action === 'toggleAuto') {
      player.autoEnabled = !player.autoEnabled;
      character.autoEnabled = player.autoEnabled;
    } else if (action === 'usePotion') {
      if (!VALID_POTIONS.has(data.kind)) return;
      const potion = PotionSystem.use(character, data.kind, this.now());
      if (potion) this.emit('potion', { playerId: player.id, kind: potion.kind, restored: potion.restored, x: player.position.x, y: player.position.y });
    } else if (action === 'allocate') {
      if (!VALID_ATTRIBUTES.has(data.attribute) || !StatsSystem.allocate(character, data.attribute)) return;
    } else if (action === 'upgradeSkill') {
      if (!SkillProgression.upgrade(character, String(data.skillId ?? ''))) return;
    } else if (action === 'craft') {
      const weapon = CraftingSystem.craft(character, String(data.recipeId ?? ''));
      if (!weapon) return;
      EquipmentSystem.initialize(character);
      this.emit('craft', { playerId: player.id, weapon: weapon.name });
    } else if (action === 'equip') {
      if (data.itemId && !EquipmentSystem.equip(character, String(data.itemId))) return;
      if (!data.itemId) EquipmentSystem.initialize(character);
    } else if (action === 'salvage') {
      const keys = Array.isArray(data.keys) ? data.keys.filter((key) => typeof key === 'string').slice(0, 100) : [];
      const weapons = keys.filter((key) => key.startsWith('weapon:')).map((key) => key.slice(7));
      const resources = keys.filter((key) => key.startsWith('resource:')).map((key) => key.slice(9));
      const result = EquipmentSystem.salvage(character, weapons, resources);
      if (!result.removed) return;
      this.emit('salvage', { playerId: player.id, removed: result.removed, fragments: result.fragments });
    } else if (action === 'setAutoPotion') {
      const key = String(data.key ?? '');
      if (!VALID_AUTO_POTION_KEYS.has(key)) return;
      character.autoPotion ??= { hpEnabled: true, manaEnabled: true, hpThreshold: 60, manaThreshold: 35 };
      character.autoPotion[key] = key.endsWith('Enabled') ? Boolean(data.value) : clamp(Number(data.value), 10, 90);
    } else if (action === 'teleportTown') {
      player.position = { x: 0, y: 0 };
      character.position = { ...player.position };
      player.gather = null;
      player.autoEnabled = false;
      character.autoEnabled = false;
    } else if (action === 'enterDungeon') {
      this.enterDungeon(player, String(data.dungeonId ?? ''), Boolean(data.solo));
      return;
    } else if (action === 'joinParty') {
      const party = findParty(String(data.partyId ?? ''));
      const provided = Buffer.from(String(data.invite ?? ''));
      const expected = Buffer.from(String(party?.invite ?? randomUUID()));
      if (!party || provided.length !== expected.length || !timingSafeEqual(provided, expected)) return;
      player.partyId = party.id;
      return;
    } else if (action === 'leaveParty') {
      player.partyId = null;
      return;
    } else return;
    this.sessions.set(player.token, { character, createdAt: this.sessions.get(player.token)?.createdAt ?? this.now() });
    this.persist();
  }

  tick(deltaMs = TICK_MS) {
    const current = this.now();
    const delta = Math.min(deltaMs, 100) / 1000;
    const activeChunkKeys = new Set();
    for (const player of this.players.values()) {
      this.ensureChunks(player.position);
      const cx = Math.floor(player.position.x / CHUNK_SIZE); const cy = Math.floor(player.position.y / CHUNK_HEIGHT);
      for (let x = cx - 1; x <= cx + 1; x += 1) for (let y = cy - 1; y <= cy + 1; y += 1) activeChunkKeys.add(this.generator.chunkKey(x, y));
    }
    const allPoints = [...this.points.values()];
    for (const player of this.players.values()) this.updatePlayer(player, allPoints, current, delta);
    this.separatePlayers();
    this.updateMonsters(allPoints, current, delta);
    this.unloadInactiveChunks(activeChunkKeys);
    if (current - this.lastSnapshotAt >= SNAPSHOT_MS) {
      this.lastSnapshotAt = current;
      this.broadcastSnapshots();
      this.events.length = 0;
    }
    this.persist();
  }

  unloadInactiveChunks(activeChunkKeys) {
    for (const [key, chunk] of this.chunks) {
      if (activeChunkKeys.has(key)) continue;
      for (const point of chunk.points) {
        if (point.dead || point.collected) continue;
        if (point.kind === 'monster' || point.kind === 'slime') this.pointStates[point.id] = { x: point.x, y: point.y, hp: point.hp, aggroUntil: 0, tauntUntil: 0, nextAttackAt: 0 };
        this.points.delete(point.id);
      }
      this.chunks.delete(key);
    }
  }

  ensureChunks(position) {
    const cx = Math.floor(position.x / CHUNK_SIZE);
    const cy = Math.floor(position.y / CHUNK_HEIGHT);
    for (let x = cx - 1; x <= cx + 1; x += 1) for (let y = cy - 1; y <= cy + 1; y += 1) {
      const key = this.generator.chunkKey(x, y);
      if (this.chunks.has(key)) continue;
      const chunk = this.generator.getChunk(x, y, this.worldFlags);
      for (const point of chunk.points) {
        const savedState = this.pointStates[point.id];
        if (savedState && Number.isFinite(savedState.x) && Number.isFinite(savedState.y) && Number.isFinite(savedState.hp)) Object.assign(point, savedState);
        if (this.worldFlags[point.id]) {
          if (point.kind === 'resource') point.collected = true;
          else point.dead = true;
        }
        if (!point.dead && !point.collected) this.points.set(point.id, point);
      }
      this.chunks.set(key, chunk);
    }
  }

  pointsNear(position) {
    const cx = Math.floor(position.x / CHUNK_SIZE);
    const cy = Math.floor(position.y / CHUNK_HEIGHT);
    const result = [];
    for (let x = cx - 1; x <= cx + 1; x += 1) for (let y = cy - 1; y <= cy + 1; y += 1) {
      const chunk = this.chunks.get(this.generator.chunkKey(x, y));
      if (chunk) result.push(...chunk.points.filter((point) => !point.dead && !point.collected));
    }
    return result;
  }

  updatePlayer(player, allPoints, now, delta) {
    const character = player.character;
    character.position = { ...player.position };
    const localPoints = this.pointsNear(player.position);
    const dungeonMember = this.dungeonParticipantIds.has(player.id);
    const enemies = [...localPoints.filter((point) => point.kind === 'monster' || point.kind === 'slime'), ...(dungeonMember ? this.dungeonEnemies : [])];
    const resources = localPoints.filter((point) => point.kind === 'resource');
    const safe = BiomeSystem.isSafe(player.position.x, player.position.y);
    const stats = StatsSystem.derived(character);
    character.currentLife = Math.min(stats.maxLife, character.currentLife ?? stats.maxLife);
    character.currentMana = Math.min(stats.maxMana, (character.currentMana ?? stats.maxMana) + delta * stats.manaRegeneration);
    const autoPotion = character.autoPotion ?? {};
    if (autoPotion.hpEnabled && character.currentLife / stats.maxLife * 100 <= clamp(autoPotion.hpThreshold, 10, 90)) PotionSystem.use(character, 'hp', now);
    if (autoPotion.manaEnabled && character.currentMana / stats.maxMana * 100 <= clamp(autoPotion.manaThreshold, 10, 90)) PotionSystem.use(character, 'mana', now);
    if (safe) player.gather = null;
    if (!player.autoEnabled) return;

    const aggressive = safe ? null : enemies.filter((enemy) => enemy.aggroUntil > now || Math.hypot(enemy.x - player.position.x, enemy.y - player.position.y) <= (enemy.aggroRange ?? 210)).sort((a, b) => distance(player.position, a) - distance(player.position, b))[0];
    let target = aggressive ?? this.ai.movementTarget(player.position, safe ? [] : enemies, resources, now);
    if (player.gather && (!player.gather.point || player.gather.point.collected || player.gather.point.dead || aggressive)) player.gather = null;
    if (target) {
      const range = target.kind === 'resource' ? 28 : (RANGED_ATTACK_RANGE[character.classId] ?? MELEE_ATTACK_RANGE);
      const targetDistance = distance(player.position, target);
      if (targetDistance <= range) {
        if (target.kind === 'resource') {
          player.gather ??= { point: target, startedAt: now };
          if (now - player.gather.startedAt >= ResourceSystem.duration(target)) {
            if (this.collectResource(player, target)) player.gather = null;
          }
        } else {
          player.gather = null;
          const attackSpeed = StatsSystem.derived(character).attackSpeed;
          const cooldown = Math.max(360, 900 / (1 + attackSpeed / 100));
          if (now - player.lastAttackAt >= cooldown) {
            const result = player.combat.attack(character, target, enemies, now);
            player.lastAttackAt = now;
            if (result.skillId || result.hit) this.emit('attack', { playerId: player.id, targetId: target.id, skillId: result.skillId, hit: result.hit, damage: result.damage, x: target.x, y: target.y, playerX: player.position.x, playerY: player.position.y });
            for (const hit of result.hits ?? []) if (hit.target.hp <= 0) this.defeatMonster(player, hit.target);
            if (target.hp <= 0) this.defeatMonster(player, target);
          }
        }
      } else {
        player.gather = null;
        const speed = target.kind === 'resource' ? 78 : (target.speed ?? 78) * 1.8;
        const step = Math.max(0, Math.min(targetDistance - range * 0.72, speed * delta));
        player.facing = target.x < player.position.x ? -1 : 1;
        const nextX = player.position.x + (target.x - player.position.x) / targetDistance * step;
        const nextY = player.position.y + (target.y - player.position.y) / targetDistance * step;
        const obstacles = localPoints.filter((point) => point.kind === 'obstacle' && point.collisionRadius);
        if (!obstacles.some((obstacle) => Math.hypot(nextX - obstacle.x, nextY - obstacle.y) < obstacle.collisionRadius + 10)) {
          player.position.x = nextX;
          player.position.y = nextY;
        }
      }
    } else {
      player.position.x += 44 * delta;
      player.position.y += Math.sin(now / 2100) * 14 * delta;
    }
    player.position.x = clamp(player.position.x, -MAX_WORLD_COORDINATE, MAX_WORLD_COORDINATE);
    player.position.y = clamp(player.position.y, -MAX_WORLD_COORDINATE, MAX_WORLD_COORDINATE);
    character.position = { ...player.position };
    character.facing = player.facing;
  }

  updateMonsters(points, now, delta) {
    const allEnemies = [...points, ...this.dungeonEnemies];
    const livingPlayers = [...this.players.values()].filter((player) => player.character.status === 'alive' && !BiomeSystem.isSafe(player.position.x, player.position.y));
    if (!livingPlayers.length) return;
    for (const enemy of allEnemies) {
      if (!['monster', 'slime'].includes(enemy.kind) || enemy.dead || enemy.hp <= 0) continue;
      const candidates = enemy.dungeonInstance ? livingPlayers.filter((candidate) => this.dungeonParticipantIds.has(candidate.id)) : livingPlayers;
      const player = candidates.reduce((nearest, candidate) => !nearest || distance(candidate.position, enemy) < distance(nearest.position, enemy) ? candidate : nearest, null);
      if (!player) continue;
      const character = player.character;
      const range = (enemy.aggroRange ?? 210) * BiomeSystem.monsterModifiers(BiomeSystem.clockAt(now)).aggro;
      const d = distance(player.position, enemy);
      if (d <= range) enemy.aggroUntil = now + 7000;
      const engaged = enemy.tauntUntil > now || enemy.aggroUntil > now;
      if (!engaged) continue;
      if (d > (enemy.leashDistance ?? 470)) {
        enemy.aggroUntil = 0;
        continue;
      }
      if (d > (enemy.attackRange ?? 48) * 0.82) {
        const speed = (enemy.speed ?? 40) * BiomeSystem.monsterModifiers(BiomeSystem.clockAt(now)).speed;
        const step = Math.min(d - (enemy.attackRange ?? 48) * 0.72, speed * delta);
        if (step > 0) { enemy.x += (player.position.x - enemy.x) / d * step; enemy.y += (player.position.y - enemy.y) / d * step; }
      } else if (now >= (enemy.nextAttackAt ?? 0)) {
        enemy.nextAttackAt = now + (enemy.elite ? 1550 : 1850);
        const ranged = enemy.attackStyle === 'ranged' || (enemy.attackRange ?? 0) > 65;
        const damage = ranged
          ? DamageSystem.magicalDamage(character, enemy.attackDamage ?? 5 + enemy.level * 2)
          : DamageSystem.physicalDamage(character, enemy.attackDamage ?? 5 + enemy.level * 2, Math.random, now);
        if (!damage.dodged) character.currentLife = Math.max(0, character.currentLife - damage.damage);
        this.emit('monsterAttack', { playerId: player.id, monsterId: enemy.id, damage: damage.damage ?? 0, dodged: Boolean(damage.dodged), x: player.position.x, y: player.position.y });
        if (character.currentLife <= 0) {
          DeathSystem.respawnInTown(character, enemy.name, now);
          player.position = { x: 0, y: 0 };
          player.gather = null;
          this.emit('respawn', { playerId: player.id, cause: enemy.name });
        }
      }
      this.pointStates[enemy.id] = { x: enemy.x, y: enemy.y, hp: enemy.hp, aggroUntil: enemy.aggroUntil ?? 0, tauntUntil: enemy.tauntUntil ?? 0, nextAttackAt: enemy.nextAttackAt ?? 0 };
    }
  }

  defeatMonster(player, enemy) {
    const dungeonEnemy = Boolean(enemy?.dungeonInstance);
    if (!enemy || enemy.dead || (!dungeonEnemy && !this.points.has(enemy.id))) return;
    enemy.dead = true;
    this.points.delete(enemy.id);
    if (!dungeonEnemy) {
      delete this.pointStates[enemy.id];
      this.worldFlags[enemy.id] = true;
    }
    player.character.modifications[enemy.id] = true;
    player.character.defeatedSlimes = (player.character.defeatedSlimes ?? 0) + 1;
    const xp = enemy.elite ? 220 : enemy.monsterId === 'orc' ? 48 + enemy.level * 2 : enemy.monsterId === 'goblin' ? 35 + enemy.level : 35 + (enemy.level - 1) * 8;
    const levels = ProgressionSystem.grantXp(player.character, xp);
    const drops = {};
    for (const [id, range] of Object.entries(enemy.drops ?? {})) drops[id] = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
    for (const [id, amount] of Object.entries(drops)) player.character.resources[id] = (player.character.resources[id] ?? 0) + amount;
    this.emit('defeat', { playerId: player.id, monsterId: enemy.id, x: enemy.x, y: enemy.y, xp, levels, drops });
    this.sessions.set(player.token, { character: player.character, createdAt: this.sessions.get(player.token)?.createdAt ?? this.now() });
    if (dungeonEnemy) {
      this.dungeonEnemies = this.dungeonEnemies.filter((current) => current.id !== enemy.id);
      if (this.dungeonEnemies.length === 0) this.advanceDungeon();
    }
  }

  collectResource(player, point) {
    if (!player || !point || this.points.get(point.id) !== point || this.worldFlags[point.id]) return false;
    if (distance(player.position, point) > 40 || !ResourceSystem.collect(player.character, point)) return false;
    this.worldFlags[point.id] = true;
    this.points.delete(point.id);
    this.emit('gather', { playerId: player.id, pointId: point.id, resource: point.resource, amount: point.amount, x: point.x, y: point.y });
    this.sessions.set(player.token, { character: player.character, createdAt: this.sessions.get(player.token)?.createdAt ?? this.now() });
    return true;
  }

  separatePlayers() {
    const players = [...this.players.values()];
    for (let i = 0; i < players.length; i += 1) for (let j = i + 1; j < players.length; j += 1) {
      const a = players[i]; const b = players[j];
      const dx = b.position.x - a.position.x; const dy = b.position.y - a.position.y;
      const d = Math.hypot(dx, dy) || 0.001;
      if (d >= 28) continue;
      const push = (28 - d) / 2;
      a.position.x -= dx / d * push; a.position.y -= dy / d * push;
      b.position.x += dx / d * push; b.position.y += dy / d * push;
      a.character.position = { ...a.position }; b.character.position = { ...b.position };
    }
  }

  snapshotFor(player) {
    const nearby = [...this.pointsNear(player.position).filter((point) => point.kind === 'monster' || point.kind === 'slime'), ...(this.dungeonParticipantIds.has(player.id) ? this.dungeonEnemies : [])];
    const center = player.position;
    const radius = 1500;
    const players = [...this.players.values()].filter((other) => distance(center, other.position) <= radius).map((other) => ({ id: other.id, name: other.character.name, classId: other.character.classId, x: other.position.x, y: other.position.y, facing: other.facing, level: other.character.level, currentLife: other.character.currentLife, maxLife: StatsSystem.derived(other.character).maxLife }));
    const chunks = new Set();
    const cx = Math.floor(center.x / CHUNK_SIZE); const cy = Math.floor(center.y / CHUNK_HEIGHT);
    for (let x = cx - 1; x <= cx + 1; x += 1) for (let y = cy - 1; y <= cy + 1; y += 1) chunks.add(`${x},${y}`);
    const worldFlags = Object.fromEntries(Object.entries(this.worldFlags).filter(([id]) => [...chunks].some((key) => id.startsWith(`${key}:`))));
    const dungeon = this.dungeonParticipantIds.has(player.id) && this.dungeonSystem.active ? { active: true, x: this.dungeonAnchor.x, y: this.dungeonAnchor.y, wave: this.dungeonSystem.run.wave + 1, waveName: this.dungeonSystem.run.waveName, enemies: this.dungeonEnemies.length } : null;
    return { type: 'state', worldSeed: this.worldSeed, self: publicCharacter(player.character), skillStates: player.combat.getSkillStates(player.character, this.now()), players, monsters: nearby.map(publicMonster), worldFlags, dungeon, events: this.events.filter((event) => !event.playerId || event.playerId === player.id || players.some((other) => other.id === event.playerId)) };
  }

  enterDungeon(leader, dungeonId, solo) {
    if (this.dungeonSystem.active) { this.emit('dungeonError', { playerId: leader.id, message: 'Já existe uma expedição cooperativa ativa neste mundo.' }); return; }
    const dungeon = DUNGEONS.find((entry) => entry.id === dungeonId);
    if (!dungeon) { this.emit('dungeonError', { playerId: leader.id, message: 'Dungeon inválida.' }); return; }
    const members = solo ? [leader] : [...this.players.values()].filter((player) => player.partyId && player.partyId === leader.partyId && player.character.status === 'alive' && distance(player.position, leader.position) <= 600);
    if (!solo && members.length !== dungeon.partySize) {
      this.emit('dungeonError', { playerId: leader.id, message: `A dungeon exige exatamente ${dungeon.partySize} jogadores conectados e próximos; encontrados ${members.length}.` });
      return;
    }
    if (members.some((member) => member.character.level < dungeon.level || BiomeSystem.isSafe(member.position.x, member.position.y))) {
      this.emit('dungeonError', { playerId: leader.id, message: `Todos os integrantes precisam estar fora da Cidade Segura e no nível ${dungeon.level} ou superior.` });
      return;
    }
    const validation = this.dungeonSystem.enter(dungeonId, leader.character, solo ? null : { members: members.map((member) => member.character) }, this.now());
    if (!validation.allowed) { this.emit('dungeonError', { playerId: leader.id, message: validation.reason }); return; }
    this.dungeonParticipantIds = new Set(members.map((member) => member.id));
    this.dungeonAnchor = { ...leader.position };
    this.dungeonEnemies = validation.enemies.map((enemy) => ({ ...enemy, dungeonInstance: true }));
    this.emit('dungeonStart', { playerId: leader.id, solo, participantIds: [...this.dungeonParticipantIds], x: this.dungeonAnchor.x, y: this.dungeonAnchor.y, wave: 1, waveName: this.dungeonSystem.run.waveName });
  }

  advanceDungeon() {
    const leader = [...this.dungeonParticipantIds].map((id) => this.players.get(id)).find(Boolean);
    if (!leader) { this.dungeonSystem.fail(this.now()); this.dungeonParticipantIds.clear(); this.dungeonAnchor = null; return; }
    const next = this.dungeonSystem.advance(leader.character, this.now());
    if (next.done) {
      for (const id of this.dungeonParticipantIds) {
        const player = this.players.get(id);
        if (!player) continue;
        player.character.dungeonCompletions = (player.character.dungeonCompletions ?? 0) + 1;
        player.character.resources.batWing = (player.character.resources.batWing ?? 0) + 16;
        player.character.resources.batFang = (player.character.resources.batFang ?? 0) + 10;
        player.character.resources.arcaneFragments = (player.character.resources.arcaneFragments ?? 0) + 4;
        ProgressionSystem.grantXp(player.character, 220);
        this.sessions.set(player.token, { character: player.character, createdAt: this.sessions.get(player.token)?.createdAt ?? this.now() });
      }
      this.emit('dungeonComplete', { participantIds: [...this.dungeonParticipantIds] });
      this.dungeonParticipantIds.clear(); this.dungeonAnchor = null; this.dungeonEnemies = [];
      return;
    }
    this.dungeonEnemies = next.enemies.map((enemy) => ({ ...enemy, dungeonInstance: true }));
    this.emit('dungeonWave', { participantIds: [...this.dungeonParticipantIds], wave: this.dungeonSystem.run.wave + 1, waveName: next.waveName, enemies: this.dungeonEnemies.length });
  }

  broadcastSnapshots() {
    for (const player of this.players.values()) {
      if (player.socket.readyState !== 1) continue;
      player.socket.send(JSON.stringify(this.snapshotFor(player)));
    }
  }

  emit(type, data) { this.events.push({ type, ...data, at: this.now() }); }
}

export function attachMultiplayer(server, { stateFile = path.resolve('data/multiplayer-world.json'), seed = process.env.WORLD_SEED || randomUUID(), now = () => Date.now(), findParty = () => null } = {}) {
  const world = new AuthoritativeWorld({ stateFile, seed, now });
  const webSockets = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  server.on('upgrade', (request, socket, head) => {
    let pathname;
    try { pathname = new URL(request.url, 'http://localhost').pathname; }
    catch { socket.destroy(); return; }
    if (pathname !== '/ws') { socket.destroy(); return; }
    if (request.headers.origin) {
      try {
        const origin = new URL(request.headers.origin);
        if (origin.host !== request.headers.host || !['http:', 'https:'].includes(origin.protocol)) { socket.destroy(); return; }
      } catch { socket.destroy(); return; }
    }
    webSockets.handleUpgrade(request, socket, head, (client) => webSockets.emit('connection', client, request));
  });
  webSockets.on('connection', (socket) => {
    let player = null;
    socket.on('message', (raw) => {
      let message;
      try { message = JSON.parse(raw.toString()); }
      catch { return; }
      if (!player && message.type === 'join') {
        const result = world.join(socket, message);
        if (result.error) { socket.close(1013, result.error); return; }
        player = result.player;
        const party = findParty(String(message.party?.id ?? ''));
        const provided = Buffer.from(String(message.party?.invite ?? ''));
        const expected = Buffer.from(String(party?.invite ?? randomUUID()));
        if (party && provided.length === expected.length && timingSafeEqual(provided, expected)) player.partyId = party.id;
        socket.send(JSON.stringify({ type: 'welcome', id: player.id, sessionToken: result.token, worldSeed: world.worldSeed, character: publicCharacter(player.character), state: world.snapshotFor(player) }));
        world.broadcastSnapshots();
        return;
      }
      if (player) world.handle(player, message, findParty);
    });
    socket.on('close', () => { if (player) { world.disconnect(player); world.broadcastSnapshots(); } });
    socket.on('error', () => {});
  });
  const timer = setInterval(() => world.tick(TICK_MS), TICK_MS);
  timer.unref?.();
  const heartbeat = setInterval(() => {
    for (const socket of webSockets.clients) {
      if (socket.isAlive === false) { socket.terminate(); continue; }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);
  heartbeat.unref?.();
  webSockets.on('connection', (socket) => socket.on('pong', () => { socket.isAlive = true; }));
  server.on('close', () => {
    clearInterval(timer);
    clearInterval(heartbeat);
    world.persist(true);
    for (const socket of webSockets.clients) socket.close(1001, 'Servidor encerrado');
    webSockets.close();
  });
  return { webSockets, world, get sockets() { return world.players; }, get worldSeed() { return world.worldSeed; } };
}

function publicCharacter(character) { return structuredClone(character); }
function publicMonster(point) { return { id: point.id, kind: point.kind, monsterId: point.monsterId, variant: point.variant, name: point.name, x: point.x, y: point.y, level: point.level, hp: point.hp, maxHp: point.maxHp, dead: point.dead, elite: point.elite, radius: point.radius }; }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(value, minimum, maximum) { return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : minimum; }
function cleanName(value) { return String(value ?? 'Aventureiro').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 18) || 'Aventureiro'; }

function migrateCharacter(source, name, classId, seed, now) {
  const character = createCharacter(name, classId, seed, now);
  if (!source || typeof source !== 'object') return character;
  const maxLevel = 100;
  character.level = Math.floor(clamp(Number(source.level), 1, maxLevel));
  character.xpToNext = Math.floor(30 * Math.pow(character.level, 1.35));
  character.xp = Math.floor(clamp(Number(source.xp), 0, character.xpToNext - 1));
  const earnedAttributePoints = (character.level - 1) * 3;
  const baseStats = CLASS_CATALOG[classId].baseStats;
  const attributes = { ...baseStats };
  for (const attribute of VALID_ATTRIBUTES) {
    const maximum = baseStats[attribute] + earnedAttributePoints;
    attributes[attribute] = Math.floor(clamp(Number(source.attributes?.[attribute]), baseStats[attribute], maximum));
  }
  const usedAttributePoints = [...VALID_ATTRIBUTES].reduce((sum, attribute) => sum + attributes[attribute] - baseStats[attribute], 0);
  if (usedAttributePoints > earnedAttributePoints) Object.assign(attributes, baseStats);
  character.attributes = { ...character.attributes, ...attributes };
  character.unspentPoints = Math.max(0, earnedAttributePoints - [...VALID_ATTRIBUTES].reduce((sum, attribute) => sum + attributes[attribute] - baseStats[attribute], 0));

  const validAffixes = {
    criticalChance: [2, 8], criticalDamage: [8, 25], magicDamage: [3, 12], accuracy: [2, 9], attackSpeed: [2, 7],
    armorPenetration: [1, 5], lifeSteal: [1, 4], magicDefense: [1, 5], maxLife: [4, 12], maxMana: [4, 15],
    evasion: [1, 6], physicalDefense: [1, 5], manaRegeneration: [5, 25]
  };
  const qualities = new Set(['Comum', 'Aprimorada', 'Rara', 'Perfeita']);
  character.weapons = (Array.isArray(source.weapons) ? source.weapons : []).slice(0, 40).flatMap((item, index) => {
    const recipe = RECIPES[item?.id] ? RECIPES[item.id] : Object.values(RECIPES).find((entry) => entry.kind === item?.kind);
    if (!recipe || recipe.allowedClasses && !recipe.allowedClasses.includes(classId)) return [];
    const affixes = (Array.isArray(item.affixes) ? item.affixes : []).slice(0, 3).flatMap((affix) => {
      const range = validAffixes[affix?.stat];
      if (!range || !Number.isFinite(affix.value) || affix.value < range[0] || affix.value > range[1]) return [];
      return [{ id: String(affix.id ?? '').slice(0, 24), name: cleanName(affix.name), stat: affix.stat, value: Math.floor(affix.value), unit: String(affix.unit ?? '').slice(0, 2) }];
    });
    return [{ ...recipe, id: `migrated-${index}-${randomUUID()}`, name: cleanName(item.name ?? recipe.name), quality: qualities.has(item.quality) ? item.quality : 'Comum', damage: Math.floor(clamp(Number(item.damage), recipe.damage, Math.ceil(recipe.damage * 1.5))), affixes, classWeapon: CLASS_CATALOG[classId].weaponKind, createdAt: Math.floor(clamp(Number(item.createdAt), 0, now)) }];
  });
  const weaponIds = new Set(character.weapons.map((weapon) => weapon.id));
  character.equipment = Object.fromEntries(Object.entries(source.equipment ?? {}).filter(([slot, id]) => ['mainHand', 'offHand', 'head', 'chest', 'cape', 'ring1', 'ring2', 'necklace', 'boots', 'gloves'].includes(slot) && weaponIds.has(id)));
  const equipped = weaponIds.has(source.equippedWeaponId) ? source.equippedWeaponId : null;
  character.equippedWeaponId = equipped;
  if (equipped && !character.equipment.mainHand) character.equipment.mainHand = equipped;
  character.resources = Object.fromEntries(Object.keys(RESOURCE_CATALOG).map((id) => [id, Math.floor(clamp(Number(source.resources?.[id]), 0, 100000))]));
  character.skillLevels = {};
  if (classId === 'warrior') {
    const skillIds = ['warriorWhirlwind', 'warriorWarCry', 'warriorIronWill', 'warriorChains'];
    let usedSkillPoints = 0;
    for (const id of skillIds) {
      const rank = Math.floor(clamp(Number(source.skillLevels?.[id]), 1, 10));
      character.skillLevels[id] = rank;
      usedSkillPoints += rank - 1;
    }
    if (usedSkillPoints > character.level - 1) character.skillLevels = Object.fromEntries(skillIds.map((id) => [id, 1]));
    usedSkillPoints = Object.values(character.skillLevels).reduce((sum, rank) => sum + rank - 1, 0);
    character.skillPoints = Math.max(0, character.level - 1 - usedSkillPoints);
  }
  character.autoEnabled = source.autoEnabled !== false;
  character.autoPotion = {
    hpEnabled: source.autoPotion?.hpEnabled !== false,
    manaEnabled: source.autoPotion?.manaEnabled !== false,
    hpThreshold: clamp(Number(source.autoPotion?.hpThreshold ?? 60), 10, 90),
    manaThreshold: clamp(Number(source.autoPotion?.manaThreshold ?? 35), 10, 90)
  };
  character.exploredChunks = Array.isArray(source.exploredChunks) ? source.exploredChunks.filter((key) => typeof key === 'string' && /^-?\d+,-?\d+$/.test(key)).slice(0, 5000) : ['0,0'];
  character.modifications = {};
  character.defeatedSlimes = Math.floor(clamp(Number(source.defeatedSlimes), 0, 1000000));
  character.dungeonCompletions = Math.floor(clamp(Number(source.dungeonCompletions), 0, 100000));
  const stats = StatsSystem.derived(character);
  character.currentLife = Math.floor(clamp(Number(source.currentLife ?? stats.maxLife), 1, stats.maxLife));
  character.currentMana = Math.floor(clamp(Number(source.currentMana ?? stats.maxMana), 0, stats.maxMana));
  return character;
}
