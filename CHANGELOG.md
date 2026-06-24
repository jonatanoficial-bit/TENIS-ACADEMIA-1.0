# Changelog

## v4.1.5 — Forced Onboarding Launcher & Invalid Career Block — 20260624-104720

- Bloqueio total de Dashboard inválido: sem perfil completo ou base jogável, o jogo redireciona para o Gate Inicial.
- Criação de carreira passa a ser launcher obrigatório em tela cheia, acima do dock e da barra rápida mobile.
- Validação estrita: treinador, avatar, país, cidade, nome da academia, elenco, ranking, calendário e caixa inicial.
- Botões Configurar/Configurar agora acionam diretamente o launcher obrigatório.
- Save vazio/parcial recebe backup local antes do reparo.
- Service Worker, manifest, CSS/JS/JSON com cache-busting de build.
- Schema atualizado para 35.
- Documentos adicionados: `AUDIT_v4.1.5.md` e `FORCED_ONBOARDING_CHECKLIST_v4.1.5.md`.


## v4.1.5 — Forced Onboarding Launcher & Invalid Career Block (20260624-104720)

- Gate inicial obrigatório antes de liberar gameplay.
- Bloqueio contra Dashboard vazio sem treinador/avatar/academia.
- Aba Gate Inicial com auditoria, reparo e exportação local.
- Navegação para gameplay é redirecionada para criação se a carreira não estiver completa.
- Schema 35.



## v4.1.3 — Career Creation UX & Avatar Selector Final Fix

- Adicionada aba `Criação` para auditar nome, país, avatar e botão de criar carreira.
- Reforçada seleção de avatar com delegação global de toque/clique.
- Corrigida reabertura do modal para não apagar dados digitados em retries automáticos.
- Botões críticos do bind inicial agora usam proteção para evitar travamento geral caso um elemento não exista.
- Save schema atualizado para 33.
- Adicionados `AUDIT_v4.1.3.md` e `CAREER_CREATION_UX_CHECKLIST_v4.1.3.md`.
# v4.1.3 — Career Creation UX & Avatar Selector Final Fix

- Nova aba Cache/PWA.
- Novo sistema `cacheUpdateGuard` no save, schema 33.
- Registro explícito do Service Worker com cache-busting.
- Botão para auditar atualização e cache.
- Botão para limpar caches antigos do app.
- Botão para confirmar primeiro acesso na build correta.
- Botão para recarregar URL com versão/build atual.
- Manifest PWA atualizado com atalho para Cache/PWA.
- Documentos adicionados: `AUDIT_v4.1.3.md` e `CACHE_PWA_UPDATE_CHECKLIST_v4.1.3.md`.


## v4.1.1 — Onboarding Flow & Button Reliability Hotfix — 23/06/2026 15:02:06

- Nova aba Fluxo Inicial com score de confiabilidade do onboarding.
- Auditoria de botões críticos, abas, dock mobile, modal de criação e avatares.
- Fallback de delegação global para toque/clique em botões essenciais.
- Reforço de abertura obrigatória do modal de criação quando a carreira ainda não foi configurada.
- Schema atualizado para 31; cache PWA versionado.
# Changelog

## v4.1.0 — Career Setup Recovery & Safe Start Hotfix — 20260623-135529

- Corrigido início direto no Dashboard com valores zerados quando havia save antigo/incompleto no navegador.
- Adicionado boot guard que detecta elenco vazio, ranking incompleto, calendário incompleto, caixa inicial inválido e reputação inválida.
- Adicionada reconstrução segura da base jogável com elenco, ranking e calendário do pacote base.
- Criação de carreira agora é forçada quando faltam dono, perfil ou `ownerSetupComplete`.
- Adicionado banner visível no Dashboard com **Configurar agora** e **Recriar base segura**.
- Adicionados botões **Configurar** e **Corrigir** no hub inicial da academia.
- Carregamento de JSONs recebeu cache-busting por build para reduzir risco de conteúdo antigo no PWA/Vercel.
- Ajustado espaçamento inferior mobile e ocultação do dock durante o modal de criação.
- Save schema atualizado para 30 com `careerSetupRecovery`.



## v4.0.8 — Localization & Store Readiness Hotfix — 20260623-114902
- Nova aba Localização com diagnóstico de PT-BR/EN/ES.
- Sistema persistente `localizationStore` migrado para schema 28.
- Prévia de textos de loja, cobertura por idioma e relatório JSON exportável.
- Manifest PWA recebeu atalho para Localização e Loja.
- Preset loja segura reforça fallback, legal e cobertura mínima sem alterar gameplay.



## v4.0.6 — Input, Touch & Scroll Reliability Hotfix — 20260623-102045
- Nova aba **Toque/Rolagem** para diagnosticar input real no celular.
- Adicionado sistema persistente `inputReliability` com score, logs e relatórios JSON.
- Auditoria de botões pequenos, rolagem presa, viewport real, teclado mobile e ponteiro coarse/fine.
- Preset seguro de toque ativa conforto, modo uma mão, foco de partida e redução de movimento.
- CSS de hardening para `touch-action`, `overscroll-behavior`, `-webkit-overflow-scrolling` e offset de teclado.
- Save migrado para schema 26 com build visível e cache PWA v4.0.6.
# Changelog

