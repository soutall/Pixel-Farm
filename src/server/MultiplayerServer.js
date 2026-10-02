import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';

const TICK_MS = 50;
const SNAPSHOT_MS = 100;
const MAX_MESSAGE_BYTES = 4096;
const MAX_MOVEMENT_SPEED = 250;
const VALID_CLASSES = new Set(['warrior', 'mage', 'archer']);

export function attachMultiplayer(server, { seed = randomUUID(), now = () => Date.now() } = {}) {
  const sockets = new Map();
  const webSockets = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  let lastSnapshotAt = 0;

  server.on('upgrade', (request, socket, head) => {
    let pathname;
    try { pathname = new URL(request.url, 'http://localhost').pathname; }
    catch { socket.destroy(); return; }
    if (pathname !== '/ws') { socket.destroy(); return; }
    webSockets.handleUpgrade(request, socket, head, (client) => webSockets.emit('connection', client, request));
  });

  webSockets.on('connection', (socket) => {
    let player = null;
    socket.on('message', (raw) => {
      let message;
      try { message = JSON.parse(raw.toString()); }
      catch { return; }
      if (!message || typeof message !== 'object') return;

      if (message.type === 'join' && !player) {
        const name = cleanName(message.character?.name);
        const classId = VALID_CLASSES.has(message.character?.classId) ? message.character.classId : 'warrior';
        const offset = (sockets.size % 7) * 28;
        player = {
          id: randomUUID(), name, classId,
          x: offset - 84, y: 0, facing: 1, level: 1,
          lastMoveAt: now(), socket
        };
        sockets.set(player.id, player);
        send(socket, { type: 'welcome', id: player.id, worldSeed: seed, players: publicPlayers(sockets) });
        broadcast({ type: 'players', players: publicPlayers(sockets) });
        return;
      }

      if (!player || message.type !== 'move') return;
      const x = Number(message.x); const y = Number(message.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1_000_000 || Math.abs(y) > 1_000_000) return;
      const current = now();
      if (current - player.lastMoveAt < 40) return;
      const elapsed = Math.min(500, Math.max(0, current - player.lastMoveAt));
      const maxDistance = MAX_MOVEMENT_SPEED * elapsed / 1000 + 8;
      const dx = x - player.x; const dy = y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > maxDistance && distance > 0) {
        const scale = maxDistance / distance;
        player.x += dx * scale;
        player.y += dy * scale;
      } else {
        player.x = x;
        player.y = y;
      }
      player.facing = Number(message.facing) < 0 ? -1 : 1;
      player.lastMoveAt = current;
    });

    socket.on('close', () => {
      if (!player) return;
      sockets.delete(player.id);
      broadcast({ type: 'players', players: publicPlayers(sockets) });
    });
    socket.on('error', () => {});
  });

  const timer = setInterval(() => {
    const current = now();
    if (current - lastSnapshotAt < SNAPSHOT_MS) return;
    lastSnapshotAt = current;
    broadcast({ type: 'state', players: publicPlayers(sockets) });
  }, TICK_MS);
  timer.unref?.();

  server.on('close', () => {
    clearInterval(timer);
    for (const socket of webSockets.clients) socket.close(1001, 'Servidor encerrado');
    webSockets.close();
  });

  function broadcast(payload) {
    const serialized = JSON.stringify(payload);
    for (const client of webSockets.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(serialized);
    }
  }

  return { webSockets, sockets, worldSeed: seed };
}

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

function publicPlayers(sockets) {
  return [...sockets.values()].map(({ id, name, classId, x, y, facing, level }) => ({ id, name, classId, x, y, facing, level }));
}

function cleanName(value) {
  return String(value ?? 'Aventureiro').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 18) || 'Aventureiro';
}
