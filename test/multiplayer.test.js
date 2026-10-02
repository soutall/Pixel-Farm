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
  let clock = 1000;
  const server = createServer();
  const multiplayer = attachMultiplayer(server, { seed: 'shared-world-test', now: () => clock });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `ws://127.0.0.1:${server.address().port}/ws`;
  let first;
  let second;
  try {
    first = await openSocket(url);
    const firstWelcomePromise = waitForMessage(first, 'welcome');
    first.send(JSON.stringify({ type: 'join', character: { name: 'Primeiro', classId: 'warrior' } }));
    const firstWelcome = await firstWelcomePromise;
    assert.equal(firstWelcome.worldSeed, 'shared-world-test');
    assert.equal(firstWelcome.players.length, 1);

    second = await openSocket(url);
    const secondWelcomePromise = waitForMessage(second, 'welcome');
    const sharedRosterPromise = waitForMessage(first, 'players', (message) => message.players.length === 2);
    second.send(JSON.stringify({ type: 'join', character: { name: 'Segundo', classId: 'mage' } }));
    const [secondWelcome, sharedRoster] = await Promise.all([secondWelcomePromise, sharedRosterPromise]);
    assert.equal(secondWelcome.worldSeed, 'shared-world-test');
    assert.deepEqual(new Set(sharedRoster.players.map((player) => player.name)), new Set(['Primeiro', 'Segundo']));

    const firstPlayer = firstWelcome.players[0];
    clock += 140;
    const statePromise = waitForMessage(second, 'state', (message) => message.players.some((player) => player.id === firstPlayer.id && player.facing === -1));
    first.send(JSON.stringify({ type: 'move', x: firstPlayer.x + 500, y: firstPlayer.y, facing: -1 }));
    const state = await statePromise;
    const movedPlayer = state.players.find((player) => player.id === firstPlayer.id);
    assert.ok(Math.hypot(movedPlayer.x - firstPlayer.x, movedPlayer.y - firstPlayer.y) <= 43);
    assert.equal(movedPlayer.facing, -1);
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
