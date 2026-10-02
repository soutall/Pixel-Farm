import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import { attachMultiplayer } from './MultiplayerServer.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../../public');
const gameDir = path.resolve(here, '../game');
const projectRoot = path.resolve(here, '../..');
const app = express();
const server = createServer(app);
const port = Number(process.env.PORT || 8080);
let multiplayer;
const parties = new Map();
const DAY_LENGTH_MS = 20 * 60 * 1000;

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', (_req, res) => res.json({
  status: 'ok', game: 'FARM OF PIXEL', multiplayer: 'authoritative-realtime',
  onlinePlayers: multiplayer?.sockets.size ?? 0,
  activeChunks: multiplayer?.world.chunks.size ?? 0,
  activeMonsters: multiplayer?.world.points.size ?? 0,
  worldSeed: multiplayer?.worldSeed ?? null
}));
app.get('/api/world-time', (_req, res) => {
  const serverTime = Date.now();
  const phase = ((serverTime % DAY_LENGTH_MS) + DAY_LENGTH_MS) % DAY_LENGTH_MS / DAY_LENGTH_MS;
  const minuteOfDay = Math.floor(phase * 24 * 60) % (24 * 60);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const isNight = hour >= 20 || hour < 6;
  res.set('Cache-Control', 'no-store').json({ serverTime, dayLength: DAY_LENGTH_MS, phase, hour, minute, phaseName: isNight ? 'night' : 'day', isNight, monsterSurge: hour < 4 });
});
app.post('/api/parties', (req, res) => {
  const id = randomUUID();
  const invite = randomBytes(24).toString('base64url');
  const party = { id, invite, createdAt: Date.now(), members: [{ id: randomUUID(), name: cleanName(req.body?.name), joinedAt: Date.now() }] };
  parties.set(id, party);
  res.status(201).json(party);
});
app.post('/api/parties/:id/join', (req, res) => {
  const party = parties.get(req.params.id);
  const provided = Buffer.from(String(req.body?.invite ?? ''));
  const expected = Buffer.from(String(party?.invite ?? randomBytes(24).toString('base64url')));
  const valid = provided.length === expected.length && timingSafeEqual(provided, expected);
  if (!party || !valid) return res.status(404).json({ error: 'Convite inválido ou grupo encerrado.' });
  const name = cleanName(req.body?.name);
  if (party.members.length >= 6 && !party.members.some((member) => member.name === name)) return res.status(409).json({ error: 'Este grupo já está completo (máximo de 6 aventureiros).' });
  if (!party.members.some((member) => member.name === name)) party.members.push({ id: randomUUID(), name, joinedAt: Date.now() });
  res.json(publicParty(party));
});
app.get('/api/parties/:id', (req, res) => {
  const party = parties.get(req.params.id);
  if (!party) return res.status(404).json({ error: 'Grupo não encontrado.' });
  res.set('Cache-Control', 'no-store').json(publicParty(party));
});
app.use('/src/game', express.static(gameDir));
app.use('/node_modules', express.static(path.join(projectRoot, 'node_modules')));
app.use(express.static(publicDir, { extensions: ['html'] }));
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

multiplayer = attachMultiplayer(server, { findParty: (id) => parties.get(id) ?? null });
server.listen(port, '0.0.0.0', () => {
  console.log(`FARM OF PIXEL disponível em http://localhost:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));

function cleanName(value) { return String(value ?? 'Aventureiro').trim().slice(0, 18) || 'Aventureiro'; }
function publicParty(party) { return { id: party.id, createdAt: party.createdAt, members: party.members }; }
