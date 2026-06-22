# AUDIT v3.15.0 — Economy, Sponsors & Commercial Career

**Build:** 20260622-171608  
**Data:** 22/06/2026  
**Hora:** 17:16:08 — São Paulo  
**Schema:** 18

## Escopo da fase

- Nova aba `Economia` / Diretoria Financeira.
- Novo sistema persistente `commercialCareer` no save.
- Patrocínios com contratos ativos, duração, score, penalidade, tier e categoria.
- Receita semanal comercial integrada ao fluxo financeiro da academia.
- Livro caixa com lançamentos semanais, patrocínios, viagem, política financeira e investidores.
- Investidores com capital, equity, pressão, prazo e avaliação do board.
- Orçamento de viagem com modos enxuto, equilibrado e premium.
- Risco comercial calculado por caixa, fluxo, patrocinadores, reputação e investidores.
- UI mobile-first com cards compactos, KPIs e ações de toque.

## Anti-quebra

- Save migrado automaticamente para schema 18.
- Saves antigos recebem `commercialCareer` sem apagar dados anteriores.
- Aceite de patrocínio usa snapshot e rollback.
- Aceite de investidor usa snapshot e rollback.
- Troca de política de viagem usa snapshot e rollback.
- Fallback para ausência de propostas, patrocinadores, investidores ou torneio ativo.
- Contratos expirados são encerrados sem travar o fluxo semanal.
- Nenhum asset anterior foi removido.

## Auditoria estática concluída

- `node --check js/main.js`: OK.
- `node --check js/state.js`: OK.
- `node --check js/build.js`: OK.
- JSONs principais validados com parser Python: OK.
- IDs duplicados no HTML: nenhum.
- Build sincronizada em `build-info.json`, `build/build-info.json`, `js/build.js`, `index.html` e `sw.js`.
- Cache PWA atualizado para `vale-tennis-v3.15.0-20260622-171608`.
- Referências antigas `v3.14.0`, `20260622-154315` e `schema 17` removidas dos arquivos principais.

## Auditoria mobile-first

- Nova aba `Economia` adicionada ao menu lateral e ao dock mobile.
- Layout do painel financeiro usa cards empilháveis.
- Breakpoints preservados para 320 px, 360 px, 390 px, 412 px, tablet e desktop.
- Botões comerciais mantêm área de toque compatível com celular.
- Livro caixa e propostas comerciais são exibidos em listas roláveis, sem dependência de hover.

## Limitação

Teste real em navegador/Android/iOS ainda deve ser feito manualmente após upload, especialmente para validar rolagem, PWA instalada e navegação em celulares pequenos.
