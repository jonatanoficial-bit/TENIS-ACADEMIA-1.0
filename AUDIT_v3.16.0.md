# AUDIT v3.16.0 — Long Career Simulation

**Build:** 20260622-180153  
**Data:** 22/06/2026  
**Hora:** 18:01:53 — São Paulo  
**Schema:** 19

## Objetivo da fase

Transformar a carreira em uma simulação de longo prazo, com décadas jogáveis, envelhecimento, auge, declínio, aposentadoria, nova geração, recordes históricos e Hall da Fama, mantendo o padrão de ZIP completo, build visível, proteção anti-quebra e prioridade mobile.

## Implementações verificadas

- Nova aba `Legado` adicionada ao menu principal e dock mobile.
- Novo hub `longCareerHub` adicionado ao HTML.
- Novo sistema persistente `generationalCareer` no save.
- Migração automática para schema 19.
- Fases de carreira adicionadas:
  - Promessa;
  - Ascensão;
  - Auge;
  - Veterano;
  - Declínio.
- Desenvolvimento anual por idade, potencial, saúde, disciplina, confiança, instalações e staff.
- Declínio anual para atletas veteranos e em risco físico.
- Risco de aposentadoria por idade, saúde, overall e lesões.
- Log de aposentadorias.
- Hall da Fama com score de legado.
- Recordes históricos:
  - melhor ranking;
  - maior pico de overall;
  - mais títulos;
  - carreira mais longa.
- Pipeline Next Gen com prospectos gerados de forma determinística.
- Promoção de prospectos com custo, salário, potencial e rollback seguro.
- Linha do tempo de temporadas arquivadas.
- Auditoria/projeção manual da temporada.
- Build, versão, data e hora mantidas visíveis.

## Proteção anti-quebra

- Saves antigos recebem `generationalCareer` automaticamente.
- Atletas antigos recebem campos de carreira longa sem sobrescrever dados existentes.
- Promoção de prospectos usa snapshot de dinheiro, elenco, prospectos e inbox.
- Em caso de falha de save na promoção, o estado anterior é restaurado.
- Se o elenco ficar pequeno demais após aposentadorias, a academia preserva ao menos um atleta e pode promover emergência Next Gen.
- Recordes são recalculados com fallback para ranking e atributos existentes.
- Nenhum asset anterior foi removido.

## Mobile-first

- Cards da aba Legado foram adaptados para telas de 320 px.
- Fases de carreira quebram em grade compacta no mobile.
- Lista de atletas e prospectos usa rolagem por toque.
- Botões de prospecto ocupam largura total em telas pequenas.
- Dock mobile recebeu a nova aba `Legado`.

## Auditoria técnica

- `node --check js/main.js`: aprovado.
- `node --check js/state.js`: aprovado.
- `node --check js/build.js`: aprovado.
- JSONs principais validados.
- IDs duplicados no HTML: nenhum encontrado.
- `build-info.json` sincronizado com `build/build-info.json`.
- Service Worker atualizado para cache `vale-tennis-v3.16.0-20260622-180153`.
- ZIP final deve ser testado manualmente em navegador e celular após extração/upload.

## Observação

O teste headless com navegador não foi executado nesta auditoria local; a validação principal desta fase foi estática, estrutural e lógica. Recomenda-se teste manual em celular real, principalmente navegação da nova aba Legado, promoção de prospecto e virada de temporada.
