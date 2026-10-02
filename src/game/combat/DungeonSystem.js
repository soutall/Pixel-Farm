import { createMonster } from '../world/MonsterCatalog.js';
import { BiomeSystem } from '../world/BiomeSystem.js';

export const DUNGEONS = [
  { id: 'batCrypt', name: 'Cripta dos Morcegos', icon: '☾', level: 18, partySize: 4, soloAllowed: true, mechanics: ['swarm', 'flight', 'elite'], waves: [
    { name: 'Asas na Escuridão', monsters: ['direBat', 'direBat', 'direBat'] },
    { name: 'Ninho Profundo', monsters: ['direBat', 'direBat', 'direBat', 'direBat'] },
    { name: 'Senhor da Cripta', monsters: ['batOverlord'], elite: true }
  ] }
];

export class DungeonSystem {
  constructor() { this.run = null; }
  canEnter(dungeonId, character, party = null) {
    if (this.active) return { allowed: false, reason: 'Conclua ou abandone a dungeon atual antes de iniciar outra.' };
    const dungeon = DUNGEONS.find((entry) => entry.id === dungeonId);
    if (!dungeon || !character || character.status !== 'alive') return { allowed: false, reason: 'Personagem inválido.' };
    if (BiomeSystem.isSafe(character.position.x, character.position.y)) return { allowed: false, reason: 'Você precisa sair da Cidade Segura antes de entrar na dungeon.' };
    if (character.level < dungeon.level) return { allowed: false, reason: `Requer nível ${dungeon.level}.` };
    if (party && party.members?.length !== dungeon.partySize) return { allowed: false, reason: `Grupo deve ter exatamente ${dungeon.partySize} membros; ou entre sozinho.` };
    if (party && party.members?.length > dungeon.partySize) return { allowed: false, reason: 'Grupo acima do limite da dungeon.' };
    return { allowed: true, dungeon };
  }
  enter(dungeonId, character, party, now = Date.now()) {
    const validation = this.canEnter(dungeonId, character, party);
    if (!validation.allowed) return validation;
    this.run = { dungeonId, enteredAt: now, solo: !party, wave: 0, state: 'running', spawnIndex: 0 };
    return { allowed: true, run: this.run, enemies: this.spawnWave(character) };
  }
  spawnWave(character) {
    const dungeon = DUNGEONS.find((entry) => entry.id === this.run?.dungeonId);
    const wave = dungeon?.waves[this.run.wave];
    if (!wave) return [];
    this.run.waveName = wave.name;
    return wave.monsters.map((monsterId, index) => createMonster(monsterId, `dungeon:${this.run.enteredAt}:w${this.run.wave}:m${index}`, character.position.x + 115 + (index % 3) * 38, character.position.y - 56 + Math.floor(index / 3) * 42, Math.max(dungeon.level, character.level)));
  }
  advance(character, now = Date.now()) {
    if (!this.run || this.run.state !== 'running') return { done: false, enemies: [] };
    this.run.wave += 1;
    const dungeon = DUNGEONS.find((entry) => entry.id === this.run.dungeonId);
    if (this.run.wave >= dungeon.waves.length) {
      this.run.state = 'completed'; this.run.completedAt = now;
      return { done: true, enemies: [] };
    }
    return { done: false, enemies: this.spawnWave(character), waveName: this.run.waveName, elite: Boolean(dungeon.waves[this.run.wave].elite) };
  }
  fail(now = Date.now()) { if (!this.run || this.run.state !== 'running') return false; this.run.state = 'failed'; this.run.completedAt = now; return true; }
  get active() { return this.run?.state === 'running'; }
}
