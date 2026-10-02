import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { WebSocket } from 'ws';
import { attachMultiplayer } from '../src/server/MultiplayerServer.js';

const openSocket = async (url) => {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return socket;
};

const waitForMessage = (socket, type, predicate = () => true) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => { cleanup(); reject(new Error(`Timed out waiting for ${type}`)); }, 2500);
  const onMessage = (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); }
    catch { return; }
    if (message.type !== type || !predicate(message)) return;
    cleanup(); resolve(message);
  };
  const cleanup = () => { clearTimeout(timeout); socket.off('message', onMessage); };
  socket.on('message', onMessage);
});

test('multiplayer usa o mesmo mundo e transmite os jogadores conectados', async () => {
  const server = createServer();
  const multiplayer = attachMultiplayer(server, { stateFile: null, seed: 'shared-world-test' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `ws://127.0.0.1:${server.address().port}/ws`;
  let first;
  let second;
  try {
    first = await openSocket(url);
    const firstWelcomePromise = waitForMessage(first, 'welcome');
    first.send(JSON.stringify({ type: 'join', sessionToken: '', character: { name: 'Primeiro', classId: 'warrior' } }));
    const firstWelcome = await firstWelcomePromise;
    assert.equal(firstWelcome.worldSeed, 'shared-world-test');
    assert.equal(firstWelcome.character.name, 'Primeiro');
    assert.equal(firstWelcome.character.level, 1);
    assert.match(firstWelcome.sessionToken, /^[a-f0-9]{64}$/);
    assert.equal(firstWelcome.state.players.length, 1);

    second = await openSocket(url);
    const secondWelcomePromise = waitForMessage(second, 'welcome');
    const sharedRosterPromise = waitForMessage(first, 'state', (message) => message.players.length === 2);
    second.send(JSON.stringify({ type: 'join', sessionToken: '', character: { name: 'Segundo', classId: 'mage' } }));
    const [secondWelcome, sharedRoster] = await Promise.all([secondWelcomePromise, sharedRosterPromise]);
    assert.equal(secondWelcome.worldSeed, 'shared-world-test');
    assert.deepEqual(new Set(sharedRoster.players.map((player) => player.name)), new Set(['Primeiro', 'Segundo']));
    assert.deepEqual(secondWelcome.state.players.map((player) => player.name).sort(), ['Primeiro', 'Segundo']);

    const firstPlayer = firstWelcome.state.players[0];
    const statePromise = waitForMessage(second, 'state', (message) => message.players.length === 2);
    first.send(JSON.stringify({ type: 'move', x: firstPlayer.x + 500, y: firstPlayer.y, facing: -1 }));
    const state = await statePromise;
    const unchangedPlayer = state.players.find((player) => player.id === firstPlayer.id);
    assert.ok(Math.hypot(unchangedPlayer.x - (firstPlayer.x + 500), unchangedPlayer.y - firstPlayer.y) > 400);
    assert.equal(unchangedPlayer.facing, firstPlayer.facing);

    const firstServerPlayer = multiplayer.world.players.get(firstWelcome.id);
    firstServerPlayer.character.unspentPoints = 1;
    const allocatedState = waitForMessage(first, 'state', (message) => message.self.attributes.strength === 6);
    first.send(JSON.stringify({ type: 'action', action: 'allocate', data: { attribute: 'strength' } }));
    const allocated = await allocatedState;
    assert.equal(allocated.self.unspentPoints, 0);
    first.send(JSON.stringify({ type: 'action', action: 'allocate', data: { attribute: 'strength' } }));
    assert.equal(firstServerPlayer.character.attributes.strength, 6);
    multiplayer.world.tick(50);
  } finally {
    const serverPeersClosed = Promise.all([...multiplayer.webSockets.clients].map((socket) => new Promise((resolve) => {
      if (socket.readyState === WebSocket.CLOSED) { resolve(); return; }
      socket.once('close', resolve);
    })));
    await Promise.all([first, second].filter(Boolean).map((socket) => new Promise((resolve) => {
      if (socket.readyState === WebSocket.CLOSED) { resolve(); return; }
      socket.once('close', resolve);
      socket.terminate();
    })));
    await serverPeersClosed;
    await new Promise((resolve) => server.close(resolve));
    assert.equal(multiplayer.webSockets.clients.size, 0);
  }
});
