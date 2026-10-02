import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AuthoritativeWorld } from '../src/server/AuthoritativeWorld.js';

const fakeSocket = { readyState: 1, close() {}, send() {} };

test('servidor mantém um único recurso e um único prêmio de monstro no mundo', () => {
  const world = new AuthoritativeWorld({ stateFile: null, seed: 'shared-state-test' });
  const first = world.join(fakeSocket, { character: { name: 'A', classId: 'warrior' } }).player;
  const second = world.join(fakeSocket, { character: { name: 'B', classId: 'mage' } }).player;
  world.ensureChunks({ x: 0, y: 0 });

  const resource = world.points.get('0,0:starter-branches');
  assert.ok(resource);
  first.position = { x: resource.x, y: resource.y };
  first.character.position = { ...first.position };
  assert.equal(world.collectResource(first, resource), true);
  assert.equal(world.collectResource(second, resource), false);
  assert.equal(first.character.resources.branches, resource.amount);
  assert.equal(second.character.resources.branches, 0);

  const monster = world.points.get('0,0:starter-slime');
  assert.ok(monster);
  world.defeatMonster(first, monster);
  const firstReward = first.character.resources.slimeGel;
  const secondReward = second.character.resources.slimeGel;
  world.defeatMonster(second, monster);
  assert.equal(first.character.resources.slimeGel, firstReward);
  assert.equal(second.character.resources.slimeGel, secondReward);
  assert.equal(world.worldFlags[monster.id], true);
});

test('party com convite válido entra na mesma instância de dungeon; convite inválido é rejeitado', () => {
  const world = new AuthoritativeWorld({ stateFile: null, seed: 'dungeon-world-test' });
  const party = { id: 'party-test', invite: 'secret-invite', members: [] };
  const findParty = (id) => id === party.id ? party : null;
  const players = Array.from({ length: 4 }, (_, index) => {
    const player = world.join(fakeSocket, { character: { name: `Jogador ${index}`, classId: 'warrior' } }).player;
    player.character.level = 18;
    player.position = { x: 650 + index * 40, y: 0 };
    player.character.position = { ...player.position };
    world.action(player, 'joinParty', { partyId: party.id, invite: 'wrong-invite' }, findParty);
    assert.equal(player.partyId, undefined);
    world.action(player, 'joinParty', { partyId: party.id, invite: party.invite }, findParty);
    assert.equal(player.partyId, party.id);
    return player;
  });
  world.action(players[0], 'enterDungeon', { dungeonId: 'batCrypt', solo: false }, findParty);
  assert.equal(world.dungeonSystem.active, true);
  assert.equal(world.dungeonParticipantIds.size, 4);
  assert.equal(world.dungeonEnemies.length, 3);
});

test('perfil e seed do mundo sobrevivem à reinicialização do servidor', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'pixel-farm-world-'));
  const stateFile = path.join(directory, 'world.json');
  try {
    const firstWorld = new AuthoritativeWorld({ stateFile, seed: 'persistent-world-test' });
    const joined = firstWorld.join(fakeSocket, { character: { name: 'Persistente', classId: 'archer' } });
    joined.player.character.resources.wood = 17;
    joined.player.position = { x: 780, y: -120 };
    joined.player.character.position = { ...joined.player.position };
    firstWorld.disconnect(joined.player);

    const restartedWorld = new AuthoritativeWorld({ stateFile, seed: 'must-not-replace-restored-seed' });
    const rejoined = restartedWorld.join(fakeSocket, { sessionToken: joined.token, character: { name: 'Ignorado', classId: 'mage' } });
    assert.equal(restartedWorld.worldSeed, 'persistent-world-test');
    assert.equal(rejoined.player.character.name, 'Persistente');
    assert.equal(rejoined.player.character.classId, 'archer');
    assert.equal(rejoined.player.character.resources.wood, 17);
    assert.deepEqual(rejoined.player.position, { x: 780, y: -120 });
    assert.equal(JSON.parse(readFileSync(stateFile, 'utf8')).sessions[joined.token].character.resources.wood, 17);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
