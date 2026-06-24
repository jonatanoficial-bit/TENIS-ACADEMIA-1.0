# AUDIT v4.1.7 — Clean Start Wizard & Deploy Verification Hotfix

Build: `20260624-123742`  
Versão: `4.1.7`  
Schema: `37`  
Fase: Clean Start Wizard & Deploy Verification Hotfix

## Objetivo

Corrigir o cenário prático em que o navegador, PWA ou Vercel mantém build antiga/cache antigo e o jogador continua caindo em Dashboard vazio ou save parcial mesmo após hotfixes de onboarding.

## Implementações

- Nova aba `Início Limpo` / `#cleanstart`.
- Novo estado persistente `cleanStartWizard`.
- Verificação de build visível no topo, overlay e runtime stamp.
- Verificação de build JS atual (`BUILD_INFO`).
- Verificação de localStorage gravável.
- Verificação de Service Worker e Cache API.
- Botão de início limpo guiado com backup local antes de resetar o primeiro acesso.
- Botão para limpar caches `vale-tennis-*` e recarregar com `?fresh=`.
- Integração com `forceOnboardingLauncher()` para abrir criação obrigatória.
- Exportação local de relatório JSON.
- Manifest PWA com atalho para `#cleanstart`.

## Auditoria técnica executada

- `node --check js/main.js`
- `node --check js/state.js`
- `node --check js/build.js`
- `node --check js/contentLoader.js`
- `node --check sw.js`
- JSONs principais validados.
- Manifest PWA validado.
- HTML sem IDs duplicados.
- Build sincronizada.
- ZIP final testado com integridade.

## Observação

A limpeza de cache real no celular depende do Chrome/Safari e do modo PWA instalado. Por isso a build inclui botão interno e também recomenda limpar dados do site ou reinstalar o PWA se o topo ainda mostrar build antiga.
