# AUDIT v4.0.6 — Input, Touch & Scroll Reliability Hotfix

Build: `20260623-102045`  
Data/Hora: 23/06/2026 10:20:45 America/Sao_Paulo  
Schema: 26

## Escopo
- Nova aba `Toque/Rolagem` (`tab-input`).
- Sistema persistente `inputReliability` no save.
- Diagnóstico de toque, ponteiro, viewport, teclado virtual e rolagem.
- Preset seguro para telas pequenas e PWA instalado.
- Exportação de relatório local JSON.

## Proteção anti-quebra
- Migração automática de saves antigos para schema 26.
- Auditorias não alteram ranking, torneios, economia, atletas ou calendário.
- Preset seguro altera apenas preferências visuais/mobile.
- Comando de destravar rolagem restaura overflow sem resetar carreira.

## Validação executada
- `node --check js/main.js`
- `node --check js/state.js`
- `node --check js/build.js`
- JSON principal validado.
- HTML sem IDs duplicados.
- Service Worker atualizado.
- ZIP final testado com integridade OK.

## Homologação manual recomendada
- Android Chrome: rolagem em todas as abas, botões do dock e teclado em campos de texto.
- iPhone Safari/PWA: safe area, teclado virtual e retorno ao topo.
- Desktop: mouse/teclado e troca de abas.
