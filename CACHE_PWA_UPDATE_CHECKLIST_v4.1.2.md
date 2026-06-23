# Cache/PWA Update Checklist — v4.1.2

Build: 20260623-181210  
Data: 23/06/2026 18:12:10  
Schema: 32

## Objetivo
Blindar a atualização do jogo contra cache antigo do Chrome/Vercel/PWA e confirmar que o usuário vê a build correta antes de testar a carreira.

## Verificações
- Build visível no topo, badge mobile, rodapé técnico e Match Center.
- Service Worker registrado com `updateViaCache: none`.
- Cache antigo `vale-tennis-*` removível pelo botão da aba Cache/PWA.
- Histórico de última build salvo em `vale_tennis_last_seen_build`.
- Primeiro acesso confirmável manualmente.
- Exportação local de relatório Cache/PWA.
- Base jogável conferida junto com fluxo inicial.

## Observação de teste real
Se o celular continuar exibindo build antiga, limpar dados do site ou reinstalar o PWA continua sendo necessário porque o navegador pode segurar HTML antigo antes de carregar o JavaScript novo.