## v4.0.5 — Browser Compatibility & Install QA Hotfix (20260622-193123)

- Nova aba **Compatibilidade** para validação de ambiente real.
- Adicionado sistema persistente `browserCompatibility` com score, matriz de compatibilidade e logs.
- Adicionada auditoria de Android/Chrome, iOS/Safari, desktop, PWA instalado, cache, save local, toque e viewport.
- Adicionado preset de instalação segura para mobile/PWA.
- Adicionada limpeza segura de caches antigos do app sem alterar carreira.
- Adicionada exportação de relatório de compatibilidade em JSON.
- Atualizado schema para 25, build 20260622-193123 e cache PWA isolado.


## v4.0.4 — Final QA Automation & Public Test Tools (20260622-190941)
- Nova aba QA Final.
- Smoke test interno para boot, HUD, save, PWA/cache e viewport mobile.
- Varredura de telas, hosts de renderização e dock mobile.
- Exportação local de relatório QA em JSON.
- Modo teste público com safe mode sem alterar ranking, atletas, torneios ou economia.
- Save migrado para schema 24.

# Vale Games Tennis Manager v4.0.2

Build `20260622-190812` — Release Hardening & Diagnostics.

# Changelog

## v4.0.2 — Release Polish & Stability Hotfix (20260622-183905)

- Nova aba **Polimento** para auditoria pós-RC.
- Adicionado estado persistente `qualityPolish` com score de qualidade, auditoria, matriz de aparelhos e checklist de acabamento.
- Adicionado botão **Auditar polimento** com alertas de release.
- Adicionado **Preset seguro** para teste público/mobile: foco na partida, redução de movimento, safe mode e compactação condicional.
- Adicionado **Teste de save offline** para validar armazenamento local e migração.
- Atualizada build para v4.0.2, build 20260622-183905 e schema 22.
- Cache PWA isolado da v4.0.0.
- Nenhum asset anterior removido.

## v4.0.0 — Commercial Premium Candidate (20260622-181655)

- Criada aba Release RC com score de prontidão comercial.
- Adicionados checklist de loja/teste público, privacidade offline, créditos e aviso legal.
- Criado stress test projetivo de 52 semanas.
- Migrado save para schema 20.
- Preparada build para homologação manual em mobile, desktop e PWA.

## v3.16.0 — Long Career Simulation (20260622-180153)

- Nova aba **Legado**.
- Adicionado sistema persistente `generationalCareer`.
- Adicionadas fases de carreira: Promessa, Ascensão, Auge, Veterano e Declínio.
- Adicionado envelhecimento anual com desenvolvimento, auge e declínio.
- Adicionado risco de aposentadoria por idade, saúde, overall e lesões.
- Adicionado Hall da Fama da academia.
- Adicionados recordes históricos de ranking, pico de overall, títulos e longevidade.
- Adicionado pipeline Next Gen com prospectos promovíveis.
- Adicionada linha do tempo de temporadas arquivadas.
- Adicionada auditoria de simulação longa e projeção de temporada.
- Migração de save para schema 19.
- Mantida versão/build/data/hora visíveis.
- Mantido foco mobile-first e proteção anti-quebra.

## v3.15.0 — Economy, Sponsors & Commercial Career (20260622-171608)

- Nova aba `Economia` / Diretoria Financeira.
- `commercialCareer` persistente no save com ledger, contratos ativos, pipeline, investidores, política de viagem e risco comercial.
- Patrocínios deixam de ser bônus simples e passam a ter score, tier, categoria, prazo, penalidade e receita semanal contratual.
- Investidores adicionam capital, pressão e avaliação do board.
- Orçamento de viagem altera custo, fadiga e reputação em semanas de torneio.
- Fluxo semanal registra entradas, saídas, viagens e alertas no livro caixa.
- Integração com staff financeiro, reputação, Newsroom e caixa da academia.
- Mobile-first: painel financeiro em cards compactos, rolagem por toque e compatibilidade desde 320 px.
- Migração de save para schema 18.

v3.14.0 — Mobile Premium UX — build 20260622-154315

- Adiciona Central Mobile Premium UX com modos automático, compacto e conforto.
- Reestrutura dock mobile como trilho horizontal com scroll-snap e centralização da aba ativa.
- Adiciona barra rápida mobile para Semana, Salvar, Match e Topo.
- Aplica runtime `--app-vh` para altura real do navegador, orientação e safe areas.
- Inclui modo uma mão, foco de partida, redução de movimento e auditoria de viewport.
- Mantém build, versão, data e hora visíveis e migração para schema 17.

## v3.13.0 — Global Tennis Newsroom — build 20260622-132440
- Adiciona nova aba `Newsroom` com feed global de imprensa, manchetes, rumores, resultados e coletivas.
- Cria estado persistente `newsroom` com notícias, perguntas de imprensa, sentimento público e reputação editorial.
- Gera pautas semanais ligadas ao calendário, ranking, resultados do World Tour, lesões, patrocínio e pressão da academia.
- Adiciona respostas de coletiva com impacto real em reputação, moral, confiança e pressão dos atletas.
- Integra Newsroom com inbox e carreira humana, usando snapshot/rollback para evitar quebra.
- Mantém build, versão, data e hora visíveis e migração para schema 16.

