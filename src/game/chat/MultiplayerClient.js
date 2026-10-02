export class MultiplayerClient {
  constructor({ onWelcome = () => {}, onPlayers = () => {}, onStatus = () => {} } = {}) {
    this.onWelcome = onWelcome;
    this.onPlayers = onPlayers;
    this.onStatus = onStatus;
    this.socket = null;
    this.character = null;
    this.clientId = null;
    this.connected = false;
    this.lastSentAt = 0;
    this.retry = 0;
    this.generation = 0;
  }

  connect(character) {
    const sameCharacter = this.character?.id === character.id;
    this.character = character;
    if (sameCharacter && this.socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(this.socket.readyState)) return;
    this.socket?.close(1000, 'Troca de personagem');
    const generation = ++this.generation;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/ws`);
    this.socket = socket;
    this.onStatus('connecting');

    socket.addEventListener('open', () => {
      if (generation !== this.generation) return;
      this.retry = 0;
      socket.send(JSON.stringify({ type: 'join', character: { name: character.name, classId: character.classId } }));
    });
    socket.addEventListener('message', (event) => {
      if (generation !== this.generation) return;
      let message;
      try { message = JSON.parse(event.data); }
      catch { return; }
      if (message.type === 'welcome') {
        this.clientId = message.id;
        this.connected = true;
        this.onStatus('online');
        this.onWelcome(message);
        return;
      }
      if (message.type === 'players' || message.type === 'state') this.onPlayers(message.players ?? []);
    });
    socket.addEventListener('close', () => {
      if (generation !== this.generation) return;
      this.connected = false;
      this.clientId = null;
      this.onStatus('offline');
      if (this.character?.status === 'alive') {
        const delay = Math.min(1000 * (2 ** this.retry++), 10000);
        setTimeout(() => {
          if (generation === this.generation && this.character?.status === 'alive') {
            this.socket = null;
            this.connect(this.character);
          }
        }, delay);
      }
    });
    socket.addEventListener('error', () => this.onStatus('offline'));
  }

  sendPosition(x, y, facing = 1, timestamp = Date.now()) {
    if (!this.connected || timestamp - this.lastSentAt < 50) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.lastSentAt = timestamp;
    this.socket.send(JSON.stringify({ type: 'move', x, y, facing }));
  }

  disconnect() {
    this.generation += 1;
    this.character = null;
    this.connected = false;
    this.clientId = null;
    this.socket?.close(1000, 'Personagem desconectado');
    this.socket = null;
    this.onStatus('offline');
  }
}
