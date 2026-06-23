
## Build v4.1.2 — Cache/PWA Update Guard

Esta build adiciona uma aba Cache/PWA para confirmar a versão carregada no celular, registrar o Service Worker com cache-busting, limpar caches antigos e confirmar o primeiro acesso. Foi criada para evitar que o Chrome/PWA continue exibindo builds antigas como v4.0.8 depois do upload.

Versão: v4.1.2  
Build: 20260623-181210  
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
