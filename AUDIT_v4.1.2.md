# AUDIT v4.1.2 — Cache/PWA Update Guard & First-Run Verification Hotfix

Build: 20260623-181210  
Data/hora: 23/06/2026 18:12:10 São Paulo  
Schema: 32

## Alterações principais
- Adicionado sistema persistente `cacheUpdateGuard`.
- Nova aba Cache/PWA.
- Registro explícito do Service Worker com cache-busting.
- Detecção de build anterior via `vale_tennis_last_seen_build`.
- Botões para auditar atualização, limpar caches antigos, confirmar primeiro acesso e recarregar build atual.
- Manifest PWA com atalho para atualização/cache.
- Service Worker atualizado para remover caches antigos e usar `no-store` na tentativa de rede.

## Testes executados
- `node --check js/main.js`
- `node --check js/state.js`
- `node --check js/build.js`
- JSON principal, build e manifest validados
- HTML verificado contra IDs duplicados
- Integridade do ZIP validada

## Resultado
A build está pronta para upload e teste. Ainda é recomendado validar em Chrome Android real após publicar, especialmente quando o celular estava preso em v4.0.8/v4.1.0.
