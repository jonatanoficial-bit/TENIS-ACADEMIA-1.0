# Auditoria v3.4.0 — Training Lab

Build: 20260609-125656
Data/hora: 09/06/2026 12:56:56 America/Sao_Paulo

## Escopo auditado
- Versão/build sincronizadas em HTML, JS, JSON, save e PWA.
- Schema 7 com migração automática e planos padrão por atleta.
- Processamento semanal idempotente por temporada/semana.
- Snapshot e rollback do elenco em falha de processamento.
- Validação de foco e intensidade com restauração do plano anterior.
- Responsividade 320, 360, 390, 412, tablet e desktop.
- Rolagem e controles touch sem dependência de hover.

## Testes estáticos
- Sintaxe JavaScript via node --check.
- JSON válido.
- IDs HTML únicos.
- Integridade do ZIP.

## Observação
A auditoria automatizada de navegador depende de motor headless disponível. A build inclui fallback e proteção em runtime para reduzir risco de regressão.
