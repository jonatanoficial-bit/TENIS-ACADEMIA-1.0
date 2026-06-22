# Auditoria — Vale Games Tennis Manager v3.13.0

Build: 20260622-132440  
Data/hora: 22/06/2026 13:24:40 BRT  
Fase: Global Tennis Newsroom  
Schema: 16

## Escopo da fase

- Adicionar aba `Newsroom`.
- Criar feed global de notícias e rumores.
- Criar sala de imprensa com perguntas e respostas.
- Conectar mídia a ranking, calendário, lesões, patrocínio e carreira humana.
- Reforçar mobile-first e preservar todos os assets existentes.

## Anti-quebra aplicado

- `newsroom` criado automaticamente em saves antigos.
- Migração para schema 16.
- Geração semanal usa `lastProcessedToken` para evitar duplicação de notícias.
- Botão `Gerar pauta` possui snapshot e restauração em caso de falha.
- Resposta de coletiva possui snapshot de newsroom, elenco, academia e inbox.
- Fallback para ausência de torneio, atleta, logo ou ranking.
- Nenhum asset anterior foi removido.

## Auditoria técnica

- `node --check js/main.js`: aprovado.
- `node --check js/state.js`: aprovado.
- `node --check js/build.js`: aprovado.
- JSON `build-info.json`: aprovado.
- JSON `build/build-info.json`: aprovado.
- JSONs principais de conteúdo: aprovados.
- IDs duplicados no HTML: nenhum encontrado.
- Service Worker atualizado para `vale-tennis-v3.13.0-20260622-132440`.
- Build, versão, data e hora sincronizados.

## Auditoria mobile-first

- Aba Newsroom usa grid de uma coluna em telas estreitas.
- Cards de notícia usam leitura compacta.
- Ações de coletiva viram botões empilhados no mobile.
- Layout suporta 320 px sem depender de hover/mouse.
- Dock mobile recebeu acesso direto à aba News.

## Observação

A validação estática foi concluída. A homologação manual em celular real ainda é recomendada para verificar rolagem, toque e cache PWA após upload no GitHub Pages.
