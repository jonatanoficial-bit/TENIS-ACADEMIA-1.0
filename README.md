# Vale Games Tennis Manager v4.8.2

Build `20260626-124500` — **Boot Recovery: Embedded Content Fallback & No-JS Shield**.

## Objetivo

Esta build corrige o problema visto no print: o jogo ficava preso no lobby/Dashboard vazio, com build antiga no topo e botões sem resposta.

## Correções principais

- Conteúdo essencial embutido no `contentLoader`: se `content/manifest.json`, `players.json` ou `tournaments.json` falharem, o jogo não trava mais.
- `boot()` agora não chama o carregamento externo duas vezes após erro; ele cai em fallback seguro e continua.
- Escudo inline no `index.html`: se `js/main.js` não carregar, o usuário vê uma mensagem clara em vez de ficar preso no lobby.
- Botões críticos `Configurar`, `Configurar agora`, `Corrigir` e `Salvar criação` têm proteção emergencial.
- Diagnóstico local `window.exportBootRecoveryDiagnostic()` para identificar JS ausente, cache antigo, content ausente ou save vazio.
- Schema atualizado para 46.

## Como validar depois do upload

O topo precisa mostrar:

```text
v4.8.2 • 26/06/2026 • 12:45:00
```

Se aparecer `v4.7.0`, o site ainda não recebeu a build nova ou o navegador/PWA está segurando cache antigo.

## Arquivos obrigatórios no upload

Não envie apenas `index.html`. O deploy precisa incluir também:

```text
js/
css/
content/
build/
assets/
manifest.webmanifest
sw.js
build-info.json
```