## v3.12.0 — Premium Visual Academy — build 20260622-122215
- Cria a nova aba `Academia Pro` com hub visual de ambientes premium.
- Reaproveita fundos, logos e avatares existentes para reduzir a aparência de dashboard.
- Adiciona cenas persistentes: escritório, centro de treino, sala médica, análise, scouting, circuito e arena.
- Muda o fundo visual da aplicação conforme aba/ambiente ativo sem quebrar a navegação mobile.
- Adiciona estado `visualAcademy` com auditoria de ambiente e migração para schema 15.
- Mantém build, versão, data e hora visíveis e cache PWA isolado da v3.11.0.



## v3.11.0 — Tactical Intelligence — build 20260622-110507
- Adiciona plano tático profundo antes/durante a partida: alvo de saque, devolução, padrão de ataque, duração do rally e risco.
- Conecta decisões táticas ao motor ponto a ponto: primeiro saque, ace, dupla falta, rally, winners, erros e chance de break.
- Cria painel Tactical Intelligence mobile-first no Match Center.
- Adiciona recomendação automática do analista conforme adversário, piso, fadiga e pressão.
- Mantém rollback e fallback para ajustes táticos inválidos; schema 14.

## v3.10.0 — Player Personality & Real Careers
- Build 20260622-104227 (22/06/2026 10:42:27, São Paulo).
- Adicionado sistema humano de atletas: personalidade, moral, confiança, pressão, relação com treinador, felicidade, ambição e disciplina.
- Nova aba Carreira com painel mobile-first de conversas, metas da temporada e eventos humanos.
- Conversas com atleta agora afetam moral, confiança, pressão e relacionamento com proteção anti-quebra.
- Partidas e semanas passam a influenciar carreira psicológica; eventos são salvos no histórico persistente.
- Migração de save para schema 13 preservando builds anteriores.

## v3.9.0 — Real Draws & Tournament Life — 20260622-101533

- Criado sistema de chaves reais por tamanho de torneio, com bracket de 8/16/32/64/128.
- Adicionados cabeças de chave, entrada direta, qualifiers, wild cards e byes no modal de chave.
- Qualifying passou a existir como camada prévia para atletas fora do corte principal.
- Torneios agora registram zebras, W/O/desistências simuladas e campeão persistente.
- Histórico de campeões salvo em `tournamentLife.championHistory`.
- Criadas funções centrais `createTournamentRun` e `pickOpponent` para eliminar fragilidade da vida do torneio.
- Match Engine atualizado para `v3.9-real-draws-engine`.
- Migração para schema 12, mantendo saves anteriores compatíveis.
- Auditoria mobile-first e integridade do ZIP preservadas.


## v3.8.0 — Tournament Identity System — 20260620-133614

- Novo hub Tournament Identity System no calendário.
- Dossiê visual de torneio com logo, piso, prestígio, bolsa, pontos, público estimado e DNA tático.
- Calendário premium com identidade por categoria e superfície.
- World Tour feed com logos e botão de dossiê.
- Match Center passa a exibir prestígio, piso traduzido e categoria com ícone.
- Migração para schema 11 com estado `tournamentIdentity`.
- Auditoria mobile-first e fallback de assets preservados.

# v3.7.0 — Broadcast Match Center Pro

Build: 20260620-131729 • Data/hora visível: 20/06/2026 13:17:29

- Adicionado painel de entrada Broadcast Match Center Pro com logo do torneio, piso, rodada, cards de atleta e adversário.
- Adicionados botões de simular ponto, game, set e partida completa, com limite de segurança e rollback em falhas.
- Último ponto agora registra velocidade do saque, direção, tipo de ponto, rally, leitura tática e mini replay.
- Estatísticas ao vivo ampliadas com momentum, velocidade máxima de saque, média de rally e aproveitamento de primeiro saque.
- Canvas da quadra recebeu variação visual por superfície e overlay de transmissão com placar, saque e último ponto.
- Interface mobile-first refinada para uso em celulares, com controles em grade, chips compactos e cards roláveis.
- Schema de save atualizado para 10 e cache PWA separado da build anterior.

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

## v4.1.0 — Career Setup Recovery & Safe Start Hotfix

- Corrigido caso em que a aplicação podia abrir direto no Dashboard com tudo zerado e sem tela de criação.
- Adicionado boot guard para detectar save incompleto, elenco vazio, ranking/calendário ausentes e caixa inicial inválido.
- Adicionada reconstrução segura da base inicial preservando preferências mobile/acessibilidade.
- Adicionado banner de correção no Dashboard e botões Configurar/Corrigir.
- Modal de criação passa a abrir obrigatoriamente quando a carreira ainda não tem dono/perfil.
- Conteúdo JSON agora recebe cache-busting por build.
- Ajustado espaço inferior mobile para evitar que dock/barra rápida cubram botões.
