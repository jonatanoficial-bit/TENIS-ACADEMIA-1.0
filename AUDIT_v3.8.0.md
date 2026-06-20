# AUDIT v3.8.0 — Tournament Identity System

Build: 20260620-133614
Data: 20/06/2026
Hora: 13:36:14 BRT
Schema: 11

## Escopo
- Criado Tournament Identity System como fase de transição visual/imersiva.
- Adicionado hub premium no calendário.
- Adicionado modal/dossiê de torneio com logo, categoria, superfície, prestígio, bolsa, pontos e leitura tática.
- Calendário e World Tour agora usam melhor logos e fundos já presentes no pacote.
- Match Center recebeu chips com prestígio e label de piso/categoria.

## Anti-quebra
- `eventIdentity()` usa fallback para torneio sem logo, categoria, cidade, prêmio ou piso.
- Modal é criado sob demanda e não impede abertura do jogo se nenhum torneio existir.
- `tournamentIdentity` é migrado automaticamente para saves antigos.
- Fallback de imagens via `hydrateAssetImages()` preservado.
- Nenhum asset anterior foi removido.

## Mobile-first
- Hub vira stack vertical em tablets/celulares.
- Próximos eventos premium usam rolagem horizontal por toque.
- Modal vira bottom sheet em telas pequenas.
- Ações do calendário quebram para coluna em telas estreitas.
- Dossiês reduzem logotipo/textos para 320px.

## Verificações realizadas
- JSONs principais validados.
- JavaScript principal validado com `node --check`.
- CSS e HTML com marcadores v3.8.0 conferidos.
- Build sincronizada em `build-info.json`, `build/build-info.json`, `js/build.js`, `index.html` e `sw.js`.
- ZIP final criado com todos os arquivos.

## Observação
Teste em navegador real/mobile ainda deve ser feito manualmente depois do upload, pois o ambiente pode bloquear execução headless.
