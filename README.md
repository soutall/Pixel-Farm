# FARM OF PIXEL

Protótipo jogável de RPG idle 2D para navegador: Phaser 3, JavaScript, Express e salvamento local IndexedDB. O primeiro recorte implementa criação de personagem, classes, exploração procedural em chunks, coleta automática, Slime, combate, XP/nível, atributos, crafting e arma flutuante.

## Executar

Requer Node.js 18+. Na pasta do projeto:

```sh
npm install
npm start
```

Acesse http://localhost:8080. Para desenvolvimento com reinício automático: `npm run dev`. Testes do núcleo: `npm test`.

## Controles

Não há controle direto do personagem enquanto a automação está ativa. A barra inferior oferece botões para pausa, mochila, oficina, grupo, poções e habilidades. Teclas: **Espaço** pausa/retoma, **B** mochila, **C** oficina, **P** grupo, **K** habilidades, **M** mapa e **I** atributos. O botão de nova jornada encerra o personagem atual (morte permanente) e cria outro no centro.

O HUD inferior mostra as quatro habilidades da classe e o tempo de recarga. Em **Habilidades**, personagens recebem um ponto por nível e podem elevar habilidades até o nível 10. O radar mostra pontos de interesse próximos; **Mapa-múndi** mostra os biomas e chunks já explorados. Sons procedurais de combate e interface são sintetizados no navegador e iniciam após o primeiro toque/clique.

A barra inferior oferece mochila com abas e organização alfabética, oficina com espadões metálico, verde e violeta para Guerreiro, poções infinitas (recarga individual de 5 segundos) e pausa/retomada da automação. Autocombate e auto-poções de vida/mana começam ativados; os limiares podem ser configurados. Slimes violetas atacam com magia e deixam Gel Violeta; equipamento sorteia qualidade e afixos. Fogueiras iluminam o cenário, lagos são contornados pelo movimento automático, árvores balançam, há hora global servida por Express, passos, ambiente sintetizado, ferramentas animadas e sons distintos durante a coleta.

A mochila reserva slots para mão secundária, capacete, armadura, capa, anéis, colar, botas e luvas; permite comparar armas e desmontar múltiplas seleções em fragmentos. O minimapa abre o mapa ampliado, que permite retorno à Cidade do Centro. A progressão atual inclui Floresta Inicial (níveis 1–15), Marchas dos Orcs (15–20) e Pântano Espectral (20–30), com drops e receitas temáticos de Goblins, Orcs e Espectros. A Cripta dos Morcegos (nível 18+) tem ondas, o elite Vesper e filtros por nível/mecânica; a interface permite entrada solo ou para grupo de quatro.

Personagens novos e saves antigos iniciam com movimento/combate automático e auto-poções de vida e mana ativadas. A coleta leva 4 s para pedra, 3 s para madeira e 2 s para galhos; pode ser interrompida quando um inimigo ameaça o jogador. Árvores estão visualmente ampliadas sem mudar alcance ou colisão. Das 00:00 às 03:59 no relógio do servidor os monstros têm mais percepção, velocidade e dano. Ao ser derrotado, o aventureiro retorna à cidade com a mesma progressão, vida/mana restauradas e automação ligada; não há mais morte permanente.

À noite o mapa recebe uma máscara de até 90% de escuridão com áreas claras ao redor do personagem e das tochas/fogueiras. Os números de dano usam uma fonte pixelada original como referência estética de RPG retrô. O ambiente musical é gerado proceduralmente pelo Web Audio, sem baixar faixas de terceiros.

## Multiplayer autoritativo

O servidor Express mantém um mundo global por processo, disponibiliza uma seed persistente e simula a cada 50 ms movimento automático, colisões entre jogadores, IA/ataques de monstros, combate, dano, coleta única, recompensas, progressão, poções, crafting, equipamento e instâncias de dungeon. Clientes conectam por WebSocket, enviam intenções/comandos (não coordenadas de movimento) e renderizam snapshots do servidor; reconexões reutilizam um token de sessão local. O estado do mundo e sessões é gravado atomicamente em `data/multiplayer-world.json` (a pasta fica ignorada pelo Git). Party usa convite HTTP e a associação do socket é revalidada no servidor; dungeons em grupo exigem quatro membros da mesma party conectados, próximos e elegíveis.

Limites atuais: não há contas/senha nem recuperação de sessão entre dispositivos; o primeiro perfil local é importado com limites, mas não há histórico de confiança para provar que esse save nunca foi editado. O armazenamento é um arquivo local, single-processo, sem transações/backup/replicação; publicar para internet requer TLS/WSS e monitoramento/limites de operação. Testes do Node validam concorrência básica, persistência e protocolo, mas a renderização visual precisa ser conferida em navegadores reais e redes com latência.

O loop de renderização limita a reconstrução de chunks a 5 Hz quando o jogador cruza o mapa, IA e seleção de alvo a aproximadamente 10–12,5 Hz, animações/HP de pontos a 4 Hz e iluminação a 2 Hz. Painéis de atributos/recursos só alteram o DOM quando seus dados mudam; minimapa é redesenhado no máximo a 1 Hz.

A Cidade do Centro ocupa um círculo seguro de 520 unidades em torno de `(0,0)`: monstros não aparecem dentro dele, não perseguem nem causam dano ao personagem, e dungeons não podem ser iniciadas dali. Uma borda luminosa marca o limite.

## Estrutura

`src/game/` separa mundo, cenas, entidades, classes, combate/AI, recursos, crafting, inventário, atributos, progressão, armas, save, checkpoints, chat, renderização e UI. `src/server/AuthoritativeWorld.js` implementa a simulação e validação central, e `src/server/MultiplayerServer.js` liga essa simulação ao transporte WebSocket.

## Salvamento e mundo

No modo multiplayer, o servidor salva sessões e estado global em `data/multiplayer-world.json`; IndexedDB/localStorage preservam apenas o cache local e a compatibilidade de perfil. A seed e modificações do mundo são mantidas separadas do terreno derivado. O terreno e pontos de interesse são determinísticos por seed e coordenadas de chunk; o servidor mantém em memória chunks próximos aos jogadores e os reconstrói a partir da seed/estado salvo. Slimes fornecem Slime Gel usado na receita da Greatsword de Slime.

> Protótipo: combate e balanceamento são demonstrativos. Morte definitiva, histórico e reinício existem no modelo; checkpoints não revivem personagens.
