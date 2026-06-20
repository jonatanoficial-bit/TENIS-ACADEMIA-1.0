# Estrategia de criacao de assets premium

## Objetivo visual
Transformar o projeto em um produto com cara de **app AAA premium**, mantendo performance alta em mobile. A primeira build usa arte vetorial elegante e placeholders premium. As proximas builds devem substituir esses placeholders por assets autorais finais.

## Pacotes de arte planejados

### 1. Fundos principais
1. **Academy HQ Dawn** - tela inicial / dashboard.
2. **Night Match Court** - Match Center.
3. **Training Complex** - tela de treino.
4. **Global Tour Map** - calendario e viagens.
5. **Executive Office** - tela de mercado/staff.
6. **World Ranking Chamber** - ranking mundial.

### 2. Avatares
1. **Staff portraits**: head coach, fitness, physio, finance, scout.
2. **Prospect portraits**: jovens talentos genericos divididos por regiao.
3. **Player card silhouettes**: fallback leve para mobile.
4. **Premium manager avatar set**: estilos executivo, ex-atleta, scout, high-tech.

### 3. Logos e marcas
1. Logo principal do jogo.
2. Monograma / favicon.
3. Selos por categoria: Grand Slam, Masters 1000, ATP 500, ATP 250, Challenger, Futures, Team.
4. Logos custom para eventos ficcionais e DLCs.

### 4. Bandeiras e paises
1. Sprite ou pacote SVG por pais mais frequente no circuito.
2. Foco inicial: Brasil, Italia, Espanha, Servia, Alemanha, Estados Unidos, Australia, Argentina, Canada, France, Great Britain.
3. Expandir depois para todos os paises presentes no ranking e calendario.

## Ordem ideal de producao
1. **Hero background da home**.
2. **Background do Match Center**.
3. **Logo principal + favicon final**.
4. **Set de 5 retratos de staff**.
5. **Set de 12 avatares de prospects**.
6. **Selos das categorias de torneio**.
7. **Flags SVG**.
8. **Cards especiais para Grand Slams e ATP Finals**.

## Padrao tecnico dos assets
- Formato preferido para UI: **SVG**.
- Formato preferido para ilustrações detalhadas: **WebP**.
- Largura sugerida para fundos: **1600x900** ou **1920x1080**.
- Retratos: **768x1024**.
- Logos: **SVG + PNG fallback**.
- Comprimir sempre pensando em mobile.

## Pipeline recomendado
1. Definir briefing visual por tela.
2. Aprovar concept em baixa fidelidade.
3. Gerar versao premium.
4. Testar contraste e legibilidade no celular.
5. Otimizar peso.
6. Registrar em changelog e atualizar build.

## Como vamos trabalhar nas proximas etapas
- Criamos **um asset por vez**, com nome, funcao e direcao de arte.
- Substituimos o placeholder correspondente.
- Atualizamos `build/build-info.json`, `CHANGELOG.md` e o ZIP final.
