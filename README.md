# Vale Games Tennis Manager v4.0.2

Build `20260622-190812` — Release Hardening & Diagnostics.

# Vale Games Tennis Manager — v4.0.2 — Release Polish & Stability Hotfix

**Build:** 20260622-183905  
**Data:** 22/06/2026  
**Hora:** 18:39:05 — São Paulo  
**Schema:** 21

## Objetivo da build

Esta build é um hotfix/polimento pós-RC baseado na v4.0.0 Commercial Premium Candidate. Ela não muda a direção principal do jogo nem remove assets: reforça a estabilidade para teste público, melhora a homologação mobile, cria uma central de polimento e deixa créditos, privacidade offline, auditoria e lançamento mais fáceis de verificar dentro do próprio jogo.

## Principais recursos

- Nova aba **Polimento**.
- Novo estado persistente `qualityPolish` no save.
- Score interno de qualidade da build.
- Auditoria de polimento mobile-first.
- Preset seguro para teste público:
  - foco na partida;
  - redução de movimento;
  - modo seguro de release;
  - compactação condicional em telas pequenas.
- Teste de save offline dentro do jogo.
- Matriz de homologação por resolução:
  - 320 × 568;
  - 360 × 640;
  - 390 × 844;
  - 412 × 915;
  - tablet;
  - desktop.
- Checklist visual de acabamento:
  - toque mobile;
  - rolagem segura;
  - fallback de assets;
  - recuperação de save;
  - documentos legais.

## Mobile-first e anti-quebra

- Migração automática para schema 22.
- Saves antigos recebem `qualityPolish` automaticamente.
- O preset seguro não altera atributos, ranking ou torneios.
- Teste de save offline registra auditoria sem destruir a carreira.
- Build, versão, data e hora seguem visíveis no jogo.
- Cache PWA separado da v4.0.0.

## Documentos importantes

- `AUDIT_v4.0.2.md`
- `POLISH_CHECKLIST_v4.0.2.md`
- `AUDIT_v4.0.0.md`
- `RELEASE_CHECKLIST_v4.0.0.md`
- `PRIVACY_OFFLINE.md`
- `CREDITS.md`
- `LEGAL_NOTICE.md`
