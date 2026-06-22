# AUDIT v4.0.3 — Performance & Asset Delivery Hotfix

Build: `20260622-193746`  
Data/Hora: 22/06/2026 19:37:46 — São Paulo  
Schema: 23

## Escopo
- Atualização da build para v4.0.3.
- Nova aba `Performance`.
- Sistema persistente `performanceDelivery`.
- Auditoria de imagens renderizadas no DOM.
- Lazy loading e async decoding para avatares/logos gerados dinamicamente.
- Warmup de assets críticos para sessão mobile.
- Modo leve mobile sem alterar gameplay.
- Cache PWA versionado para v4.0.3.

## Anti-quebra
- Saves antigos migram para schema 23.
- `performanceDelivery` é criado automaticamente.
- Auditoria de assets não altera ranking, torneios, atletas ou economia.
- Modo leve aplica apenas ajustes visuais/UX.
- Fallback de assets anterior foi preservado.

## Mobile-first
- Aba Performance no dock mobile.
- Cards adaptados para 320 px.
- Botões empilháveis em telas pequenas.
- Redução de movimento e compactação visual disponíveis via modo leve.

## Auditoria técnica executada
- `node --check js/main.js`
- `node --check js/state.js`
- `node --check js/build.js`
- JSONs principais validados
- Service Worker atualizado
- Build sincronizada
- ZIP final validado

## Observação
Teste manual em celular/PWA continua recomendado após upload, especialmente para cache antigo do navegador e instalação prévia do app.
