# AUDIT_v3.7.0 — Broadcast Match Center Pro

**Build:** 20260620-131729  
**Data/hora:** 20/06/2026 13:17:29 America/Sao_Paulo  
**Schema:** 10  
**Base preservada:** v3.6.0 Rebuild Match Engine & Premium Match Foundation

## Objetivo da fase

Transformar a tela de partida em uma experiência mais próxima de transmissão premium, preservando o motor ponto a ponto criado na v3.6.0 e adicionando controles rápidos de simulação, apresentação pré-jogo, mini replay, leitura tática e melhor uso dos assets existentes.

## Alterações implementadas

- Criado painel `Broadcast Match Center Pro` acima da partida.
- Adicionados cards com logo do torneio, categoria, piso, rodada e build visível.
- Criados cards comparativos de atleta e adversário com avatar, país, ranking, overall, forma e saúde.
- Adicionados botões:
  - Simular ponto;
  - Simular game;
  - Simular set;
  - Simular partida;
  - Pausa tática.
- Último ponto agora registra velocidade do saque, direção, tipo do ponto, rally e leitura do analista.
- Estatísticas ao vivo ampliadas com momentum, velocidade do último saque e rally médio.
- Canvas da partida agora muda visualmente conforme o piso: hard, clay, grass e indoor.
- Adicionado mini replay textual dos últimos pontos.
- Atualizados `build-info.json`, `build/build-info.json`, `js/build.js`, `sw.js`, `index.html`, `README.md` e `CHANGELOG.md`.

## Proteção anti-quebra

- `simulateCurrentGame`, `simulateCurrentSet` e `simulateFullMatch` usam `withMatchGuard`.
- Cada simulação cria snapshot da partida e do atleta antes da execução.
- Em caso de falha, o estado anterior é restaurado e o erro aparece como falha recuperável.
- Simulação de game possui limite de 90 pontos.
- Simulação de set possui limite de 520 pontos.
- Simulação de partida possui limite de 1200 pontos.
- Saves antigos são migrados para schema 10 com bloco `broadcast` opcional.
- O jogo mantém fallback de assets para logos, jogadores e staff.

## Auditoria mobile-first

Verificado por inspeção estática:

- Novo painel usa layout de uma coluna em telas menores que 760px.
- Cards dos jogadores viram pilha vertical em celulares.
- Botões de simulação têm área de toque maior e quebram para uma coluna abaixo de 380px.
- Estatísticas compactam para duas colunas em mobile e uma coluna em telas muito estreitas.
- Canvas mantém proporção e altura mínima para celulares.
- Nenhuma interação nova depende de hover ou mouse.
- Build/data/hora seguem visíveis no HUD, badge mobile e partida.

## Testes concluídos

- `node --check` em todos os arquivos JavaScript: OK.
- Validação de todos os JSONs do projeto: OK.
- Verificação de IDs duplicados no `index.html`: OK, nenhum duplicado.
- Verificação de presença dos novos IDs de interface: OK.
- Sincronização de versão/build/schema em arquivos principais: OK.
- Integridade do ZIP final: OK.

## Teste não concluído no ambiente

O teste com navegador headless/Chromium foi bloqueado pelo ambiente com:

`net::ERR_BLOCKED_BY_ADMINISTRATOR`

Portanto ainda é necessária homologação manual em celular real ou navegador local após subir no GitHub Pages.

## Resultado

A v3.7.0 não altera a base de carreira, ranking, staff, treino e torneios. Ela melhora a experiência central da partida e prepara a próxima fase para o sistema de identidade visual dos torneios e chave real de competição.
