// Fronteira de domínio: futuramente substituível por chamadas a um servidor autoritativo/WebSocket.
export class AuthorityAdapter {
  async submitCommand(command) { return { accepted: true, authority: 'local', command }; }
  subscribe(_listener) { return () => {}; }
}
