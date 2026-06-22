# AUDIT v4.0.2 — Release Hardening & Diagnostics

Build: 20260622-190812  
Data: 22/06/2026  
Hora: 19:08:12 — São Paulo  
Schema: 22

## Escopo
- Adicionada aba Diagnóstico.
- Incluído sistema persistente `releaseHardening`.
- Criados checks de startup guard, save local, cache/PWA, fallback de assets e safe area mobile.
- Botões internos para auditoria hardening, diagnóstico PWA/cache e modo recuperação.
- Versão/build/data/hora mantidas visíveis no jogo.

## Anti-quebra
- Migração automática para schema 22.
- Saves antigos recebem `releaseHardening` sem perder dados.
- Modo recuperação não altera ranking, torneios, carreira ou atributos.
- Diagnósticos registram logs sem destruir a carreira.

## Validação executada
- node --check js/main.js
- node --check js/state.js
- node --check js/build.js
- JSON build-info e build/build-info válidos
- Service Worker versionado
- Integridade ZIP OK

## Observação
Homologação manual em celular real ainda é recomendada após upload: instalar PWA, limpar cache antigo, abrir offline, testar save e alternar abas.
