# Vale Games Tennis Manager — v3.9.0

Build `20260622-101533` • Real Draws & Tournament Life • 22/06/2026 10:15:33 BRT.

Esta build transforma a estrutura de torneios em uma experiência mais próxima de um circuito real: chaves por tamanho de evento, cabeças de chave, byes, qualifiers, wild cards, qualifying de entrada, zebras, desistências simuladas e histórico de campeões persistente.

# Vale Games Tennis Manager

**Versão atual:** v3.9.0 — Real Draws & Tournament Life  
**Build:** 20260622-101533  
**Data/hora:** 22/06/2026 10:15:33 (America/Sao_Paulo)

Build focada em **vida real de torneio**, com prioridade mobile-first, save protegido, fallback de assets e versão visível no app.

## v3.9.0 — Real Draws & Tournament Life

- Chaves geradas por tamanho real do evento: 8, 16, 32, 64 e 128.
- Suporte a byes para eventos com 28/56 jogadores.
- Cabeças de chave, wild cards, qualifiers e entrada direta aparecem no modal de chave.
- Jogador pode entrar por chave principal, qualifying ou wild card, conforme ranking/reputação.
- Qualifying ganhou camada própria antes da chave principal.
- Simulação de torneio agora registra zebras, desistências e resultados das partidas paralelas.
- Histórico de campeões persistente em `tournamentLife.championHistory`.
- Modal de chave refeito para celular com estatísticas, qualifying, colunas roláveis e histórico.
- Schema de save atualizado para 12.

## Histórico anterior

## v3.7.0 — Broadcast Match Center Pro

- Match Center transformado em central de transmissão premium.
- Entrada de torneio com logo, piso, rodada, cards de atleta e adversário.
- Controles de simulação por ponto, game, set e partida inteira com proteção anti-loop.
- Último ponto ganhou velocidade de saque, direção, rally, leitura tática e mini replay textual.
- Estatísticas ao vivo ampliadas com momentum, velocidade de saque, rally médio e aproveitamento de primeiro saque.
- Visual mobile-first refinado para painel de partida em telas pequenas.
- Build, data e hora continuam visíveis em todas as áreas críticas.

## Novidades da v0.3.0

- layout ajustado para celular primeiro
- navegação horizontal por toque no mobile
- HUD da partida e painéis mais estáveis em telas estreitas
- qualifying e wild card simples para entrada em torneios
- torneios com progressão por rodadas
- fadiga, saúde e lesões leves
- recuperação semanal com departamento médico influenciando
- status de risco financeiro mais claro
- save local atualizado para a nova versão

## O que já funciona

- carreira infinita com avanço semanal
- ranking mundial ATP-like com base abril/2026
- calendário anual com ATP 250, 500, Masters 1000, Grand Slams e Finals
- academia com upgrades
- mercado de jovens talentos
- staff com impacto em jogo, economia e recuperação
- Match Center 2D com botões de estratégia
- qualifying, fases de torneio e título completo
- save local automático
- Admin local para DLC e import/export JSON
- estrutura modular pronta para expansão

## Estrutura

- `index.html` — jogo principal
- `admin.html` — área administrativa local
- `css/` — estilos
- `js/` — lógica do jogo
- `content/` — conteúdo modular base e DLC
- `assets/` — ícone e fundo premium base
- `docs/` — estratégia visual e de expansão

## Como rodar localmente

Por segurança do `fetch`, rode com um servidor local simples.

### Python

```bash
cd ace-academy-manager_v0.3.0_build-20260414-190210
python3 -m http.server 8080
```

Abra no navegador:

```text
http://localhost:8080
```

## Admin local

Acesse `admin.html`

Credenciais iniciais:

- usuário: `admin`
- senha: `ace2026`

## Publicação no GitHub Pages

1. Suba a pasta completa para um repositório GitHub.
2. Vá em **Settings > Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Selecione a branch principal e a pasta `/root`.
5. Aguarde o link do GitHub Pages.

## Prioridades da próxima fase

- chave visual mais rica por torneio
- múltiplos atletas jogando no mesmo evento
- patrocinadores negociáveis
- notícias, caixa de entrada e convites
- avatares e fundos AAA finais

## Observação

A v0.3.0 foi pensada para manter o projeto leve, estático e pronto para GitHub Pages, mas com arquitetura aberta para backend futuro.


## Build v0.4.0

Novidades desta fase:
- prioridade reforçada para mobile-first com dock inferior e HUD horizontal
- caixa de entrada com notícias e marcos de carreira
- propostas de patrocínio dinâmicas
- objetivo dinâmico de temporada visível na interface
- pacote completo pronto para GitHub Pages


## Build visual integrada

Versão 2.6.0 (20260418-122440).

Esta build inclui integração de logos de torneios, avatares transparentes de jogadores/staff e fundos premium mobile-first.
