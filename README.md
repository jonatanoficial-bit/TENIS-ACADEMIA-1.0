# Vale Games Tennis Manager — v4.5.0

Build `20260624-154349` — Real Season Objectives & Board Pressure.

## Destaques v4.5.0
- Nova aba **Temporada**.
- Metas reais por ambição: Sobrevivência, Profissional, Agressivo e Elite mundial.
- Diretoria avalia ranking, caixa, reputação, títulos e fluxo semanal.
- Pressão do board altera confiança, inbox, logs e reputação se a crise ficar alta.
- Exportação JSON local do relatório de metas.

# Vale Games Tennis Manager v4.4.0

Build `20260624-152754` — Academy Facilities Expansion

## v4.4.0 — Academy Facilities Expansion

Esta fase expande a academia com uma camada de infraestrutura jogável: quadras por superfície, centro técnico, centro físico, centro médico, alojamento, análise, scouting, marketing, financeiro e manutenção operacional.

Principais pontos:

- Nova aba **Instalações**.
- Sistema persistente `academyFacilitiesPro`.
- Manutenção semanal real adicionada aos custos.
- Política de manutenção: econômico, equilibrado ou premium.
- Plano de expansão: alta performance, comercial, base global ou pisos.
- Upgrades com custo progressivo, impacto em reputação, treino, recuperação, scouting e patrocínio.
- Relatório local exportável em JSON.
- Compatibilidade mantida com Dashboard, Treino, Economia, Match Center e PWA.

# Vale Games Tennis Manager — v4.2.0

Build `20260624-145253` — **Full Start Screen Rebuild & Career Creator 2.0**.

Esta build adiciona uma central de **Início Limpo** para resolver o problema prático de navegador/PWA preso em versão antiga ou save parcial. Ela verifica se a build exibida no topo bate com o JavaScript carregado, testa save local, Service Worker, cache e força a criação de carreira quando o Dashboard vazio ainda aparece.

Schema do save: 37.

## Correções principais da v4.2.0

- Nova aba **Início Limpo**.
- Novo sistema `cleanStartWizard` no save.
- Botão **Verificar deploy agora** para comparar build visível, build JS, cache e save.
- Botão **Início limpo guiado** com backup local antes de recriar o primeiro acesso.
- Botão **Limpar cache e recarregar** para remover caches antigos do app.
- Botão **Abrir criação** ligado ao launcher obrigatório de carreira.
- Exportação local de diagnóstico clean start.
- Manifest PWA com atalho para `#cleanstart`.

---

# Vale Games Tennis Manager — v4.1.6

Build `20260624-114913` — **Onboarding Runtime Test & Mobile Proof Hotfix**.

Esta build adiciona uma prova visual/runtime do fluxo inicial. Ela mostra em tempo real se o Dashboard vazio está bloqueado, se a criação de carreira abriu acima do layout e se o navegador atual está carregando a build correta.

Schema do save: 36.

## Correções principais da v4.1.6

- Nova aba **Prova Mobile**.
- Novo sistema `onboardingRuntimeProof` no save.
- Overlay de bloqueio visual quando a carreira está inválida e o modal ainda não apareceu.
- Botão **Executar prova agora** para forçar e auditar a abertura do onboarding.
- Botão **Confirmei no celular** para registrar a validação manual da build.
- Exportação de relatório local da prova runtime.
- Manifest PWA com atalho para a prova mobile do onboarding.

---

# Vale Games Tennis Manager — v4.1.5

Build `20260624-104720` — **Forced Onboarding Launcher & Invalid Career Block**.

Esta build corrige o problema visto nos prints: o jogo não deve abrir no Dashboard quando ainda não existe carreira válida. Agora, se faltar treinador, avatar, país, cidade, nome da academia, atleta ativo, ranking, calendário ou caixa inicial, o gameplay é bloqueado e a criação de carreira abre em tela cheia.

Schema do save: 35.

## Correções principais da v4.1.5

- Dashboard inválido bloqueado antes de renderizar gameplay.
- Botões **Configurar** e **Configurar agora** acionam o launcher obrigatório.
- Modal de criação fica acima de tudo no mobile, escondendo dock e barra rápida.
- Save vazio/parcial/corrompido é reparado com backup local.
- Validação estrita de nome, avatar, país, cidade e academia.
- Cache/PWA atualizado com versionamento v4.1.5.
- Documentos adicionados: `AUDIT_v4.1.5.md` e `FORCED_ONBOARDING_CHECKLIST_v4.1.5.md`.

---

# Vale Games Tennis Manager — v4.1.5

Build `20260624-104720` — **Forced Onboarding Launcher & Invalid Career Block**.

Esta build bloqueia completamente o caso visto no celular: Dashboard aberto sem carreira criada, sem avatar, sem atletas e com botões parecendo travados. Antes de liberar Atletas, Treino, Partida, Calendário ou Ranking, o jogo confirma nome do treinador, país, avatar, cidade, nome da academia e base jogável. Se houver save vazio/corrompido, a aba **Gate Inicial** permite reparar com backup local.

Schema do save: 35.


## v4.1.5 — Forced Onboarding Launcher & Invalid Career Block (20260624-104720)

- Gate inicial obrigatório antes de liberar gameplay.
- Bloqueio contra Dashboard vazio sem treinador/avatar/academia.
- Aba Gate Inicial com auditoria, reparo e exportação local.
- Navegação para gameplay é redirecionada para criação se a carreira não estiver completa.
- Schema 35.



## Build atual — v4.1.3

