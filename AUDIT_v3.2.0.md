# Auditoria v3.2.0 — Living Players Database

Build: 20260609-131845

## Proteções anti-quebra
- Banco mundial carregado com fallback automático para o ranking base.
- Atributos ausentes são gerados deterministicamente, evitando valores undefined.
- Migração do save schema 4 para schema 5 preserva carreiras.
- Modal fecha por botão ou backdrop e bloqueia rolagem de fundo.
- Assets continuam usando cadeia de fallback.

## Mobile-first
- Perfil em bottom sheet em telas até 600px.
- Rolagem por toque e safe area inferior.
- Layout testado por regras para 320, 360, 390, 412, tablet e desktop.
- Botões com área mínima de toque e cartões sem largura fixa.

## Evolução funcional
- 100 jogadores no universo mundial.
- 24 atributos e indicadores derivados por atleta.
- Três notas de superfície.
- Personalidade e traços ocultos persistentes.
