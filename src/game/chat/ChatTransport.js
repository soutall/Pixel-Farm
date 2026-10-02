// Contrato para transporte futuro (por exemplo WebSocket); nenhum socket é aberto no protótipo local.
export class ChatTransport {
  connect() { throw new Error('Chat multiplayer ainda não implementado.'); }
  send(_message) { throw new Error('Chat multiplayer ainda não implementado.'); }
  onMessage(_handler) { return () => {}; }
  close() {}
}
