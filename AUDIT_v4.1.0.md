# AUDIT v4.1.0 — Career Setup Recovery & Safe Start Hotfix

Build: 20260623-135529  
Data: 23/06/2026 13:55:29 America/Sao_Paulo  
Schema: 30

## Problema corrigido

Em testes reais no mobile, a build podia iniciar diretamente no Dashboard com valores zerados quando existia um save/localStorage antigo ou incompleto. Nessa condição a tela de criação de carreira — nome, país, avatar e nome da academia — podia não aparecer, deixando o jogo sem elenco ativo e com botões aparentando não funcionar.

## Correções aplicadas

- Boot guard `ensurePlayableStart()` antes do primeiro render.
- Detecção de save incompleto: elenco vazio, ranking incompleto, calendário incompleto, caixa zerado ou reputação inválida.
- Reconstrução segura da base jogável usando `buildInitialState(content)`.
- Preservação de preferências visuais/mobile quando a base precisa ser recriada.
- Força abertura da criação de carreira quando `ownerSetupComplete`, `academy.owner` ou `careerProfile` estão ausentes.
- Banner visível no Dashboard com botões: Configurar agora e Recriar base segura.
- Botões rápidos no painel da academia: Configurar e Corrigir.
- Cache-busting no carregamento de conteúdo JSON via `BUILD_INFO.build`.
- Mais espaço inferior no mobile para evitar dock/barra rápida cobrindo botões e painéis.
- Modal de criação oculta dock/barra rápida enquanto está aberto.

## Resultado esperado

- Primeiro acesso abre obrigatoriamente a criação de carreira se ela ainda não foi concluída.
- O jogador consegue escolher avatar, nome, país, cidade e nome da academia.
- Se houver save quebrado com 0 atletas, a build recria elenco, ranking e calendário antes de continuar.
- Os botões deixam de parecer travados porque o jogo não fica mais preso numa carreira incompleta.

## Auditoria executada

- `node --check js/main.js`
- `node --check js/state.js`
- `node --check js/build.js`
- `node --check js/contentLoader.js`
- JSON principal validado
- HTML sem IDs duplicados
- Manifest PWA validado
- Service Worker atualizado
- ZIP final testado com integridade OK

## Homologação manual recomendada

1. Abrir o site no Android Chrome.
2. Limpar dados/cache do site ou usar o botão Corrigir se a tela vier zerada.
3. Confirmar que o modal de criação aparece.
4. Escolher avatar e salvar.
5. Confirmar Dashboard com reputação, patrocínio, custos e atletas ativos acima de zero.
