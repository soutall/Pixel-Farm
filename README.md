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

À noite o mapa recebe uma máscara de até 90% de escuridão com áreas claras ao redor do personagem e das tochas/fogueiras. Os números de dano usam uma fonte pixelada original como referência estética de RPG retrô. O relógio de mundo vem do mesmo endpoint HTTP em todas as sessões. Grupos possuem convite por link e lista consultada via HTTP; apesar da validação de grupo completo para dungeon, a instância ainda roda localmente por jogador: não há sincronização de posições, avatares ou combate cooperativo por WebSocket. O ambiente musical é gerado proceduralmente pelo Web Audio, sem baixar faixas de terceiros.

O loop de renderização limita a reconstrução de chunks a 5 Hz quando o jogador cruza o mapa, IA e seleção de alvo a aproximadamente 10–12,5 Hz, animações/HP de pontos a 4 Hz e iluminação a 2 Hz. Painéis de atributos/recursos só alteram o DOM quando seus dados mudam; minimapa é redesenhado no máximo a 1 Hz.

A Cidade do Centro ocupa um círculo seguro de 520 unidades em torno de `(0,0)`: monstros não aparecem dentro dele, não perseguem nem causam dano ao personagem, e dungeons não podem ser iniciadas dali. Uma borda luminosa marca o limite.

## Estrutura

`src/game/` separa mundo, cenas, entidades, classes, combate/AI, recursos, crafting, inventário, atributos, progressão, armas, save, checkpoints, chat, renderização e UI. O servidor oferece relógio global e serviço básico de convite/lista de grupo; autoridade de combate/mundo e multiplayer completo ainda não estão implementados.

## Salvamento e mundo

O progresso é salvo localmente em IndexedDB; a seed e modificações do jogador são mantidas separadas do terreno derivado. O terreno e pontos de interesse são determinísticos por seed e coordenadas de chunk. A implementação mantém uma janela de chunks em memória e reconstrói chunks descarregados. Slimes fornecem Slime Gel usado na receita da Greatsword de Slime.

> Protótipo: combate e balanceamento são demonstrativos. Morte definitiva, histórico e reinício existem no modelo; checkpoints não revivem personagens.
