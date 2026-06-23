# Auditoria v4.0.5 — Browser Compatibility & Install QA Hotfix

Build: `20260622-193123`  
Data: `22/06/2026`  
Hora: `19:31:23`  
Schema: `25`

## Objetivo

Reforçar a build candidata comercial com ferramentas internas para validação de navegador, PWA instalado, cache, save local, viewport real, toque mobile e exportação de relatório de compatibilidade.

## Itens implementados

- Nova aba **Compatibilidade**.
- Novo estado persistente `browserCompatibility`.
- Migração automática para saves antigos.
- Auditoria de ambiente real no navegador.
- Matriz de compatibilidade para Android, iOS, desktop, PWA, cache, save e toque.
- Preset de instalação segura.
- Limpeza segura de caches antigos do app.
- Exportação local de relatório JSON.
- Novo shortcut PWA para abrir compatibilidade.

## Verificações estáticas

- `node --check js/main.js`: OK.
- `node --check js/state.js`: OK.
- `node --check js/build.js`: OK.
- JSONs principais validados: OK.
- IDs duplicados no HTML: nenhum encontrado.
- Service Worker atualizado para cache v4.0.5.

## Observação

A validação real de instalação PWA em iOS/Android precisa ser feita manualmente no dispositivo, pois depende do navegador e do sistema operacional.
