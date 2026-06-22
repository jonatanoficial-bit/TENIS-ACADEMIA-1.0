# Auditoria — Vale Games Tennis Manager v3.12.0

Build: 20260622-122215  
Data/hora: 22/06/2026 12:22:15 America/Sao_Paulo  
Fase: Premium Visual Academy  
Schema: 15

## Objetivo da fase

Transformar a apresentação geral do jogo em uma experiência mais premium e menos parecida com dashboard, preservando todos os sistemas das fases anteriores e reaproveitando os assets existentes.

## Itens implementados

- Nova aba `Academia Pro`.
- Novo hub visual `Premium Visual Academy`.
- Cenas persistentes em `state.visualAcademy`:
  - escritório do treinador;
  - centro de treinamento;
  - sala médica;
  - sala de análise tática;
  - rede de scouting;
  - circuito mundial;
  - arena de transmissão.
- Fundos dinâmicos por aba/ambiente com `body[data-scene]`.
- Botões `Focar` e `Abrir` com navegação segura para a aba relacionada.
- Histórico de ambiente salvo em `visualAcademy.environmentAudit`.
- Reaproveitamento de assets existentes:
  - `lobby-premium.png`;
  - `home-hero.png`;
  - `match-night.png`;
  - logos de torneios;
  - avatares de jogadores;
  - avatares de staff.

## Proteção anti-quebra

- Migração de save para schema 15.
- Criação automática de `visualAcademy` em saves antigos.
- Snapshot/rollback ao trocar ambiente visual.
- Fallback de imagens preservado via `data-asset-src`.
- Nenhum asset anterior foi removido.
- Cache PWA isolado da build v3.11.0.

## Mobile-first

- Hub visual adaptado para 320 px.
- Cards de ambiente em rolagem horizontal por toque no mobile.
- Botões de toque mantidos com altura adequada.
- Background dinâmico não bloqueia scroll.
- Dock mobile recebeu acesso rápido para `Academia`.

## Verificações executadas

- `node --check js/main.js`: OK.
- `node --check js/state.js`: OK.
- `node --check js/build.js`: OK.
- `python3 -m json.tool build-info.json`: OK.
- `python3 -m json.tool build/build-info.json`: OK.
- `python3 -m json.tool manifest.webmanifest`: OK.
- Verificação de IDs duplicados no HTML: OK.
- Sincronização de versão/build/schema: OK.
- Integridade do ZIP: OK.

## Observação

O teste headless em navegador não foi executado nesta fase por limitação do ambiente. Recomenda-se homologação manual em celular Android/iOS, especialmente rolagem do hub `Academia Pro`, troca de abas e abertura da partida.
