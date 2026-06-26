# AUDIT v4.1.4 — Mandatory New Career Gate & Empty Save Repair

Build: 20260624-103102  
Data: 26/06/2026 10:31:02  
Schema: 34

## Escopo
- Gate inicial obrigatório antes de liberar gameplay.
- Bloqueio de Dashboard vazio quando faltar treinador, avatar, país, academia ou base jogável.
- Aba Gate Inicial com auditoria, reparo de save vazio e exportação local.
- Reforço no switch de abas para impedir entrada em Atletas, Treino, Partida e Calendário sem criação completa.
- Preservação de backup antes de recriar base segura.

## Testes executados
- node --check js/main.js
- node --check js/state.js
- node --check js/build.js
- node --check js/contentLoader.js
- node --check sw.js
- JSON build-info/manifest/content
- HTML sem IDs duplicados
- Integridade ZIP

## Observação
Teste manual em Android/iOS ainda é recomendado, principalmente após limpar cache/PWA antigo.
