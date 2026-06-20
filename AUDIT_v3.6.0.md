# AUDITORIA v3.6.0 — Rebuild Match Engine & Premium Match Foundation

Build: 20260620-121454  
Data/hora visível: 20/06/2026 12:14:54  
Schema: 9

## Objetivo da fase
Transformar a partida de uma lógica arcade baseada quase só em overall para um motor de simulação ponto a ponto mais coerente com tênis real, usando assets existentes de torneios, avatares e fundo premium.

## Sistemas alterados
- `js/main.js`: substituição do fluxo de ponto, placar, estatísticas e relatório de partida.
- `index.html`: nova área de dossiê tático, estatísticas ao vivo e relatório premium na aba Partida.
- `css/styles.css`: ajustes mobile-first para o novo Broadcast Match Center.
- `js/build.js`, `build-info.json`, `build/build-info.json`, `sw.js`: versão/build/cache atualizados.
- `js/state.js`: schema atualizado para 9.

## Proteções anti-quebra
- Cada ponto cria snapshot da partida e do atleta antes do cálculo.
- Em erro de simulação, o estado anterior é restaurado.
- Atributos ausentes usam fallback seguro baseado em overall.
- Adversários antigos são enriquecidos automaticamente via `enrichPlayer()`.
- `resolveGame()` foi mantido como compatibilidade para saves antigos, mas o motor real usa `updateTennisScore()`.
- Cache PWA separado por versão para evitar mistura com v3.5.0.

## Simulação nova
- Primeira bola e segunda bola.
- Ace.
- Dupla falta.
- Rally com tamanho variável por consistência e superfície.
- Winner.
- Erro não forçado.
- Break point e conversão.
- Alternância de saque.
- Tiebreak em 6-6.
- Melhor de 3 sets.
- Momentum e pressão do placar.
- Influência de staff técnico, analista e psicólogo.
- Fadiga e saúde impactadas pela intensidade dos rallies.

## Mobile-first
Verificado no código e CSS:
- Painéis em uma coluna abaixo de 720px.
- Estatísticas compactas para 320px+.
- Botões continuam touch-friendly.
- Match side com rolagem própria em desktop, evitando página gigante.
- Conteúdos longos quebram linha em celular.
- Nenhuma ação depende de hover.

## Auditoria executada
- `node --check js/main.js`: aprovado.
- `node --check js/state.js`: aprovado.
- `node --check js/build.js`: aprovado.
- JSON validado: `build-info.json`, `build/build-info.json`, `content/base/base-pack.json`, `content/base/players.json`, `manifest.webmanifest`.
- IDs duplicados no `index.html`: nenhum encontrado.
- Verificação de presença dos novos painéis: `matchStatsPanel`, `matchReportPanel`, `matchScoutPanel`.

## Observação honesta
O ambiente bloqueou o teste headless por navegador com `ERR_BLOCKED_BY_ADMINISTRATOR`. Por isso, a auditoria desta fase ficou concentrada em sintaxe, integridade estrutural, JSON, HTML, CSS e lógica estática. A homologação manual no celular continua obrigatória.
