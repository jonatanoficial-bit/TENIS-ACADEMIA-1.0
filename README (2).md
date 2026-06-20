# ACE Academy Manager

Build atual: **v0.1.0**  
Build stamp: **20260414-123532**  
Gerado em: **2026-04-14 12:35:32 -0300**

Simulador mobile-first de gerenciamento de academia de tenis em **HTML + CSS + JavaScript vanilla**. O jogador controla uma academia, desenvolve atletas, contrata staff, administra caixa, disputa um calendario anual inspirado no circuito ATP de 2026 e acompanha a evolucao no ranking mundial.

## Destaques da primeira build
- Layout mobile-first premium, responsivo e com foco em fluidez.
- Carreira infinita: a temporada avanca ano a ano e so termina por falencia.
- Match Center 2D em canvas com acoes taticas durante a partida.
- Mercado de prospects, contratacao de staff e upgrades de instalacao.
- Calendario anual 2026 base com ATP 250/500/1000, Grand Slams, eventos de equipe e fim de temporada.
- Snapshot inicial do ranking mundial baseado em abril de 2026.
- Sistema modular de conteudo com `content/manifest.json` e suporte a DLC/local packages.
- Admin local com login simples, importacao/exportacao JSON e overrides de branding/regras.
- Estrutura pronta para GitHub Pages.

## Estrutura

```text
ace-academy-manager/
├── admin.html
├── index.html
├── manifest.webmanifest
├── sw.js
├── assets/
│   ├── backgrounds/
│   ├── icons/
│   ├── avatars/
│   └── graphics/
├── build/
│   └── build-info.json
├── content/
│   ├── base/
│   ├── dlc/
│   ├── examples/
│   └── manifest.json
├── css/
├── docs/
├── js/
│   ├── core/
│   └── modules/
└── tools/
```

## Como rodar localmente
O projeto usa `fetch()` para carregar JSON, entao **nao abra com clique duplo**. Rode por um servidor local:

### Opcao 1 - Python
```bash
cd ace-academy-manager_v0.1.0_build-20260414-123532
python3 -m http.server 8080
```
Acesse `http://localhost:8080`.

### Opcao 2 - VS Code
Use a extensao **Live Server** apontando para a pasta raiz.

## Admin local
Acesse `admin.html`.

Credenciais iniciais:
- usuario: `admin`
- senha: `ace2026`

O painel permite:
- ativar e desativar pacotes do manifesto;
- importar pacotes JSON locais;
- remover pacotes locais;
- editar branding e parametros basicos;
- exportar um snapshot com save, overrides e estado dos pacotes.

## Conteudo modular / DLC
O core foi separado do conteudo. O carregamento acontece em camadas:
1. `content/manifest.json`
2. pacotes base e DLC internos
3. pacotes locais instalados pelo Admin
4. overrides do Admin salvos no navegador

Um exemplo pronto de pacote esta em:
- `content/examples/sample-local-package.json`

Formato detalhado:
- `docs/CONTENT_PACK_FORMAT.md`

## Deploy no GitHub Pages
1. Envie a pasta inteira para um repositorio GitHub.
2. Em **Settings > Pages**, selecione o branch principal e a pasta raiz.
3. Salve.
4. Aguarde a URL do Pages ficar disponivel.

Como o projeto e estatico, o deploy funciona bem no GitHub Pages. O save do jogo e o Admin local usam `localStorage` do navegador.

## Arquitetura pensada para crescimento
- `js/core/`: estado, armazenamento, utils e content loader.
- `js/modules/`: simulacao, renderizacao e match engine.
- `content/`: dados desacoplados do core.
- `docs/`: formatos e estrategia visual.
- `tools/`: scripts utilitarios para futuras releases.

## Roadmap sugerido das proximas builds
1. Trocar placeholders por fundos finais premium.
2. Adicionar retratos de staff e prospects.
3. Inserir logos especiais de torneios/categorias.
4. Expandir mercado, eventos e negociacoes.
5. Refinar economia, lesoes e fadiga.
6. Adicionar flags e nacionalidades visuais.
7. Evoluir Admin para persistencia em backend quando desejado.

## Limitacoes atuais desta primeira build
- O sistema economico e de progressao ja e funcional, mas ainda e um primeiro balanceamento.
- O ranking inicial usa snapshot real, enquanto a simulacao futura passa a seguir as regras internas do jogo.
- Os assets visuais definitivos ainda serao produzidos nas proximas iteracoes.
- O Admin e local-first, preparado para futura integracao com backend.

## Arquivos importantes
- `build/build-info.json`: versao e carimbo da build.
- `CHANGELOG.md`: historico de releases.
- `docs/ASSET_STRATEGY.md`: plano de criacao dos assets premium.

## Licenciamento e dados
Esta build e um prototipo jogavel para evolucao iterativa. Em uma versao publica comercial, revise licenciamento de nomes, marcas e identidades visuais de torneios e organizacoes.


## Build visual integrada

Versão 2.6.0 (20260418-122440).

Esta build inclui integração de logos de torneios, avatares transparentes de jogadores/staff e fundos premium mobile-first.
