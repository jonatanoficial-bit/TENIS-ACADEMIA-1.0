# v3.6.0 — Rebuild Match Engine & Premium Match Foundation

Build: 20260620-121454 • Data/hora visível: 20/06/2026 12:14:54

- Substituído o núcleo arcade de pontos por motor ponto a ponto com saque, primeira/segunda bola, ace, dupla falta, rally, winner e erro não forçado.
- Adicionado placar melhor de 3 sets com games, sets, tiebreak e alternância de saque.
- Estatísticas ao vivo: aces, duplas faltas, winners, erros não forçados, aproveitamento de primeiro saque e break points.
- Relatório premium pós-partida com placar em sets, estatísticas e rally médio.
- Dossiê tático na tela de partida usando atributos do atleta, adversário e superfície.
- Uso reforçado dos logos de torneio e fundo premium `match-night.png` no Match Center.
- Proteção anti-quebra por ponto: rollback do estado da partida e do atleta em caso de erro.
- Schema de save atualizado para 9 mantendo compatibilidade com versões anteriores.
- Auditoria mobile-first para 320px+, touch, rolagem e conteúdo sem overflow crítico.

# Changelog

## v3.2.0 — Living Players Database + Mobile Profiles
- Build 20260609-131845, visível no app.
- Ranking mundial ampliado para 100 atletas.
- Perfis com atributos técnicos, físicos, mentais, personalidade e superfícies.
- Modal mobile-first de análise.
- Migração de save para schema 5 e fallback do banco mundial.
- Auditoria anti-regressão e responsiva.

# CHANGELOG

## v3.0.0 — Core Consolidation
**Build:** 20260609-115317  
**Data:** 20/06/2026  
**Hora:** 11:53:17 (America/Sao_Paulo)

- Versão, build, fase, data e hora centralizadas em `js/build.js` e `build/build-info.json`.
- Identificação sincronizada na tela inicial, cabeçalho, mobile, partida e selo técnico persistente.
- Nova chave oficial de save com migração automática dos saves `ace_academy_save_v040` e `ace-manager-save`.
- Backup automático antes de cada gravação e preservação de saves corrompidos para diagnóstico.
- Schema de save v3 e metadados de migração.
- Tratamento global de erros com aviso não destrutivo.
- Service Worker com cache identificado por versão/build.
- Nome comercial atualizado para Vale Games Tennis Manager.



## v0.1.0 - build 20260414-123532
- Primeira build funcional do **ACE Academy Manager**.
- Projeto mobile-first em HTML, CSS e JavaScript vanilla.
- Modo carreira infinito com economia, staff, treino, mercado e upgrades.
- Calendario anual 2026 com eventos ATP, Grand Slams e torneios de fim de temporada.
- Ranking mundial inicial baseado no snapshot de abril de 2026.
- Match Center 2D em canvas com acoes taticas durante a partida.
- Painel Admin local com login, importacao/exportacao JSON e ativacao de pacotes.
- Sistema de conteudo modular com base package + DLC exemplo.

## v1.2.0 - 20260416-191244

- autoplay corrigido sem onclick inline
- controles 1x 2x 4x e pausar adicionados à interface da partida
- 2D com rally contínuo e jogadores em movimento
- build visível no HUD, overlay, badge mobile e painel da partida

## v1.7.0 - 20260417-181352

- profundidade maior de ranking com projeção até top 350
- pulso da temporada com janela competitiva e chance de convite
- carreira mais coerente para a reta final antes da lapidação visual

## v2.6.1 - 20260418-125544

- corrigido bug de 404 em logos, avatares e staff
- adicionados caminhos de fallback para hosts estaticos
- reforcado carregamento dos fundos principais

## v2.7.2 - 20260418-161009

- corrigido bug em que a tela de nova carreira sobrepunha o lobby
- corrigido botao Entrar na carreira com fechamento forcado do modal
- ownerSetupComplete salvo no estado e no localStorage
- dashboard aberto automaticamente apos concluir a criacao da academia


## v3.1.0 — Career Genesis + Mobile Safety (20/06/2026 12:26:30)
- Criação de carreira expandida com identidade do treinador e academia.
- Validação de campos e rollback transacional em falhas de save.
- Perfil estratégico: origem, especialidade, filosofia, dificuldade e moeda.
- Layout do onboarding adaptado para 320px, orientação paisagem e safe areas.
- Schema de save 4 com migração automática.
- Auditoria estática e mobile registrada em AUDIT_v3.1.0.md.


## v3.3.0 — World Tour Ecosystem
- Calendário expandido para 65 eventos mundiais.
- Simulação semanal independente com campeões e finalistas.
- Ranking mundial recalculado e histórico persistente.
- Feed do circuito otimizado para toque e telas estreitas.
- Schema 6 com migração e fallback anti-quebra.


## v3.4.0 — Training Lab (20260609-125656)
- Planejamento individual semanal por foco e intensidade.
- Carga, fadiga, saúde, evolução por atributo e risco de lesão.
- Processamento transacional com rollback anti-quebra.
- Migração automática de saves para schema 7.
- Layout mobile-first desde 320 px.
