# AUDIT v4.0.8 — Localization & Store Readiness Hotfix

Build: `20260623-114902`  
Data/hora: 23/06/2026 11:49:02 America/Sao_Paulo  
Schema: 28

## Escopo
- Nova aba Localização.
- Sistema `localizationStore` persistente.
- Diagnóstico de idioma PT-BR/EN/ES.
- Prévia de textos de loja.
- Exportação JSON de prontidão internacional.
- Manifest PWA com atalho de Localização e Loja.

## Proteção anti-quebra
- Migração automática para schema 28.
- Preset de loja usa snapshot e rollback.
- Auditorias não alteram ranking, atletas, torneios, economia ou calendário.
- Fallback PT-BR preservado.

## Validações planejadas
- node --check em JS principal, state e build.
- JSON validado.
- HTML sem IDs duplicados.
- Service Worker versionado.
- Integridade ZIP.

## Observação
A tradução completa de todo texto dinâmico ainda deve passar por revisão humana antes de publicação internacional em loja.
