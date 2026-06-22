# AUDIT v3.14.0 — Mobile Premium UX

Build: 20260622-154315  
Data: 22/06/2026  
Hora: 15:43:15 — São Paulo  
Schema: 17

## Objetivo da fase
Refinar a experiência mobile-first do Vale Games Tennis Manager, reduzindo cortes de tela, melhorando navegação inferior, rolagem, área de toque, altura real do navegador e foco da partida em telas pequenas.

## Implementações
- Nova aba **Mobile UX**.
- Novo estado persistente `mobileUX` no save.
- Migração automática para schema 17.
- Modos de interface: automático, compacto e conforto.
- Opções salvas: compactar cards, modo uma mão, foco na partida e reduzir movimento.
- Dock mobile convertido em trilho horizontal com scroll-snap.
- Botão ativo do dock centraliza automaticamente ao trocar de aba.
- Barra rápida mobile com: Semana, Salvar, Match e Topo.
- Runtime de viewport com `--app-vh` para corrigir altura real do navegador móvel.
- Detecção de orientação, classe de largura e telas apertadas.
- Match Center com score card sticky e foco de partida em mobile.
- Auditoria persistente de viewport dentro do save.

## Proteções anti-quebra
- Saves antigos recebem `mobileUX` automaticamente.
- Aplicação de modo mobile usa fallback quando `window`, `document` ou painel não estão disponíveis.
- O dock mobile mantém todas as abas acessíveis mesmo em 320 px.
- Troca de modo salva estado sem reiniciar o jogo.
- Redução de movimento desativa animações longas sem alterar gameplay.
- Barra rápida não aparece no desktop.
- Nenhum asset anterior foi removido.

## Auditoria técnica
- `node --check js/main.js`: aprovado.
- `node --check js/state.js`: aprovado.
- `node --check js/build.js`: aprovado.
- `build-info.json`: JSON válido.
- `build/build-info.json`: JSON válido.
- `manifest.webmanifest`: JSON válido.
- IDs duplicados no HTML: nenhum.
- Service Worker atualizado para cache `vale-tennis-v3.14.0-20260622-154315`.
- Build, versão, data e hora visíveis no jogo.

## Pontos de homologação manual recomendados
- Abrir em celular 320×568 e verificar dock horizontal.
- Testar botão Semana da barra rápida.
- Testar botão Salvar da barra rápida.
- Entrar na aba Match e verificar score sticky.
- Girar celular em paisagem e conferir se dock não cobre a partida.
- Ativar modo compacto, uma mão, foco na partida e reduzir movimento.

## Resultado
A build v3.14.0 melhora a experiência mobile e prepara a base para a próxima etapa de economia/patrocínios/carreira comercial sem regressões visuais importantes.
