# Resumo das alterações — FARM OF PIXEL

Data: 2026-10-02

## Configuração inicial e automação
- Personagens novos começam com movimento/combate automáticos e auto-poções de vida e mana ativadas.
- Saves antigos recebem as opções padrão de automação quando iniciados.
- Valores iniciais das auto-poções: vida em 60% e mana em 35%; os limites seguem configuráveis pela interface.

## Coleta de recursos
- Tempo para coletar pedra: 4 segundos.
- Tempo para coletar madeira/árvore: 3 segundos.
- Tempo para coletar galhos: 2 segundos.
- A coleta tem barra de progresso e pode ser interrompida quando um inimigo ameaça o personagem.
- Durante a coleta, são exibidas ferramentas procedurais: picareta para pedra e machado para madeira/galhos.
- Os sons sintetizados para pedra e madeira são diferentes.
- Árvores foram ampliadas em 50% apenas visualmente; sua posição e lógica de interação não foram ampliadas.
- Árvores e pedras não surgem dentro do raio protegido da Cidade do Centro.

## Combate, biomas e morte
- Quando inimigos do bioma atual ameaçam o personagem, a coleta é cancelada e o combate passa a ter prioridade.
- A velocidade do personagem ao perseguir inimigos foi aumentada em 20%.
- Monstros só detectam, perseguem e atacam personagens no bioma correspondente; monstros de dungeon são tratados como exceção por pertencerem à instância.
- Das 00:00 às 03:59 no relógio virtual do servidor, monstros recebem bônus de dano, velocidade, alcance de percepção e frequência de ataque.
- Ao ser derrotado, o personagem retorna à Cidade do Centro, recupera vida e mana, reativa a automação e mantém nível, itens e progressão. A morte não é mais permanente.
- A cidade continua sendo uma zona segura sem monstros ou dano.

## Biomas
- Floresta Inicial: níveis 1–15.
- Marchas dos Orcs: níveis 15–20.
- Pântano Espectral: níveis 20–30.
- Os limites de distância entre biomas foram ampliados para dar aproximadamente o dobro de espaço de exploração.

## Relógio e interface
- O horário é calculado a partir do relógio enviado pelo servidor e exibido em formato 24 horas junto ao minimapa.
- O HUD mostra Sol ou Lua e destaca o período de perigo dos monstros entre meia-noite e 4 da manhã.
- A interface existente mantém ícones para mochila, mapa, habilidades, configurações, automação e poções.

## Arquivos principais
- `src/game/scenes/GameplayScene.js` — automação, coleta temporizada, combate, bônus noturnos e retorno à cidade.
- `src/game/resources/ResourceSystem.js` — tempos de coleta.
- `src/game/combat/DeathSystem.js` — respawn na cidade sem morte permanente.
- `src/game/world/BiomeSystem.js` — dimensões/níveis dos biomas, zona segura e modificadores noturnos.
- `src/game/world/WorldGenerator.js` — geração procedural sem árvores e pedras na zona segura.
- `src/game/combat/AudioSystem.js` — efeitos sonoros sintetizados de coleta.
- `src/game/ui/UIController.js` — relógio e atualizações de interface.
- `src/server/server.js` — relógio virtual compartilhado pelo servidor.
- `test/core.test.js` — testes automatizados dos sistemas.

## Validação
- `npm test`: 25 testes aprovados, 0 falhas.
- Sintaxe dos módulos JavaScript verificada com `node --check`.
- API `/api/world-time` e recursos da interface confirmados no servidor local.
