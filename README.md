# Ace Academy Manager — build v0.2.0 (2026-04-14 18:48:52)

Primeira build jogável focada em gameplay, mobile-first, em HTML + CSS + JavaScript puro.

## O que já funciona

- Carreira infinita com avanço semanal
- Ranking mundial ATP-like com base abril/2026
- Calendário anual com ATP 250, 500, Masters 1000, Grand Slams e Finals
- Academia com upgrades
- Mercado de jovens talentos
- Staff com impacto real em jogo e economia
- Match Center 2D com botões de estratégia
- Save local automático
- Admin local para DLC e import/export JSON
- Estrutura modular pronta para expansão

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
cd ace-academy-manager_v0.2.0_build-20260414-184852
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

## Salvar / resetar

- O jogo salva automaticamente no `localStorage`.
- O botão **Salvar** força um save imediato.
- O botão **Novo Jogo** limpa o save local e reinicia a carreira.

## Sistema de DLC

- O conteúdo-base é carregado por `content/manifest.json`.
- DLCs locais podem ser instaladas via Admin por upload JSON.
- O core já aceita calendário, talentos e outros blocos extras por pack.

## Próximos upgrades recomendados

- Lesões detalhadas e departamento médico avançado
- Convites, qualificatórios e chaves por torneio
- Notícias, e-mails e mídia
- Avatares realistas e fundos AAA finais
- Logos oficiais estilizados por competição
- Sistema financeiro mais profundo com patrocinadores e crise

## Observação

Esta build foi reconstruída integralmente como pacote funcional completo, pronta para iteração e versionamento contínuo em novas entregas ZIP.
