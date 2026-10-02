import * as Phaser from 'phaser';
import { AutoCombatSystem } from '../ai/AutoCombatSystem.js';
import { CombatSystem } from '../combat/CombatSystem.js';
import { DamageSystem } from '../combat/DamageSystem.js';
import { StatsSystem } from '../stats/StatsSystem.js';
import { DeathSystem } from '../combat/DeathSystem.js';
import { PotionSystem } from '../combat/PotionSystem.js';
import { DungeonSystem } from '../combat/DungeonSystem.js';
import { ProgressionSystem } from '../progression/ProgressionSystem.js';
import { ResourceSystem } from '../resources/ResourceSystem.js';
import { RESOURCE_CATALOG } from '../inventory/Inventory.js';
import { WorldGenerator, CHUNK_HEIGHT, CHUNK_SIZE } from '../world/WorldGenerator.js';
import { ChunkManager } from '../world/ChunkManager.js';
import { BiomeSystem } from '../world/BiomeSystem.js';
import { CLASS_CATALOG } from '../classes/classCatalog.js';
import { PlayerEntity } from '../entities/PlayerEntity.js';
import { FloatingWeapon } from '../rendering/FloatingWeapon.js';
import { ProceduralRenderer } from '../rendering/ProceduralRenderer.js';
import { EffectRenderer } from '../rendering/EffectRenderer.js';
import { AudioSystem } from '../combat/AudioSystem.js';
import { MELEE_ATTACK_RANGE, RANGED_ATTACK_RANGE } from '../skills/WarriorSkills.js';

