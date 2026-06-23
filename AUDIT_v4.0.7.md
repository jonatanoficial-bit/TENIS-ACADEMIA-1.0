# AUDIT v4.0.7 — Accessibility, Readability & Text Scaling Hotfix

Build: 20260623-112101  
Data: 23/06/2026 11:21:01 São Paulo  
Schema: 27

## Escopo
- Nova aba Acessibilidade.
- Novo sistema persistente `accessibilityReadability`.
- Auditoria interna de contraste, texto pequeno, foco visível, rótulos/ARIA e leitura em mobile.
- Modos visuais: texto grande, alto contraste, modo leitura, redução de transparência e foco reforçado.
- Exportação local de relatório JSON de acessibilidade.

## Proteção anti-quebra
- Migração de saves antigos para schema 27.
- Alterações de acessibilidade não alteram ranking, torneios, atletas, economia ou calendário.
- Classes visuais aplicadas somente em runtime e persistidas com segurança no save.
- Fallback caso navegador não suporte APIs de media query.

## Validações executadas
- `node --check js/main.js`.
- `node --check js/state.js`.
- `node --check js/build.js`.
- JSONs principais validados.
- Manifest PWA validado.
- HTML auditado contra IDs duplicados.
- ZIP final validado com `unzip -tq`.

## Observação de homologação
Ainda é recomendado testar manualmente em Android, iPhone/iPad e PWA instalado para confirmar contraste real, tamanho de texto, foco por teclado e leitura em telas pequenas.
