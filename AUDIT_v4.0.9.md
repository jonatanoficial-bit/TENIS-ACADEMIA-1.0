# AUDIT v4.0.9 — Release Notes, Help Center & First-Run Guide

Build: 20260623-120858
Data: 23/06/2026 12:08:58 America/Sao_Paulo
Schema: 29

## Escopo
- Central de ajuda offline dentro do jogo.
- Guia de primeiro uso com checklist local.
- Notas de versão da build acessíveis pela aba Ajuda/Release.
- Exportação local de relatório de suporte JSON.
- Manifest PWA com atalho para Ajuda e Guia Inicial.

## Anti-quebra
- Migração segura para `releaseNotesHelp`.
- Ações da central não alteram ranking, atletas, torneios, economia ou calendário.
- Exportação é local e não envia dados.
- Nenhum asset anterior foi removido.

## Validações
- node --check em js/main.js, js/state.js e js/build.js.
- JSON principal e manifest validados.
- HTML sem IDs duplicados.
- ZIP testado com integridade OK.
