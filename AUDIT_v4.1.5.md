# AUDIT v4.1.5 — Forced Onboarding Launcher & Invalid Career Block

Build: 20260624-104720  
Data: 26/06/2026 10:47:20 São Paulo  
Schema: 35

## Objetivo
Corrigir de forma estrutural o problema observado em desktop/mobile: o jogo entrava no Dashboard mesmo sem carreira válida, mostrando reputação 0, caixa 0 e atletas ativos 0, sem abrir a criação de avatar/nome/academia.

## Alterações principais
- `setupIsComplete()` passou a validar dados reais do perfil, não apenas flag booleana.
- Adicionada validação conjunta `invalidCareerIssues()` com perfil + base jogável.
- Removido `dashboard` da lista de abas seguras quando a carreira está inválida.
- `switchTab()` e `render()` redirecionam para `initialgate` se o usuário tentar entrar em gameplay sem carreira completa.
- Botões `Configurar` e `Configurar agora` chamam o launcher obrigatório.
- `forceOnboardingLauncher()` abre a criação em tela cheia e reabre se o navegador não mostrar o modal.
- Sistema persistente `forcedOnboardingGate` adicionado ao save.
- CSS reforçado para esconder dock/barra rápida durante criação obrigatória.
- Service Worker atualizado para limpar caches antigos e responder build atual.

## Validações esperadas
- Sem nome/país/avatar/academia/cidade, o jogo não libera Dashboard jogável.
- Com elenco/ranking/calendário/caixa ausentes, o jogo recria base segura e força criação.
- Após criar carreira, Dashboard, Atletas, Treino, Partida e Ranking liberam normalmente.
- No mobile, a tela de criação fica acima do dock e dos botões rápidos.

## Limitação honesta
Ainda é necessário testar no Vercel/Chrome real após upload. Se o navegador continuar exibindo v4.1.2/v4.1.4, a causa é cache/PWA antigo e precisa limpar dados do site ou reinstalar o PWA.
