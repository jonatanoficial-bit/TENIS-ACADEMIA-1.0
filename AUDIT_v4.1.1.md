# AUDIT v4.1.1 — Onboarding Flow & Button Reliability Hotfix

Build: 20260623-150206
Data/hora: 23/06/2026 15:02:06 America/Sao_Paulo
Schema: 31

## Objetivo
Blindar o problema real visto no celular: jogo abrindo no Dashboard com carreira incompleta, botões aparentemente sem resposta e fluxo de criação de carreira ausente.

## Correções
- Nova aba `Fluxo Inicial`.
- Novo estado persistente `onboardingReliability`.
- Delegação global de cliques/taps para abas, dock, botões de setup e botões críticos.
- Reabertura automática do modal de criação caso a carreira não tenha nome, avatar, país, cidade e academia.
- Auditoria de botões críticos e exportação local de relatório.
- CSS reforçado para modal de criação no mobile, botão salvar sticky e campos com `touch-action: manipulation`.

## Validações feitas
- `node --check js/main.js`
- `node --check js/state.js`
- `node --check js/build.js`
- JSONs principais válidos
- Manifest PWA válido
- HTML sem IDs duplicados
- Service Worker versionado
- ZIP íntegro

## Observação
Teste manual ainda é necessário no celular real após limpar cache/PWA, porque Chrome Android e Vercel podem servir Service Worker antigo por alguns minutos.
