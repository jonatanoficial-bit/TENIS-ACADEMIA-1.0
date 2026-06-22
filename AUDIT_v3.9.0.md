# AUDIT v3.9.0 — Real Draws & Tournament Life

Build: 20260622-101533  
Data/hora: 22/06/2026 10:15:33 America/Sao_Paulo  
Schema: 12

## Objetivo da fase

Transformar a experiência de torneio em uma estrutura mais próxima de um circuito real, reduzindo a sensação arcade e conectando calendário, identidade visual, chave, qualifying, entrada por ranking, wild cards, resultados paralelos e histórico de campeões.

## Implementações principais

- Criado sistema de chave real por tamanho de evento: 8, 16, 32, 64 e 128.
- Eventos com drawSize parcial, como 28/56, agora geram bracket maior com BYE.
- Jogadores possuem tipo de entrada na chave: DA, Q, WC e seed.
- Cabeças de chave são distribuídos em posições de bracket por seeding.
- Criada camada de qualifying quando o atleta não está no corte principal.
- Criada função `createTournamentRun()` para garantir torneio ativo consistente.
- Criada função `pickOpponent()` como fallback seguro para partidas antigas/sem chave.
- `pickDrawOpponent()` agora entende qualifying e rodada principal.
- `advanceDrawRound()` simula partidas paralelas, zebras, BYE e W/O.
- Títulos da academia registram histórico em `tournamentLife.championHistory`.
- World Tour também registra campeões no histórico persistente.
- Modal de chave ganhou estatísticas, qualifying, colunas roláveis e histórico.

## Anti-quebra

- Saves antigos migram automaticamente para schema 12.
- `tournamentDraws` e `tournamentLife` são criados em saves antigos.
- Fallback de adversário permanece ativo quando a chave não possui oponente válido.
- Eventos sem logo, cidade, ranking de corte ou drawSize usam valores seguros.
- Eventos bloqueados por ranking não travam o fluxo; geram mensagem de inbox/log.
- Chaves antigas da v3.8 são regeneradas quando não possuem estrutura v3.9.

## Mobile-first

- Modal de chave em celulares vira painel inferior.
- Chaves usam rolagem horizontal por toque.
- Qualifying usa cards horizontais em telas estreitas.
- Estatísticas da chave viram grade compacta.
- Breakpoints revisados para 720 px e 360 px.
- Botões e chips permanecem tocáveis em 320 px.

## Verificações executadas

- `node --check` em todos os arquivos JS principais, módulos e core.
- Validação de todos os arquivos JSON.
- Verificação de IDs duplicados no HTML.
- Verificação de build visível no HTML, build.js, build-info.json e cache PWA.
- Verificação de schema 12 em `state.js`, `build-info.json` e index.
- Integridade do ZIP final.

## Observação

O teste automatizado real em navegador pode ser bloqueado em alguns ambientes por política administrativa. A homologação manual recomendada é abrir o jogo no celular, iniciar carreira, entrar em torneio, abrir a chave, jogar qualifying/chave principal e avançar semanas para validar histórico de campeões.
