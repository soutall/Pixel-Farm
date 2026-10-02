export class MultiplayerClient {
  constructor({ onWelcome = () => {}, onState = () => {}, onStatus = () => {} } = {}) {
    this.onWelcome = onWelcome;
    this.onState = onState;
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
      const sessionToken = localStorage.getItem('farm-multiplayer-session') ?? '';
      let party = null;
      try { party = JSON.parse(localStorage.getItem('farm-party') || 'null'); }
      catch { party = null; }
      socket.send(JSON.stringify({ type: 'join', sessionToken, party: party ? { id: party.id, invite: party.invite } : null, character: { name: character.name, classId: character.classId, profile: character } }));
    });
    socket.addEventListener('message', (event) => {
      if (generation !== this.generation) return;
      let message;
      try { message = JSON.parse(event.data); }
      catch { return; }
      if (message.type === 'welcome') {
        this.clientId = message.id;
        this.connected = true;
        if (message.sessionToken) localStorage.setItem('farm-multiplayer-session', message.sessionToken);
        this.onStatus('online');
        this.onWelcome(message);
        return;
      }
      if (message.type === 'state') this.onState(message);
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

  sendAction(action, data = {}) {
    if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type: 'action', action, data }));
    return true;
  }

  setAutoEnabled(autoEnabled) {
    if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type: 'intent', autoEnabled: Boolean(autoEnabled) }));
    return true;
  }

  joinParty(party) {
    return this.sendAction('joinParty', { partyId: party?.id, invite: party?.invite });
  }

  leaveParty() { return this.sendAction('leaveParty'); }

  forgetSession() {
    localStorage.removeItem('farm-multiplayer-session');
    this.disconnect();
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