export class GameplayScene extends Phaser.Scene {
  constructor({ getCharacter, ui, save, audio = new AudioSystem(), multiplayer = null }) {
    super('GameplayScene');
    this.getCharacter = getCharacter; this.ui = ui; this.save = save;
    this.ai = new AutoCombatSystem(); this.combat = new CombatSystem();
    this.dungeonSystem = new DungeonSystem(); this.dungeonEnemies = [];
    this.audio = audio;
    this.multiplayer = multiplayer;
    this.remotePlayers = new Map();
    this.worldSeed = null;
    this.lastWorldUpdate = 0; this.lastAttack = 0; this.lastSave = 0; this.lastRender = 0; this.lastPointUpdate = 0; this.lastEnemyAttack = 0;
    this.lastChunkUpdate = 0; this.lastEnemyAiUpdate = 0; this.lastTargetUpdate = 0;
    this.lastFootstep = 0;
    this.lastLightingUpdate = 0;
    this.lastClockUpdate = 0;
    this.gathering = null;
    this.playerEntity = null; this.floatingWeapon = null;
    this.currentTarget = null; this.cachedWorldPoints = []; this.loadedChunks = [];
  }
  create() {
    this.audio.unlock(); this.audio.startAmbient();
    this.cameras.main.setBackgroundColor('#425c3e');
    this.cameras.main.setZoom(0.5);
    this.generator = new WorldGenerator(this.getCharacter()?.seed ?? 'waiting-for-character');
    this.chunks = new ChunkManager(this.generator, 1);
    this.renderer = new ProceduralRenderer(this, this.generator.seed);
    this.effects = new EffectRenderer(this);
    this.nightOverlay = this.add.graphics().setScrollFactor(0).setDepth(1000000);
    this.lightGraphics = this.add.graphics().setDepth(1000001);
    this.nightVeil = document.createElement('canvas');
    this.nightVeil.className = 'night-veil';
    const gameContainer = document.querySelector('#game-container');
    gameContainer.insertBefore(this.nightVeil, gameContainer.querySelector('.canvas-vignette'));
    this.nightContext = this.nightVeil.getContext('2d');
    this.worldClock = { syncedAt: Date.now(), serverTime: Date.now(), dayLength: 20 * 60 * 1000 };
    this.worldClockDetails = BiomeSystem.clockAt(Date.now(), this.worldClock.dayLength);
    this.syncWorldClock();
    this.time.addEvent({ delay: 60000, loop: true, callback: () => this.syncWorldClock() });
    this.events.on('resize', (size) => this.cameras.main.setSize(size.width, size.height));
    this.events.once('shutdown', () => this.multiplayer?.disconnect());
    const character = this.getCharacter();
    if (character?.status === 'alive') this.startCharacter(character);
    this.updateWorld(true);
    this.ui.setGameReady();
    window.dispatchEvent(new Event('farm-game-ready'));
  }
  startCharacter(character) {
    if (this.playerEntity) { this.playerEntity.destroy(); this.floatingWeapon?.destroy(); }
    this.renderer?.destroy();
    if (!character) {
      this.multiplayer?.disconnect();
      this.clearRemotePlayers();
      if (this.dungeonSystem.active) this.dungeonSystem.fail();
      this.clearDungeonRoom();
      this.dungeonEnemies = [];
      this.ui.setDungeonProgress('', 0, false);
      this.playerEntity = null;
      this.floatingWeapon = null;
      this.cameras.main.stopFollow();
      this.generator = new WorldGenerator('waiting-for-character');
      this.chunks = new ChunkManager(this.generator, 1);
      this.renderer = new ProceduralRenderer(this, this.generator.seed);
      this.updateWorld(true);
      return;
    }
    this.combat = new CombatSystem();
    this.dungeonSystem = new DungeonSystem();
    this.lastAttack = 0;
    this.lastEnemyAttack = 0;
    character.currentMana ??= StatsSystem.derived(character).maxMana;
    character.potionCooldowns = { hp: 0, mana: 0 };
    character.facing ??= 1;
    character.autoEnabled = true;
    character.autoPotion ??= { hpEnabled: true, manaEnabled: true, hpThreshold: 60, manaThreshold: 35 };
    this.multiplayer?.connect(character);
    this.generator = new WorldGenerator(this.worldSeed ?? character.seed);
    this.chunks = new ChunkManager(this.generator, 1);
    this.renderer = new ProceduralRenderer(this, character.seed);
    this.playerEntity = new PlayerEntity(this, character);
    this.floatingWeapon = new FloatingWeapon(this, character);
    const { x, y } = character.position;
    this.playerEntity.setPosition(x, y);
    this.cameras.main.startFollow(this.playerEntity.body, false, 0.08, 0.08);
    this.audio.startAmbient();
    this.ui.setAlive(); this.updateWorld(true);
    this.ui.log(`${character.name} nasceu no centro do mundo.`, 'good');
  }
  setMultiplayerWelcome(message) {
    if (!message?.worldSeed) return;
    this.worldSeed = message.worldSeed;
    const ownPlayer = message.players?.find((player) => player.id === message.id);
    const character = this.getCharacter();
    if (character && ownPlayer) character.position = { x: ownPlayer.x, y: ownPlayer.y };
    this.renderer?.destroy();
    this.generator = new WorldGenerator(this.worldSeed);
    this.chunks = new ChunkManager(this.generator, 1);
    this.renderer = new ProceduralRenderer(this, this.worldSeed);
    this.updateWorld(true);
    this.setMultiplayerPlayers(message.players ?? []);
  }
  setMultiplayerPlayers(players) {
    const ownId = this.multiplayer?.clientId;
    const character = this.getCharacter();
    const ownPlayer = players.find((player) => player.id === ownId);
    if (character && ownPlayer && Math.hypot(character.position.x - ownPlayer.x, character.position.y - ownPlayer.y) > 28) {
      character.position = { x: ownPlayer.x, y: ownPlayer.y };
      this.playerEntity?.setPosition(ownPlayer.x, ownPlayer.y);
    }
    const present = new Set(players.filter((player) => player.id !== ownId).map((player) => player.id));
    for (const [id, remote] of this.remotePlayers) {
      if (present.has(id)) continue;
      remote.label.destroy();
      remote.weapon.destroy();
      remote.entity.destroy();
      this.remotePlayers.delete(id);
    }
    for (const player of players) {
      if (player.id === ownId || !Number.isFinite(player.x) || !Number.isFinite(player.y)) continue;
      let remote = this.remotePlayers.get(player.id);
      if (!remote) {
        const character = { id: player.id, name: player.name, classId: player.classId, weapons: [], equippedWeaponId: null, facing: player.facing ?? 1 };
        const entity = new PlayerEntity(this, character);
        const weapon = new FloatingWeapon(this, character);
        const label = this.add.text(player.x, player.y - 42, player.name, { fontFamily: 'Space Grotesk, sans-serif', fontSize: '10px', color: '#f2f0d5', stroke: '#142016', strokeThickness: 3 }).setOrigin(0.5).setDepth(player.y + 30);
        remote = { character, entity, weapon, label, targetX: player.x, targetY: player.y };
        this.remotePlayers.set(player.id, remote);
      }
      remote.character.facing = player.facing ?? 1;
      remote.targetX = player.x;
      remote.targetY = player.y;
      remote.label.setText(player.name);
    }
  }
  clearRemotePlayers() {
    for (const remote of this.remotePlayers.values()) {
      remote.label.destroy();
      remote.weapon.destroy();
      remote.entity.destroy();
    }
    this.remotePlayers.clear();
  }
  update(_time, delta) {
    const character = this.getCharacter();
    if (!character || character.status !== 'alive' || !this.playerEntity) return;
    const now = this.time.now;
    const currentChunk = this.generator.chunkKey(Math.floor(character.position.x / CHUNK_SIZE), Math.floor(character.position.y / CHUNK_HEIGHT));
    const chunkChanged = currentChunk !== this.currentChunkKey;
    if (chunkChanged || now - this.lastChunkUpdate >= 180) {
      this.loadedChunks = this.chunks.update(character.position, character.modifications);
      this.cachedWorldPoints = this.loadedChunks.flatMap((chunk) => chunk.points).filter((point) => !point.dead && !point.collected);
      this.currentChunkKey = currentChunk;
      this.lastChunkUpdate = now;
      if (chunkChanged) this.renderer.render(this.loadedChunks);
    }
    const chunks = this.loadedChunks;
    character.exploredChunks ??= ['0,0'];
    if (!character.exploredChunks.includes(currentChunk)) character.exploredChunks.push(currentChunk);
    const points = this.cachedWorldPoints;
    const playerBiomeId = BiomeSystem.at(character.position.x, character.position.y).id;
    const biomePoints = points.filter((point) => !point.monsterId || point.dungeonInstance || (point.biomeId ?? BiomeSystem.at(point.x, point.y).id) === playerBiomeId);
    const insideSafeTown = BiomeSystem.isSafe(character.position.x, character.position.y);
    const resourceStats = StatsSystem.derived(character);
    character.currentLife = Math.min(resourceStats.maxLife, character.currentLife ?? resourceStats.maxLife);
    character.currentMana = Math.min(resourceStats.maxMana, (character.currentMana ?? resourceStats.maxMana) + delta / 1000 * resourceStats.manaRegeneration);
    if (insideSafeTown && this.dungeonSystem.active) {
      this.dungeonSystem.fail();
      this.dungeonEnemies.forEach((enemy) => this.renderer.removePoint(enemy.id));
      this.dungeonEnemies = [];
      this.clearDungeonRoom();
      this.ui.setDungeonProgress('', 0, false);
      this.ui.log('Você retornou à Cidade Segura; a expedição foi encerrada.', 'danger');
    }
    if (now - this.lastEnemyAiUpdate >= 80) {
      this.updateEngagedEnemies(insideSafeTown ? [] : [...biomePoints, ...this.dungeonEnemies], character, now, Math.min(delta + now - this.lastEnemyAiUpdate, 120));
      this.lastEnemyAiUpdate = now;
    }
    if (character.status !== 'alive') return;
    this.updatePotions(character, now);
    if (now - this.lastClockUpdate >= 1000) {
      const serverNow = this.worldClock.serverTime + (Date.now() - this.worldClock.syncedAt);
      this.worldClockDetails = BiomeSystem.clockAt(serverNow, this.worldClock.dayLength);
      this.ui.setServerClock(this.worldClockDetails);
      this.lastClockUpdate = now;
    }
    this.updateWorldLighting(now, chunks);
    const monsterModifiers = BiomeSystem.monsterModifiers(this.worldClockDetails);
    const nearbyAggressor = insideSafeTown ? null : biomePoints.filter((point) => (point.kind === 'monster' || point.kind === 'slime') && !point.dead && ((point.aggroUntil ?? 0) > now || Math.hypot(point.x - character.position.x, point.y - character.position.y) <= (point.aggroRange ?? 210) * monsterModifiers.aggro)).sort((a, b) => Math.hypot(a.x - character.position.x, a.y - character.position.y) - Math.hypot(b.x - character.position.x, b.y - character.position.y))[0];
    let target = nearbyAggressor ?? this.currentTarget;
    if (this.gathering && (nearbyAggressor || this.gathering.point.dead || this.gathering.point.collected)) this.cancelGathering(nearbyAggressor ? 'Inimigo detectado: coleta interrompida.' : null);
    if (chunkChanged || now - this.lastTargetUpdate >= 100 || target?.dead || target?.collected || (insideSafeTown && target && target.kind !== 'resource') || (target?.monsterId && !target.dungeonInstance && target.biomeId !== playerBiomeId)) {
      const activeEnemies = insideSafeTown ? [] : [...biomePoints.filter((point) => point.kind === 'monster' || point.kind === 'slime'), ...this.dungeonEnemies.filter((point) => !point.dead)];
      target = nearbyAggressor ?? (character.autoEnabled ? this.ai.movementTarget(character.position, activeEnemies, biomePoints.filter((point) => point.kind === 'resource'), now) : null);
      if (this.dungeonSystem.active && character.autoEnabled && this.dungeonEnemies.some((enemy) => !enemy.dead)) target = this.ai.chooseTarget(character.position, this.dungeonEnemies);
      this.currentTarget = target;
      this.lastTargetUpdate = now;
    }
    let attacking = false;
    let moving = false;
    let collecting = false;
    if (character.autoEnabled === false) {
      this.playerEntity.setPosition(character.position.x, character.position.y);
      this.playerEntity.update(now, false);
      this.floatingWeapon.update(now, character.position.x, character.position.y, false);
      this.multiplayer?.sendPosition(character.position.x, character.position.y, character.facing, Date.now());
      if (now - this.lastRender > 250) {
        this.ui.render(character, BiomeSystem.at(character.position.x, character.position.y), chunks.length, this.combat.getSkillStates(character, now), chunks);
        this.lastRender = now;
      }
      if (now - this.lastSave > 2500) { this.save(); this.lastSave = now; }
      return;
    }
    if (this.gathering && !nearbyAggressor) {
      const gather = this.gathering;
      const gatherDistance = Math.hypot(gather.point.x - character.position.x, gather.point.y - character.position.y);
      if (gatherDistance > 42) this.cancelGathering();
      else {
        collecting = true;
        gather.progress = Math.min(1, (now - gather.startedAt) / gather.duration);
        this.effects.updateGatherBar(gather.bar, gather.progress);
        if (now - gather.lastToolAt >= 720) {
          this.effects.gatherTool(character.position.x, character.position.y, gather.point.resource, now);
          this.audio.playGather(gather.point.resource);
          gather.lastToolAt = now;
        }
        if (gather.progress >= 1) {
          const point = gather.point;
          this.cancelGathering();
          this.completeGather(point);
          this.currentTarget = null;
        }
      }
    }
    if (!collecting && target) {
      const distance = Math.hypot(target.x - character.position.x, target.y - character.position.y);
      const attackRange = RANGED_ATTACK_RANGE[character.classId] ?? MELEE_ATTACK_RANGE;
      const reach = target.kind === 'resource' ? 28 : attackRange;
      if (distance <= reach) {
        if (target.kind === 'resource') { this.beginGathering(target, now); collecting = true; }
        else {
          const attackSpeed = StatsSystem.derived(character).attackSpeed;
          const attackCooldown = Math.max(360, 900 / (1 + attackSpeed / 100));
          if (now - this.lastAttack > attackCooldown) { this.attack(target, now); attacking = true; }
        }
      } else {
        const baseSpeed = target.kind === 'resource' ? 78 : (target.speed ?? 78) * 1.2;
        const speed = baseSpeed * 1.5;
        const step = Math.min(distance - reach * 0.72, speed * Math.min(delta, 50) / 1000);
        const directionX = target.x - character.position.x;
        const directionY = target.y - character.position.y;
        if (Math.abs(directionX) > 0.0001 || Math.abs(directionY) > 0.0001) {
          character.facing = directionX >= 0 ? 1 : -1;
        }
        character.position.x += (directionX / distance) * step;
        character.position.y += (directionY / distance) * step;
        moving = step > 0;
      }
    } else if (!collecting && character.autoEnabled) {
      const drift = 44 * Math.min(delta, 50) / 1000;
      character.position.x += drift;
      character.position.y += Math.sin(now / 2100) * drift * 0.32;
      moving = true;
    }
    const obstacles = points.filter((point) => point.kind === 'obstacle' && point.collisionRadius);
    if (moving && this.collidesWithObstacle(character.position.x, character.position.y, obstacles)) {
      const angle = Math.atan2(target?.y - character.position.y || 0, target?.x - character.position.x || 1);
      const sideStep = 55 * Math.min(delta, 50) / 1000;
      const side = Math.sin(now / 720) >= 0 ? 1 : -1;
      const alternatives = [angle + side * Math.PI * 0.55, angle - side * Math.PI * 0.55, angle + Math.PI];
      let found = false;
      for (const alternate of alternatives) {
        const candidate = { x: character.position.x + Math.cos(alternate) * sideStep, y: character.position.y + Math.sin(alternate) * sideStep };
        if (!this.collidesWithObstacle(candidate.x, candidate.y, obstacles)) { character.position = candidate; found = true; break; }
      }
      if (!found) moving = false;
    }
    this.resolveCharacterCollisions(character, [...biomePoints.filter((point) => (point.kind === 'monster' || point.kind === 'slime')), ...this.dungeonEnemies]);
    const moved = this.playerEntity.body;
    this.playerEntity.body.setScale(character.facing ?? 1, 1);
    this.playerEntity.setPosition(character.position.x, character.position.y);
    this.playerEntity.update(now, moving);
    this.floatingWeapon.update(now, character.position.x, character.position.y, attacking);
    if (moving && now - this.lastFootstep > 390) { this.audio.playFootstep(); this.lastFootstep = now; }
    if (now - this.lastPointUpdate > 250) {
      for (const point of points) {
        if (point.kind === 'monster' || point.kind === 'slime' || point.resource === 'wood' || point.feature === 'lake' || point.feature === 'campfire') this.renderer.updatePoint(point);
      }
      for (const enemy of this.dungeonEnemies) this.renderer.updatePoint(enemy);
      this.lastPointUpdate = now;
    }
    if (now - this.lastRender > 300) {
      const biome = BiomeSystem.at(character.position.x, character.position.y);
      this.ui.render(character, biome, this.chunks.loaded.size, this.combat.getSkillStates(character, now), chunks);
      this.lastRender = now;
    }
    if (now - this.lastSave > 2500) { this.save(); this.lastSave = now; }
    if (moved) moved.setDepth(character.position.y + 10);
    this.multiplayer?.sendPosition(character.position.x, character.position.y, character.facing, Date.now());
    for (const remote of this.remotePlayers.values()) {
      const x = Phaser.Math.Linear(remote.entity.body.x, remote.targetX, 0.32);
      const y = Phaser.Math.Linear(remote.entity.body.y, remote.targetY, 0.32);
      remote.character.facing = remote.character.facing < 0 ? -1 : 1;
      remote.entity.setPosition(x, y);
      remote.entity.body.setScale(remote.character.facing, 1);
      remote.entity.update(now, Math.hypot(remote.targetX - x, remote.targetY - y) > 3);
      remote.weapon.update(now, x, y, false);
      remote.label.setPosition(x, y - 42).setDepth(y + 30);
    }
  }
  collidesWithObstacle(x, y, obstacles) {
    return obstacles.some((obstacle) => Math.hypot(x - obstacle.x, y - obstacle.y) < obstacle.collisionRadius + 10);
  }
  resolveCharacterCollisions(character, enemies) {
    if (!character || !Array.isArray(enemies)) return;
    const playerRadius = 14;
    for (const enemy of enemies) {
      if (!enemy || enemy.dead || enemy.collected) continue;
      const dx = character.position.x - enemy.x;
      const dy = character.position.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 0.0001;
      const minDistance = (enemy.radius ?? 15) + playerRadius;
      if (distance >= minDistance) continue;
      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = minDistance - distance;
      character.position.x += nx * overlap * 0.55;
      character.position.y += ny * overlap * 0.55;
      enemy.x -= nx * overlap * 0.45;
      enemy.y -= ny * overlap * 0.45;
    }
  }
  updatePotions(character, now) {
    const settings = character.autoPotion ?? { hpEnabled: false, manaEnabled: false, hpThreshold: 35, manaThreshold: 20 };
    const stats = StatsSystem.derived(character);
    if (settings.hpEnabled && character.currentLife / stats.maxLife * 100 <= settings.hpThreshold) this.usePotion('hp');
    if (settings.manaEnabled && character.currentMana / stats.maxMana * 100 <= settings.manaThreshold) this.usePotion('mana');
  }
  beginGathering(point, now) {
    if (this.gathering?.point.id === point.id) return;
    this.cancelGathering();
    this.gathering = { point, startedAt: now, duration: ResourceSystem.duration(point), lastToolAt: 0, progress: 0, bar: this.effects.createGatherBar(point.x, point.y, point.resource) };
    this.currentTarget = point;
  }
  cancelGathering(message = null) {
    if (!this.gathering) return;
    this.effects.finishGatherBar(this.gathering.bar);
    this.gathering = null;
    if (message) { this.ui.log(message, 'danger'); this.ui.notice('COLETA INTERROMPIDA', 'danger'); }
  }
  completeGather(point) {
    const character = this.getCharacter();
    if (!ResourceSystem.collect(character, point)) return;
    this.renderer.removePoint(point.id);
    this.effects.gatherSuccess(point.x, point.y);
    this.audio.playUi('upgrade');
    const resource = RESOURCE_CATALOG[point.resource]?.name ?? point.resource;
    this.ui.log(`${resource} coletado com sucesso · quantidade ${point.amount}.`, 'good');
    this.ui.notice(`+${point.amount} ${resource.toLocaleUpperCase('pt-BR')}`, 'good');
    this.save();
  }
  async syncWorldClock() {
    try {
      const response = await fetch('/api/world-time', { cache: 'no-store' });
      if (!response.ok) return;
      const result = await response.json();
      this.worldClock = { syncedAt: Date.now(), serverTime: result.serverTime, dayLength: result.dayLength, phase: result.phase };
      this.worldClockDetails = BiomeSystem.clockAt(result.serverTime, result.dayLength);
      this.ui.setServerClock(this.worldClockDetails);
    } catch { /* mantém a última hora recebida do servidor durante desconexões. */ }
  }
  updateWorldLighting(now, chunks) {
    if (now - this.lastLightingUpdate < 500) return;
    this.lastLightingUpdate = now;
    const serverNow = this.worldClock.serverTime + (Date.now() - this.worldClock.syncedAt);
    const cycle = this.worldClock.dayLength ?? 1200000;
    const phase = ((serverNow % cycle) + cycle) % cycle / cycle;
    const daylight = (Math.cos((phase - 0.5) * Math.PI * 2) + 1) / 2;
    const darkness = this.dungeonSystem.active ? 0.9 : Math.min(0.9, Math.max(0, (0.54 - daylight) * 1.8));
    this.worldClockDetails = BiomeSystem.clockAt(serverNow, cycle);
    const width = this.nightVeil.clientWidth;
    const height = this.nightVeil.clientHeight;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 1);
    if (this.nightVeil.width !== Math.round(width * dpr) || this.nightVeil.height !== Math.round(height * dpr)) {
      this.nightVeil.width = Math.round(width * dpr);
      this.nightVeil.height = Math.round(height * dpr);
    }
    const context = this.nightContext;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    if (darkness > 0.02) {
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = `rgba(7, 11, 22, ${darkness})`;
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = 'destination-out';
      const playerLight = context.createRadialGradient(width / 2, height / 2, 34, width / 2, height / 2, Math.min(width, height) * 0.23);
      playerLight.addColorStop(0, 'rgba(0,0,0,1)'); playerLight.addColorStop(0.32, 'rgba(0,0,0,.94)'); playerLight.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = playerLight; context.fillRect(0, 0, width, height);
      const worldView = this.cameras.main.worldView;
      for (const point of [...chunks.flatMap((chunk) => chunk.points), ...(this.dungeonTorches ?? [])]) {
        if (!point.isLightSource || point.dead) continue;
        const x = (point.x - worldView.x) / worldView.width * width;
        const y = (point.y - worldView.y) / worldView.height * height;
        const glow = context.createRadialGradient(x, y, 5, x, y, 105);
        glow.addColorStop(0, 'rgba(0,0,0,.95)'); glow.addColorStop(0.38, 'rgba(0,0,0,.74)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = glow; context.fillRect(x - 105, y - 105, 210, 210);
      }
      context.globalCompositeOperation = 'source-over';
    }
    this.nightOverlay.clear();
    this.lightGraphics.clear();
    if (darkness > 0.08) {
      for (const point of chunks.flatMap((chunk) => chunk.points)) {
        if (!point.isLightSource || point.dead) continue;
        const pulse = 0.9 + Math.sin(now / 130 + point.x) * 0.1;
        this.lightGraphics.fillStyle(0xffa44e, darkness * 0.12).fillCircle(point.x, point.y, 82 * pulse);
        this.lightGraphics.fillStyle(0xffd17c, darkness * 0.09).fillCircle(point.x, point.y, 46 * pulse);
      }
    }
  }
  usePotion(kind) {
    const character = this.getCharacter();
    if (!character || character.status !== 'alive') return false;
    const now = this.time.now;
    const potion = PotionSystem.use(character, kind, now);
    if (!potion) return false;
    this.audio.playUi('upgrade');
    this.effects.expandingRing(character.position.x, character.position.y, kind === 'hp' ? 0xff7474 : 0x79c9ff, 24, 480, 2);
    this.ui.notice(`${kind === 'hp' ? '♥' : '✧'} +${potion.restored} ${kind === 'hp' ? 'VIDA' : 'MANA'}`, 'good');
    this.save();
    return true;
  }
  toggleAuto() {
    const character = this.getCharacter();
    if (!character || character.status !== 'alive') return false;
    character.autoEnabled = !character.autoEnabled;
    this.ui.setAutoEnabled(character.autoEnabled);
    this.ui.log(character.autoEnabled ? 'Exploração automática retomada.' : 'Personagem pausado no local.');
    this.audio.playUi('click');
    this.save();
    return character.autoEnabled;
  }
  teleportToTown() {
    const character = this.getCharacter();
    if (!character || character.status !== 'alive') return false;
    if (this.dungeonSystem.active) {
      this.dungeonSystem.fail();
      this.dungeonEnemies.forEach((enemy) => this.renderer.removePoint(enemy.id));
      this.dungeonEnemies = [];
      this.clearDungeonRoom();
      this.ui.setDungeonProgress('', 0, false);
      this.ui.log('Expedição abandonada ao retornar à cidade.', 'danger');
    }
    character.position = { x: 0, y: 0 };
    character.autoEnabled = false;
    this.playerEntity?.setPosition(0, 0);
    this.ui.setAutoEnabled(false);
    this.ui.log('Você retornou à Cidade do Centro.');
    this.ui.notice('TELEPORTE · CIDADE DO CENTRO', 'good');
    this.audio.playUi('map'); this.updateWorld(true); this.save();
    return true;
  }
  enterDungeon(dungeonId, party = null) {
    const character = this.getCharacter();
    const result = this.dungeonSystem.enter(dungeonId, character, party);
    if (!result.allowed) return result;
    this.dungeonEnemies = result.enemies.map((enemy) => ({ ...enemy, dungeonInstance: true }));
    this.createDungeonRoom(character.position);
    this.dungeonEnemies.forEach((enemy) => this.renderer.addTransient(enemy, this.generator.chunkKey(Math.floor(character.position.x / CHUNK_SIZE), Math.floor(character.position.y / CHUNK_HEIGHT))));
    this.ui.setDungeonStatus(`Onda 1/${this.dungeonSystem.run ? 3 : 3} · ${this.dungeonSystem.run.waveName}`);
    this.ui.setDungeonProgress(`CRIPTA · ONDA 1/3 · ${this.dungeonSystem.run.waveName}`, this.dungeonEnemies.length);
    this.ui.log(`Dungeon iniciada: ${this.dungeonSystem.run.waveName}.`, 'good');
    this.save();
    return { ...result, reason: null };
  }
  createDungeonRoom(position) {
    this.clearDungeonRoom();
    const floor = this.add.graphics().setDepth(Math.floor(position.y / CHUNK_HEIGHT) * CHUNK_HEIGHT + 0.25);
    const left = position.x - 420; const top = position.y - 310;
    floor.fillStyle(0x292632, 1).fillRoundedRect(left, top, 840, 620, 20);
    floor.lineStyle(3, 0x6e566f, 0.94).strokeRoundedRect(left, top, 840, 620, 20);
    floor.lineStyle(1, 0x56495e, 0.63);
    for (let x = left + 44; x < left + 820; x += 48) floor.lineBetween(x, top + 10, x, top + 610);
    for (let y = top + 40; y < top + 610; y += 42) floor.lineBetween(left + 12, y, left + 828, y);
    floor.lineStyle(2, 0x9c77a7, 0.72).strokeCircle(position.x, position.y, 55).strokeCircle(position.x, position.y, 67);
    floor.fillStyle(0xa77ac1, 0.34).fillCircle(position.x, position.y, 7);
    for (const side of [-1, 1]) {
      const torchX = position.x + side * 355;
      floor.fillStyle(0x211a27).fillRect(torchX - 12, position.y - 18, 24, 44);
      floor.fillStyle(0xffbd6b, 0.9).fillPoints([{ x: torchX, y: position.y - 38 }, { x: torchX + 9, y: position.y - 20 }, { x: torchX + 3, y: position.y - 11 }, { x: torchX - 7, y: position.y - 18 }], true);
      floor.fillStyle(0xffc273, 0.12).fillCircle(torchX, position.y - 18, 80);
    }
    this.dungeonTorches = [-1, 1].map((side) => ({ x: position.x + side * 355, y: position.y - 18, isLightSource: true, dead: false }));
    this.dungeonBackdrop = floor;
  }
  clearDungeonRoom() {
    this.dungeonBackdrop?.destroy();
    this.dungeonBackdrop = null;
    this.dungeonTorches = [];
  }
  spawnNextDungeonWave() {
    const character = this.getCharacter();
    const result = this.dungeonSystem.advance(character);
    if (result.done) {
      character.dungeonCompletions = (character.dungeonCompletions ?? 0) + 1;
      character.resources.batWing = (character.resources.batWing ?? 0) + 16;
      character.resources.batFang = (character.resources.batFang ?? 0) + 10;
      character.resources.arcaneFragments = (character.resources.arcaneFragments ?? 0) + 4;
      const levels = ProgressionSystem.grantXp(character, 220);
      this.ui.log('Vesper caiu! Cripta concluída · +16 Asas · +10 Presas · +220 XP.', 'good');
      this.ui.notice('CRIPTA CONCLUÍDA!', 'good');
      for (const level of levels) { this.audio.playLevelUp(); this.effects.levelUp(character.position.x, character.position.y); this.ui.levelUp(level); }
      this.dungeonEnemies = [];
      this.clearDungeonRoom();
      this.ui.setDungeonProgress('', 0, false);
      this.save();
      return;
    }
    this.dungeonEnemies = result.enemies.map((enemy) => ({ ...enemy, dungeonInstance: true }));
    const key = this.generator.chunkKey(Math.floor(character.position.x / CHUNK_SIZE), Math.floor(character.position.y / CHUNK_HEIGHT));
    for (const enemy of this.dungeonEnemies) this.renderer.addTransient(enemy, key);
    this.ui.setDungeonStatus(`Onda ${this.dungeonSystem.run.wave + 1}/3 · ${result.waveName}`);
    this.ui.setDungeonProgress(`CRIPTA · ONDA ${this.dungeonSystem.run.wave + 1}/3`, this.dungeonEnemies.length);
    this.ui.log(`${result.waveName}${result.elite ? ' · ELITE' : ''}!`, 'good');
    if (result.elite) this.ui.notice('ELITE: VESPER', 'danger');
  }
  updateWorld(force = false) {
    const character = this.getCharacter();
    const position = character?.position ?? { x: 0, y: 0 };
    const chunks = this.chunks.update(position, character?.modifications ?? {});
    this.loadedChunks = chunks;
    this.cachedWorldPoints = chunks.flatMap((chunk) => chunk.points).filter((point) => !point.dead && !point.collected);
    this.currentChunkKey = this.generator.chunkKey(Math.floor(position.x / CHUNK_SIZE), Math.floor(position.y / CHUNK_HEIGHT));
    this.lastChunkUpdate = this.time.now;
    this.renderer.render(chunks);
    if (character && this.dungeonSystem.active) {
      const key = this.generator.chunkKey(Math.floor(position.x / CHUNK_SIZE), Math.floor(position.y / CHUNK_HEIGHT));
      for (const enemy of this.dungeonEnemies) if (!this.renderer.pointObjects.has(enemy.id)) this.renderer.addTransient(enemy, key);
    }
    this.lastWorldUpdate = this.time.now;
    if (character) this.ui.render(character, BiomeSystem.at(position.x, position.y), chunks.length, this.combat.getSkillStates(character, this.time.now), chunks);
  }
  collect(point) {
    const character = this.getCharacter();
    if (!ResourceSystem.collect(character, point)) return;
    this.renderer.removePoint(point.id);
    this.effects.gatherSuccess(point.x, point.y);
    const name = { wood: 'Madeira', stone: 'Pedra', branches: 'Galhos', voidGel: 'Gel Violeta' }[point.resource];
    this.ui.log(`Coletou ${point.amount} ${name.toLocaleLowerCase('pt-BR')}.`);
    this.ui.notice(`+${point.amount} ${name}`, 'good');
    this.save();
  }
  attack(slime, now) {
    const character = this.getCharacter();
    const playerBiomeId = BiomeSystem.at(character.position.x, character.position.y).id;
    const worldEnemies = [...this.chunks.loaded.values()].flatMap((chunk) => chunk.points).filter((point) => (point.kind === 'monster' || point.kind === 'slime') && !point.dead && point.hp > 0 && (point.biomeId ?? BiomeSystem.at(point.x, point.y).id) === playerBiomeId);
    const enemies = [...worldEnemies, ...this.dungeonEnemies.filter((point) => !point.dead && point.hp > 0)];
    const result = this.combat.attack(character, slime, enemies, now);
    this.lastAttack = now;
    const color = CLASS_CATALOG[character.classId].color;
    if (result.skillId) {
      this.audio.playSkill(result.skillId);
      this.renderWarriorSkill(result, character, color);
      this.ui.notice(result.skill.toLocaleUpperCase('pt-BR'), 'good');
      this.ui.log(`${result.skill} ativada${result.hits.length ? ` · ${result.hits.length} inimigo(s) afetado(s)` : ''}.`, 'good');
    } else {
      this.audio.playBasicAttack(character.classId);
      if (character.classId === 'warrior') {
        const direction = character.facing ?? 1;
        this.effects.meleeSlash(character.position.x + (direction >= 0 ? 12 : -12), character.position.y, color, direction, now);
      } else this.effects.rangedProjectile(character.classId, character.position.x + 12, character.position.y - 12, slime.x, slime.y, color);
      if (result.hit) {
        if (character.classId === 'warrior') this.effects.hit(slime.x, slime.y, color, false);
        if (result.critical) this.ui.notice('ACERTO CRÍTICO!', 'good');
        this.renderer.hitPoint(slime);
      }
      if (result.hit) this.damageNumber(slime, result.damage, result.critical);
      this.ui.log(result.hit ? `${slime.name ?? 'Monstro'} atingido por ${result.damage} de dano${result.critical ? ' crítico' : ''}.` : 'O ataque errou o monstro.');
    }
    for (const hit of result.hits) {
      if (hit.pulled) {
        hit.target.pullAnimatingUntil = now + 260;
        this.renderer.pullPoint(hit.target, hit.fromX, hit.fromY);
      }
      if (hit.damage && hit.target.hp > 0) {
        this.effects.hit(hit.target.x, hit.target.y, color, Boolean(result.skillId));
        this.effects.damageFlash(hit.target.x, hit.target.y, hit.critical ? 1.35 : 1);
        this.renderer.hitPoint(hit.target);
        this.damageNumber(hit.target, hit.damage, false);
      }
    }
    const defeated = new Set(result.hits.filter((hit) => hit.target.hp <= 0).map((hit) => hit.target.id));
    for (const enemyId of defeated) {
      const enemy = enemies.find((item) => item.id === enemyId);
      if (!enemy || enemy.dead) continue;
      this.effects.damageFlash(enemy.x, enemy.y, 1.15);
      enemy.dead = true;
      character.modifications[enemy.id] = true;
      character.defeatedSlimes += 1;
      const xp = enemy.elite ? 220 : enemy.monsterId === 'orc' ? 48 + enemy.level * 2 : enemy.monsterId === 'goblin' ? 35 + enemy.level : 35 + (enemy.level - 1) * 8;
      const levels = ProgressionSystem.grantXp(character, xp);
      const drops = this.rollMonsterDrops(enemy);
      for (const [resourceId, amount] of Object.entries(drops)) character.resources[resourceId] = (character.resources[resourceId] ?? 0) + amount;
      const dropsText = Object.entries(drops).map(([id, amount]) => `+${amount} ${RESOURCE_CATALOG[id]?.name ?? id}`).join(' · ') || '+materiais';
      this.ui.log(`${enemy.name ?? 'Monstro'} derrotado · +${xp} XP · ${dropsText}`, 'good');
      this.ui.notice(dropsText.toLocaleUpperCase('pt-BR'), 'good');
      this.effects.gatherSuccess(enemy.x, enemy.y, enemy.variant === 'voidSlime' ? 0xd48cff : enemy.elite ? 0xf2c96d : 0xc8ff86);
      for (const level of levels) { this.audio.playLevelUp(); this.effects.levelUp(character.position.x, character.position.y); this.ui.levelUp(level); this.ui.log(`Nível ${level}! Distribua seus pontos e habilidades.`, 'good'); }
      this.renderer.removePoint(enemy.id);
    }
    if (defeated.size) this.save();
    this.dungeonEnemies = this.dungeonEnemies.filter((enemy) => !enemy.dead);
    if (this.dungeonSystem.active) this.ui.setDungeonProgress(`CRIPTA · ONDA ${this.dungeonSystem.run.wave + 1}/3`, this.dungeonEnemies.length);
    for (const chunk of this.chunks.loaded.values()) for (const point of chunk.points) if ((point.kind === 'monster' || point.kind === 'slime') && point.id === slime.id) this.renderer.updatePoint(point);
    if (this.dungeonSystem.active && this.dungeonEnemies.length === 0) this.spawnNextDungeonWave();
  }
  damageNumber(enemy, amount, critical = false) {
    const label = critical ? `${Math.round(amount)}!!` : `${Math.round(amount)}`;
    const text = this.add.text(enemy.x + (Math.random() - 0.5) * 20, enemy.y - 24, label, {
      fontFamily: '"Press Start 2P", monospace', fontSize: critical ? '15px' : '12px',
      color: critical ? '#ffdf69' : '#fff0d6', stroke: '#251a20', strokeThickness: 5,
      shadow: { color: '#140e13', blur: 8, fill: true, offsetX: 2, offsetY: 3 }
    }).setOrigin(0.5).setDepth(enemy.y + 150);
    this.tweens.add({ targets: text, y: text.y - (critical ? 46 : 34), alpha: 0, scale: critical ? 1.3 : 1.08, duration: critical ? 950 : 760, ease: 'Cubic.Out', onComplete: () => text.destroy() });
  }
  rollMonsterDrops(enemy) {
    const drops = {};
    for (const [resource, range] of Object.entries(enemy.drops ?? {})) {
      const [minimum, maximum] = range;
      drops[resource] = minimum + Math.floor(Math.random() * (maximum - minimum + 1));
    }
    return drops;
  }
  renderWarriorSkill(result, character, color) {
    const { x, y } = character.position;
    if (result.skillId === 'warriorWhirlwind') {
      this.effects.warriorWhirlwind(x, y, color, result.skillData.radius);
    } else if (result.skillId === 'warriorWarCry') {
      this.effects.warriorWarCry(x, y, color);
      this.ui.notice(`+${result.healed} VIDA`, 'good');
    } else if (result.skillId === 'warriorIronWill') {
      this.effects.warriorDefenseAura(x, y, color);
      this.ui.notice('DEFESAS +10% · 10s', 'good');
    } else if (result.skillId === 'warriorChains') {
      const pulled = result.hits.filter((hit) => hit.pulled);
      this.effects.warriorChains(x, y, pulled.map((hit) => ({ x: hit.fromX, y: hit.fromY })), color);
      this.ui.notice(`${pulled.length} ATRAÍDO(S) · PROVOCAÇÃO 10s`, 'good');
    }
  }
  updateEngagedEnemies(points, character, now, delta) {
    if (BiomeSystem.isSafe(character.position.x, character.position.y)) return;
    for (const enemy of points) {
      if (!['slime', 'monster'].includes(enemy.kind) || enemy.dead) continue;
      const dx = character.position.x - enemy.x;
      const dy = character.position.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      const taunted = (enemy.tauntUntil ?? 0) > now;
      const monsterModifiers = BiomeSystem.monsterModifiers(this.worldClockDetails);
      const aggroRange = (enemy.aggroRange ?? (enemy.variant === 'voidSlime' ? 260 : 210)) * monsterModifiers.aggro;
      const leashDistance = enemy.leashDistance ?? 470;
      if (distance <= aggroRange || taunted) enemy.aggroUntil = now + 7000;
      const engaged = taunted || (enemy.aggroUntil ?? 0) > now;
      if (engaged && distance > leashDistance) {
        enemy.aggroUntil = 0;
        enemy.tauntUntil = 0;
        enemy.x = Phaser.Math.Linear(enemy.x, enemy.homeX ?? enemy.x, Math.min(1, delta / 900));
        enemy.y = Phaser.Math.Linear(enemy.y, enemy.homeY ?? enemy.y, Math.min(1, delta / 900));
      } else if (engaged && distance > (enemy.attackRange ?? 48) * 0.82) {
        enemy.homeX ??= enemy.x; enemy.homeY ??= enemy.y;
        const speed = (enemy.speed ?? 40) * monsterModifiers.speed;
        const step = Math.min(distance - (enemy.attackRange ?? 48) * 0.72, speed * Math.min(delta, 50) / 1000);
        if (step > 0) { enemy.x += dx / distance * step; enemy.y += dy / distance * step; enemy.moving = true; }
      } else if (engaged && now >= (enemy.nextAttackAt ?? 0)) {
        const baseInterval = enemy.monsterId === 'voidSlime' ? 2200 : enemy.monsterId === 'direBat' ? 1750 : enemy.elite ? 1550 : 1850;
        const interval = Math.round(baseInterval / monsterModifiers.attackRate);
        enemy.nextAttackAt = now + interval;
        const ranged = enemy.attackStyle === 'ranged' || (enemy.attackRange ?? 0) > 65;
        const baseDamage = Math.round((enemy.attackDamage ?? (5 + enemy.level * 2)) * monsterModifiers.attack);
        const impact = ranged ? DamageSystem.magicalDamage(character, baseDamage) : DamageSystem.physicalDamage(character, baseDamage, Math.random, now);
        this.renderer.attackPoint(enemy);
        if (ranged) {
          const projectileColor = enemy.monsterId === 'voidSlime' ? 0xc77aff : enemy.monsterId === 'direBat' || enemy.elite ? 0xb99aff : 0x8fe3d2;
          this.effects.rangedProjectile('mage', enemy.x, enemy.y - 8, character.position.x, character.position.y - 8, projectileColor);
        }
        if (impact.dodged) {
          this.ui.log(`Você esquivou do ataque de ${enemy.name ?? 'monstro'}${taunted ? ' provocado' : ''}.`, 'good');
        } else {
          character.currentLife = Math.max(0, (character.currentLife ?? 1) - impact.damage);
          this.effects.damageFlash(character.position.x, character.position.y, 1);
          this.ui.log(`${enemy.name ?? 'Monstro'} causou ${impact.damage} de dano ${ranged ? 'mágico' : 'físico'}.`, 'danger');
          this.damageNumber({ x: character.position.x, y: character.position.y - 16 }, impact.damage, false);
        }
        if (character.currentLife <= 0) { this.endCharacter(enemy.name ?? 'Monstro'); return; }
      }
      if (enemy.elite && engaged) this.updateEliteMechanic(enemy, character, now);
      const pointObject = this.renderer.pointObjects.get(enemy.id);
      if (pointObject && now >= (enemy.pullAnimatingUntil ?? 0)) pointObject.container.setPosition(enemy.x, enemy.y).setDepth(enemy.y + 2);
      enemy.moving = false;
    }
  }
  updateEliteMechanic(enemy, character, now) {
    const ratio = enemy.hp / enemy.maxHp;
    enemy.mechanicPhases ??= [];
    const threshold = ratio <= 0.33 ? 2 : ratio <= 0.66 ? 1 : 0;
    if (enemy.mechanicPhases.includes(threshold)) return;
    enemy.mechanicPhases.push(threshold);
    enemy.nextAttackAt = Math.min(enemy.nextAttackAt ?? now, now);
    this.ui.notice(threshold === 0 ? 'VESPER: GRITO SÔNICO!' : threshold === 1 ? 'VESPER INVOCA MORCEGOS!' : 'VESPER: MERGULHO SOMBRIO!', 'danger');
    this.effects.expandingRing(enemy.x, enemy.y, 0xd898ff, 60 + threshold * 18, 550, 3);
    if (threshold === 1 && this.dungeonSystem.active) {
      const minions = [0, 1].map((index) => ({
        id: `${enemy.id}:summon:${threshold}:${index}`, kind: 'monster', variant: 'direBat', monsterId: 'direBat', name: 'Morcego da Cripta',
        x: enemy.x + (index ? 70 : -70), y: enemy.y - 54, level: enemy.level - 2, hp: 46, maxHp: 46, attackDamage: 12,
        attackRange: 170, speed: 62, aggroRange: 300, leashDistance: 520, attackStyle: 'ranged', drops: { batWing: [1, 2] }, dead: false
      }));
      const key = this.generator.chunkKey(Math.floor(character.position.x / CHUNK_SIZE), Math.floor(character.position.y / CHUNK_HEIGHT));
      this.dungeonEnemies.push(...minions);
      for (const minion of minions) this.renderer.addTransient(minion, key);
    }
  }
  endCharacter(cause = 'Slime') {
    const character = this.getCharacter();
    const record = DeathSystem.respawnInTown(character, cause);
    if (!record) return null;
    if (this.dungeonSystem.active) { this.dungeonSystem.fail(); this.dungeonEnemies.forEach((enemy) => this.renderer.removePoint(enemy.id)); this.dungeonEnemies = []; this.clearDungeonRoom(); this.ui.setDungeonProgress('', 0, false); }
    this.cancelGathering();
    this.currentTarget = null;
    this.lastEnemyAiUpdate = 0;
    this.playerEntity?.setPosition(0, 0);
    const stats = StatsSystem.derived(character);
    character.currentLife = stats.maxLife;
    character.currentMana = stats.maxMana;
    this.cameras.main.startFollow(this.playerEntity.body, false, 0.08, 0.08);
    this.ui.setAlive();
    this.ui.setAutoEnabled(true);
    this.ui.log(`${record.name} foi derrotado por ${cause}, mas os guardiões da cidade o trouxeram de volta.`, 'good');
    this.ui.notice('RETORNO À CIDADE · VIDA RESTAURADA', 'good');
    this.save();
    this.updateWorld(true);
    return record;
  }
}
