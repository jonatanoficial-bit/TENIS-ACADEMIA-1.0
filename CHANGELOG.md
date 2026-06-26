# v4.8.1 — Boot Recovery: Embedded Content Fallback & No-JS Shield

Build `20260626-105500` • Schema 46.

## Corrigido

- Lobby/Dashboard vazio quando o JS principal ou o conteúdo externo não carregavam.
- Botões sem resposta por falha de boot antes do `bindUI()`.
- `loadContent()` agora usa fallback embutido se o pacote de conteúdo estiver ausente/incompleto.
- `boot()` não tenta repetir o mesmo carregamento quebrado no bloco de erro.
- Adicionado escudo inline no HTML para detectar upload incompleto da pasta `js/content` ou cache antigo.

## Adicionado

- `getFallbackContent()` em `js/contentLoader.js`.
- `window.__valeTennisModuleLoaded` e `window.__valeTennisBootReady`.
- `window.exportBootRecoveryDiagnostic()`.
- Proteção emergencial para abrir a criação de carreira mesmo antes do módulo principal confirmar boot.