Fase: Career Creation UX & Avatar Selector Final Fix  
Build: `20260623-183105`  
Schema: `33`

Esta versão reforça a criação de carreira, seleção de avatar e confiabilidade dos botões iniciais no mobile/PWA. A nova aba `Criação` permite abrir o modal, ativar avatar, auditar o botão de salvar e iniciar reset guiado de primeiro acesso.

## Build v4.1.3 — Cache/PWA Update Guard

Esta build adiciona uma aba Cache/PWA para confirmar a versão carregada no celular, registrar o Service Worker com cache-busting, limpar caches antigos e confirmar o primeiro acesso. Foi criada para evitar que o Chrome/PWA continue exibindo builds antigas como v4.0.8 depois do upload.

Versão: v4.1.3  
Build: 20260623-183105  
Schema: 32

# Vale Games Tennis Manager — v4.1.1

Build `20260623-150206` — **Onboarding Flow & Button Reliability Hotfix**.

Esta build reforça o problema real visto no mobile: jogo abrindo no Dashboard antes da criação de carreira, botões que parecem não responder e fluxo de nome/avatar/país/academia ausente. Agora há uma aba **Fluxo Inicial**, delegação global de clique/toque, reabertura automática do modal obrigatório de criação e auditoria local dos botões críticos.

Arquivos principais: `index.html`, `js/main.js`, `js/state.js`, `js/contentLoader.js`, `css/styles.css`, `manifest.webmanifest`, `sw.js`.

Schema do save: 31.

## Correções principais

- Modal de criação de carreira reaberto automaticamente quando a carreira ainda não está completa.
- Nova aba **Fluxo Inicial** para auditar onboarding, botões, abas e dock mobile.
- Fallback de delegação global para cliques/taps em botões críticos.
- Botão de salvar criação de carreira reforçado e sticky no mobile.
- Exportação local de relatório de onboarding.
- Cache PWA versionado para v4.1.1.

## Caminho Git Bash

```bash
cd "C:/Users/jonat/Desktop/GAME/¨2026/TENIS"
git status
git add .
git commit -m "Build v4.1.1 Onboarding Flow Button Reliability Hotfix 20260623-150206"
git push -u origin main
```

---

# Vale Games Tennis Manager — v4.0.5

Build `20260622-193123` — Browser Compatibility & Install QA Hotfix.

Esta build adiciona a central **Compatibilidade**, focada em Android, iOS, desktop, PWA instalado, cache versionado, save local, viewport real, toque mobile e exportação de relatório de ambiente.

## Novidades v4.0.5

- Nova aba **Compatibilidade**.
- Novo sistema persistente `browserCompatibility`.
- Auditoria de navegador e instalação PWA.
- Matriz Android Chrome/Edge, iOS Safari, desktop, PWA instalado, offline/cache, save local e toque.
- Preset de instalação segura para testes em PWA/mobile.
- Limpeza segura de caches antigos do app.
- Exportação local de relatório de compatibilidade em JSON.
- Save migrado para schema 25.

## Caminho Git Bash

```bash
cd "C:/Users/jonat/Desktop/GAME/¨2026/TENIS"
git status
git add .
git commit -m "Build v4.0.5 Browser Compatibility Install QA Hotfix 20260622-193123"
git push -u origin main
```


## Build v4.1.0 — Localization & Store Readiness Hotfix

Esta build adiciona a central Localização/Loja para preparação internacional PT-BR/EN/ES, diagnóstico de cobertura textual, prévia de textos de loja, exportação de relatório JSON e preset seguro para publicação. O schema do save foi atualizado para 28 com migração automática e preservação de todos os sistemas anteriores.


## v4.1.0 — Career Setup Recovery & Safe Start Hotfix

A build adiciona uma central Ajuda/Release offline com guia de primeiro uso, notas de versão internas, checklist de onboarding e exportação local de relatório de suporte. Schema 30.

## v4.1.0 — Hotfix de início seguro

Esta versão corrige o problema em que saves antigos ou incompletos podiam abrir o jogo direto no Dashboard com reputação, patrocínio, custos e atletas zerados. A build agora detecta automaticamente base quebrada, recria elenco/ranking/calendário e força a tela de criação de carreira para escolher nome, país, avatar e academia.


## v4.1.1 — Onboarding Flow & Button Reliability Hotfix

- Build `20260623-150206` com schema 31.
- Nova aba Fluxo Inicial para auditar criação de carreira, botões críticos, dock mobile, abas e abertura obrigatória do onboarding.
- Reforço de delegação global de clique/tap para botões e abas quando o navegador mobile falhar em listeners diretos.
- Reabertura automática do modal de carreira quando nome, avatar, país ou academia ainda não estiverem configurados.
- Exportação local de relatório de onboarding sem envio de dados.

### v4.2.0 — Full Start Screen Rebuild & Career Creator 2.0

Esta build adiciona um caminho de emergência para quando o navegador/PWA insistir em abrir Dashboard vazio ou save parcial:

```text
index.html?hardreset=1#emergencystart
```

A nova aba **Reset/Onboarding** permite limpar cache, criar backup local, resetar apenas o primeiro acesso e abrir obrigatoriamente a criação de carreira com avatar, nome, país, cidade e academia.



## v4.4.0 — Match Visual 2D Broadcast Upgrade

Build `20260624-152754`. Adiciona transmissão 2D com câmera de TV, câmera do técnico, mapa tático, modo mobile limpo, heatmap dos últimos pontos, rastro da bola e exportação local de diagnóstico.
