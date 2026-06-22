# Auditoria — Vale Games Tennis Manager v3.11.0

Build: 20260622-110507  
Data: 22/06/2026  
Hora: 11:05:07 — São Paulo  
Schema: 14

## Objetivo da fase
Implementar Tactical Intelligence para transformar decisões de treinador em impacto real no motor de partida, reduzindo a sensação arcade.

## Itens implementados
- Painel Tactical Intelligence no Match Center.
- Plano persistente no save com alvo de saque, devolução, padrão de ataque, duração do rally e risco.
- Recomendação automática do analista baseada em atleta, adversário, piso, fadiga e pressão.
- Motor de ponto conectado ao plano tático: primeiro saque, ace, dupla falta, rally, win chance, erro e stamina.
- Mini leitura do analista no último ponto e relatório final.
- Fallbacks e rollback para troca de plano.
- Build, versão, data/hora e schema atualizados para v3.11.0 / 20260622-110507 / schema 14.

## Mobile-first
- Selects e botões com área de toque ampliada.
- Grid em uma coluna no celular.
- Painel compacto para 320px.
- Sem dependência de hover.

## Proteção anti-quebra
- Migração automática de saves antigos para schema 14.
- Valores padrão para saves sem `tacticalIntelligence`.
- Snapshot/rollback em alteração inválida de plano.
- Fallback para adversário/partida ausentes.

## Auditoria técnica executada
- `node --check js/main.js`
- `node --check js/state.js`
- validação JSON de `build-info.json` e `build/build-info.json`
- sincronização de versão/build no HTML, JS e Service Worker
- integridade final do ZIP

## Observação
Homologação manual em celular real ainda é recomendada, principalmente PWA instalado, Android/iOS e orientação horizontal.
