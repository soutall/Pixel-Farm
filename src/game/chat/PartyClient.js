export class PartyClient {
  constructor() {
    this.pollTimer = null;
    try { this.party = JSON.parse(localStorage.getItem('farm-party') || 'null'); }
    catch { this.party = null; }
  }
  async create(name) {
    const response = await fetch('/api/parties', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!response.ok) throw new Error('Não foi possível criar o grupo.');
    this.party = await response.json();
    localStorage.setItem('farm-party', JSON.stringify(this.party));
    this.startPolling();
    return this.party;
  }
  parseInvite(value) {
    try {
      const url = new URL(value, location.origin);
      const id = url.searchParams.get('party');
      const invite = url.searchParams.get('invite');
      return id && invite ? { id, invite } : null;
    } catch { return null; }
  }
  async join(value, name) {
    const invitation = this.parseInvite(value);
    if (!invitation) throw new Error('Esse link de convite não parece válido.');
    const response = await fetch(`/api/parties/${encodeURIComponent(invitation.id)}/join`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invite: invitation.invite, name })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'Não foi possível entrar no grupo.');
    this.party = { ...result, invite: invitation.invite };
    localStorage.setItem('farm-party', JSON.stringify(this.party));
    this.startPolling();
    return this.party;
  }
  async refresh() {
    if (!this.party?.id) return null;
    const response = await fetch(`/api/parties/${encodeURIComponent(this.party.id)}`, { cache: 'no-store' });
    if (!response.ok) { this.party = null; return null; }
    this.party = { ...await response.json(), invite: this.party.invite };
    localStorage.setItem('farm-party', JSON.stringify(this.party));
    return this.party;
  }
  getInviteLink() {
    if (!this.party) return '';
    const url = new URL(location.origin);
    url.searchParams.set('party', this.party.id);
    url.searchParams.set('invite', this.party.invite);
    return url.toString();
  }
  clear() {
    clearInterval(this.pollTimer);
    this.party = null;
    localStorage.removeItem('farm-party');
    document.dispatchEvent(new CustomEvent('farm-party-updated', { detail: null }));
  }
  startPolling() {
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.refresh().then((party) => document.dispatchEvent(new CustomEvent('farm-party-updated', { detail: party }))), 5000);
  }
}
