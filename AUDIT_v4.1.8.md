# AUDIT v4.1.8 — Hard Reset Route & Standalone Onboarding Shield Hotfix

Build: 20260624-142131  
Versão: 4.1.8  
Schema: 38

## Verificações

- Build/version sincronizados em `index.html`, `js/build.js`, `build-info.json`, `build/build-info.json`, `manifest.webmanifest` e `sw.js`.
- Nova aba `emergencystart` adicionada ao desktop e dock mobile.
- `emergencyStartControl` adicionado ao save e migração.
- Rota de emergência `?hardreset=1#emergencystart` adicionada.
- Overlay independente de boot para bloquear Dashboard vazio.
- Hard reset com backup local preservado antes de limpar primeiro acesso.
- Cache PWA versionado para v4.1.8.

## Resultado

A build está pronta para teste manual no mobile e PWA instalado.
